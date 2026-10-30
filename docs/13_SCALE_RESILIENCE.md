# 13 — Dữ liệu lớn, chống phình dữ liệu & xử lý lỗi (Scale & Resilience v1)

Owner: `techlead`. Áp dụng cho mọi module. **Khi mâu thuẫn với docs/01, 02, 04, 06 → file này thắng** (đã ghi quyết định ở `handoffs/CHANGE_REQUESTS.md` CR-001).
Hằng số giới hạn: `LIMITS` trong `src/types/domain.ts` — **một nguồn sự thật**, không ai tự đặt số khác.

Mục tiêu đo được:
| Mức | Số dòng (`DailyEntry`) | Yêu cầu |
|---|---|---|
| Mục tiêu | 50.000 | Đạt toàn bộ ngân sách §9, lưu localStorage |
| Mở rộng | 100.000 | UI mượt, có thể cần IndexedDB (P2) hoặc lưu trữ năm cũ |
| Sống sót | 200.000 (`LIMITS.MAX_ROWS_TOTAL`) | Không crash, không mất dữ liệu; được phép chậm hơn ngân sách |
| Vượt | > 200.000 | Từ chối thao tác **trước khi** ghi, giải thích + hướng dẫn |

---

## 1. Dữ liệu phình từ đâu & chặn ở đâu

| # | Nguồn phình | Hậu quả nếu không chặn | Chặn bằng | Task |
|---|---|---|---|---|
| G1 | Import CSV/dán bảng rất lớn | treo tab, vượt quota | `MAX_IMPORT_FILE_BYTES`, kiểm sức chứa **trước** khi ghi, parse trong worker theo chunk, nút Huỷ | DATA-07, FI-03 |
| G2 | Ngày quá xa (gõ nhầm 1900, 2062) | điền kỳ trống → hàng chục nghìn ngày 0 cho chart/forecast | `LIMITS.MIN_DATE` → lỗi `DATE_TOO_OLD`; tương lai đã có `FUTURE_DATE` | DATA-01 |
| G3 | Giá trị khổng lồ | tổng vượt `Number.MAX_SAFE_INTEGER` → **sai số im lặng** | `LIMITS.MAX_VALUE` chọn sao cho `MAX_VALUE.cost × MAX_ROWS_TOTAL < 2^53` | DATA-01 |
| G4 | Nhiều chiến dịch | số bucket × chiến dịch tăng | `MAX_CAMPAIGNS`, tên ≤ `MAX_CAMPAIGN_NAME` | DATA-04, FI-04 |
| G5 | Trùng ngày trong cùng file (Ads Manager xuất theo nhóm quảng cáo) | dòng trùng, KPI sai | gộp trong file (mặc định `sum`), báo `mergedInFile` | DATA-07 |
| G6 | Hàng "Tổng cộng/Total" trong file Excel | **cộng hai lần** | nhận diện → bỏ qua với cảnh báo `SUMMARY_ROW` | DATA-07 |
| G7 | Form nháp nhiều dòng (bấm "+7 ngày" liên tục, dán 5k dòng) | 5k ô input → đơ | `MAX_DRAFT_ROWS`; dán > `PASTE_INLINE_MAX_ROWS` → tự mở PasteImportDialog | FI-01, FI-07 |
| G8 | Báo cáo import 50k lỗi | giữ 50k object lỗi trong RAM + render | chỉ giữ `MAX_REPORT_ISSUES` chi tiết đầu, còn lại đếm (`rejectedTotal`), tải CSV lỗi đầy đủ sinh từ worker | DATA-07, FI-03 |
| G9 | Live mode x60 | ghi storage liên tục, render dày | ghi theo partition bẩn + `PERSIST_MAX_WAIT_MS`; throttle render; live dùng `sum` vào **ngày hôm nay** (không thêm dòng) | DATA-08, DATA-10 |
| G10 | Backup JSON lớn | `JSON.parse` 50MB trên main thread | `MAX_BACKUP_BYTES`, parse trong worker, validate theo batch | DATA-04, FI-05 |
| G11 | Hộp thoại trùng ngày với 10k xung đột | render 10k dòng | tóm tắt: số lượng + khoảng ngày + 20 dòng đầu + "áp dụng cho tất cả" | FI-01, FI-03 |
| G12 | Undo giữ bản sao lớn | RAM | chỉ giữ **1** thao tác gần nhất, hết hạn `UNDO_TTL_MS` | DATA-04 |

---

## 2. Lưu trữ v1 — phân vùng theo năm, ghi nguyên tử, tự kiểm (DATA-03 → DATA-10)

**P0 (DATA-03):** 1 key duy nhất, codec cột docs/02 §2 **nhưng KHÔNG lưu cột `id` và `t`**:
- `id` là **khoá xác định** `${campaignId}|${date}` (đã duy nhất theo docs/02 §1) → dựng lại khi decode, tiết kiệm ~40% dung lượng.
- `createdAt/updatedAt` không lưu; decode gán `savedAt` của manifest.
- **Bỏ key `kpi-dash:v1:backup`** khi chuỗi > 1MB (nó nhân đôi dung lượng); thay bằng cơ chế thế hệ ở dưới + nhắc xuất file backup.

Ước lượng: ~30 ký tự/dòng → 50k dòng ≈ 1,5 triệu ký tự (≈ 3MB UTF-16) — vừa quota 5MB của mọi trình duyệt chính.

**P1 (DATA-10):** phân vùng + ghi nguyên tử:
```
kpi-dash:v1                     manifest  { v, gen, savedAt, epoch, campaigns, settings,
                                            parts: { "2025": { gen, rows, sum:[r,k,s,o] }, ... } }
kpi-dash:v1:p:<năm>:<gen>       partition { c:[[campIdx,count],...] (RLE), d:[delta ngày], r, k, s, o, src(RLE) }
```
- Dòng trong partition sắp theo (campaign, ngày) → cột `d` delta-encode chỉ 1–2 ký tự/dòng.
- **Chỉ mã hoá lại partition bẩn**: store đánh dấu năm bị chạm bởi mỗi `EntryDelta`. Live mode chỉ chạm năm hiện tại → mỗi lần ghi vài trăm KB thay vì toàn bộ.
- **Ghi 2 pha (không bao giờ mất bản tốt):**
  1. Ghi từng partition bẩn sang key **thế hệ mới** `:p:<năm>:<gen+1>`.
  2. Tất cả thành công → ghi manifest trỏ sang thế hệ mới (bước "commit").
  3. Xoá key thế hệ cũ.
  - Lỗi/quota ở bước 1 → xoá các key mới đã ghi dở, manifest cũ vẫn nguyên → dữ liệu cũ an toàn; dữ liệu mới giữ trong RAM (cờ `dirty`), thử lại với backoff 2s → 4s → 8s, phát `system/health` (storage, degraded).
  - Tắt tab giữa bước 2 và 3 → còn key mồ côi → lần tải sau **dọn rác**: xoá mọi `kpi-dash:v1:p:*` không có trong manifest.
- **Tự kiểm khi đọc**: mỗi partition so `rows` và `sum` với manifest. Sai → cách ly partition đó (`kpi-dash:corrupt:<năm>:<ts>`), nạp các năm còn lại, báo người dùng **năm nào** bị hỏng + nút "Khôi phục từ file backup". Không bao giờ vì 1 năm hỏng mà mất cả dữ liệu.
- **Nhiều tab cùng ghi**: bọc bước ghi trong `navigator.locks.request('kpi-dash:write', …)` (fallback: không khoá). Trước khi commit, đọc lại `manifest.gen`; nếu tab khác đã ghi (gen khác dự kiến) → đọc lại partition liên quan, hợp nhất theo khoá `${campaignId}|${date}` (thay đổi của tab hiện tại thắng) rồi ghi.
- **Nhịp ghi**: debounce `PERSIST_DEBOUNCE_MS` **kèm** `PERSIST_MAX_WAIT_MS` (debounce thuần sẽ *không bao giờ* ghi khi live x60 có delta mỗi 16ms — lỗi đói ghi). Ghi trong `requestIdleCallback` nếu có; `visibilitychange → hidden` và `pagehide` → ghi ngay.

---

## 3. Rollup — mảng dày theo ngày, tự chữa lệch (DATA-05, DATA-11)

`Map<string, Bucket>` với key ghép chuỗi ở docs/01 §3 chỉ là minh hoạ. Triển khai thật:
```
per campaign: firstDay (epoch day), Float64Array reach/clicks/cost/orders theo ngày, Uint8Array hasData
              Int32Array weekOf[day], monthOf[day], quarterOf[day] (tính sẵn 1 lần cho khoảng ngày)
              Float64Array week*/month*/quarter* (4 chỉ số × 3 grain)
all:          cộng dồn tương tự + Uint16Array campaignsWithData[day]
```
- Thêm/sửa/xoá 1 dòng = cập nhật 1 ô ngày + 3 ô bucket × (campaign + all) → O(1), không tạo chuỗi/objet tạm → không áp lực GC.
- Mảng tăng kích thước kiểu nhân đôi khi có ngày ngoài khoảng; nhờ `MIN_DATE` khoảng tối đa ~12 năm ≈ 4.400 ngày.
- `daysWithData` của `all` chính xác: tăng khi `campaignsWithData[day]` 0→1, giảm khi 1→0 (sửa lỗi đếm trùng ghi ở skill big-data-frontend §1).
- Tổng khoảng ngày tuỳ ý = vòng `for` trên ≤ 4.400 ô (micro-giây). *Không dùng Fenwick tree/prefix sum*: phức tạp hơn mà không nhanh hơn đáng kể ở quy mô này (câu trả lời khi bị phản biện).
- **Chỉ số nguyên**: reach/clicks/cost/orders đều nguyên và < 2^53 (G3) → cộng/trừ tăng dần **chính xác tuyệt đối**, không trôi số. KPI tỉ số **không bao giờ cộng dồn** — luôn tính lại từ tổng.
- **Gap-fill có giới hạn**: chỉ điền kỳ trống trong `range` đang xem và trong [ngày đầu, ngày cuối có dữ liệu]; không bao giờ từ `MIN_DATE`.

**Tự chữa lệch (self-healing):**
1. Store giữ `checksum = { rows, reach, clicks, cost, orders }` cập nhật O(|delta|) cùng lúc với mỗi delta.
2. Worker trả `checksum` của index trong mỗi `AnalyticsSnapshot`.
3. `useAnalytics` so sánh: lệch → gọi lại `init(entries)` (dựng lại toàn bộ, < 300ms) + phát `system/health` (rollup, recovered). Bắt được mọi lỗi mất delta/áp dụng 2 lần/sai thứ tự.
4. `applyDelta(delta, revision)` chỉ áp khi `revision === lastRevision + 1`; nhảy cóc → trả lỗi `REVISION_GAP` → client `init` lại.

---

## 4. Worker — giám sát, gộp yêu cầu, cache (DATA-06, DATA-11)

- **Khởi tạo nhanh**: client đóng gói entries thành cột typed array (`Int32Array day`, `Uint16Array campaignIdx`, `Float64Array r/k/s/o`, `Uint8Array src`) và **transfer** (zero-copy) thay vì structured clone 100k object (~10× nhanh hơn). Chữ ký public `init(entries)` giữ nguyên — đóng gói nằm trong `getAnalyticsClient()`.
- **Gộp yêu cầu (latest-wins)**: đang tính snapshot mà có 10 yêu cầu mới → chỉ giữ yêu cầu **cuối**; delta dồn dập gộp trong 50ms.
- **Giám sát (supervisor)**: `worker.onerror`, `messageerror`, hoặc snapshot quá `SNAPSHOT_TIMEOUT_MS` → `terminate()`, tạo worker mới, `init` lại, thử lại 1 lần. Quá `WORKER_MAX_RESTARTS` trong 60s → **chế độ tương thích**: chạy trên main thread, chia nhỏ công việc (nhường luồng mỗi ~8ms bằng `setTimeout(0)`/`scheduler.yield`), tắt dự báo khi > 20k dòng, banner "Chế độ tương thích — vẫn dùng được, có thể chậm hơn".
- **Cache theo phần**: snapshot = nhiều phần tính độc lập, mỗi phần có khoá cache:
  | Phần | Khoá cache | Tính lại khi |
  |---|---|---|
  | series, totals | (campaign, grain, range, revision) | mọi delta |
  | trend | (campaign, grain, range, revision) | mọi delta |
  | **forecast** | (campaign, metric, `completedVersion`) | delta chạm **ngày đã kết thúc** (< today) |
  | nowcast | (forecast cache, actualToDate) | mọi delta — rẻ (< 5ms) |
  | anomalies | (campaign, `completedVersion`) + live check | ngày đã kết thúc / live tick |
  → Live tick chỉ chạm hôm nay ⇒ snapshot live ≈ totals + nowcast + live anomaly **< 5ms** dù có 100k dòng.

---

## 5. Dự báo bền vững khi dữ liệu bẩn/thưa/cũ (FC-10)

| Tình huống | Xử lý | `forecastStatus` / thông điệp UI |
|---|---|---|
| < 7 ngày dữ liệu | không dự báo | `insufficient` · "Cần ≥ 7 ngày để dự báo" |
| Ngày cuối có dữ liệu < today − `STALE_DATA_DAYS` | không dự báo/nowcast (dự báo từ 3 tháng trước tới nay là vô nghĩa) | `stale` · "Dữ liệu cũ (lần cuối 12/07) — nhập tiếp để có dự báo" |
| Khoảng trống dài > 28 ngày giữa chuỗi | chỉ fit đoạn **sau** khoảng trống cuối (nếu ≥ 7 ngày), else baseline | `ok` + `dataQuality.missingDays` |
| Khoảng trống ngắn ≤ 7 ngày | nội suy tuyến tính **chỉ để fit** (docs/04 §1) | nhắc "Thiếu N ngày" |
| Ngày đầu tiên có dữ liệu | cắt bỏ phần 0 phía trước | — |
| Một ngày gõ nhầm (cost ×100) | **winsorize** khi fit: kẹp vào median ± 5·MAD (dữ liệu gốc không đổi; anomaly vẫn báo) | dự báo không "bay" |
| Hôm nay (chưa hết ngày) | **không** đưa vào fit; chỉ dùng cho nowcast | — |
| Chuỗi toàn 0 / hằng số / NaN | trả dự báo hằng, kiểm `Number.isFinite` mọi tham số; không hữu hạn → naive | không bao giờ NaN |
| Dữ liệu > 365 ngày | fit 365 ngày đã kết thúc gần nhất (docs/04 §3) | — |
| Quá nhiều chiến dịch | chỉ dự báo cho chiến dịch đang xem (+ `all`), theo yêu cầu, có cache | — |

---

## 6. Import & dữ liệu thực tế từ Excel / Ads Manager (DATA-07, FI-03)

1. **Mã hoá**: bỏ BOM; nhận UTF-16LE/BE theo BOM; thử `TextDecoder('utf-8', { fatal: true })`, lỗi → `windows-1258` (Excel tiếng Việt trên Windows). Hiển thị mã hoá đã dùng trong preview.
2. **Dấu phân cách**: tự nhận `,` `;` `\t` (Excel locale VN hay xuất `;` vì dấu thập phân là `,`).
3. **Dòng tiêu đề không ở dòng 1**: quét 10 dòng đầu, chọn dòng khớp nhiều header nhất (docs/02 §6).
4. **Hàng tổng**: ô ngày rỗng/không phải ngày **và** có chữ `tổng|tong|total|sum` → bỏ qua, cảnh báo `SUMMARY_ROW`.
5. **Số**: thêm dạng khoa học `1.2E+06` (Excel cột hẹp) → nhận nếu kết quả nguyên; `-`, `—`, ô rỗng ở cột số → 0 có cảnh báo (Ads Manager ghi "—" cho 0).
6. **Trùng trong file**: gộp theo khoá `${campaign}|${date}` bằng `sum` (mặc định, vì Ads Manager tách theo nhóm quảng cáo), báo `mergedInFile`. Policy người dùng chọn chỉ áp cho xung đột **với dữ liệu đã có**.
7. **Kiểm sức chứa trước khi ghi**: `rowsSau = rowsHiện + rowsMới(không trùng)`; > `MAX_ROWS_TOTAL` → từ chối cả lần import, không ghi gì, đề xuất: lọc khoảng ngày / lưu trữ năm cũ.
8. **Không treo**: parse + validate trong worker theo chunk, gửi tiến độ; nút **Huỷ** (`parser.abort()`); main thread không giữ 200k object thô.
9. **Nguyên tử**: cả lần import = 1 `EntryDelta` + 1 lần ghi; **Hoàn tác import** trong `UNDO_TTL_MS` (store giữ bản cũ của các khoá bị ghi đè).

---

## 7. Giao diện cho dữ liệu lớn & khi có lỗi (FD-01, FD-09, FI-07)

**Không bao giờ trắng trang (P0, FD-01):**
- `ErrorBoundary` riêng cho từng khu: header, KPI, biểu đồ, dự báo, AI, nhập liệu, bảng. Lỗi 1 khu → thẻ "Phần này gặp lỗi" + [Thử lại] + [Sao chép chi tiết lỗi]; các khu khác chạy bình thường.
- `window.onerror` / `unhandledrejection` → 1 toast, chống spam (gộp cùng thông điệp, tối đa 1 toast/10s).
- Lỗi tầng dữ liệu **không throw vào render**: trả về trạng thái (`health`, `forecastStatus`, `ImportReport`) để UI hiển thị.

**Mượt với dữ liệu lớn (P1, FD-09):**
- **Khoảng mặc định**: dữ liệu trải > 180 ngày → mở trang ở "90 ngày gần nhất", không phải "Tất cả". Preset: 7N · 30N · 90N · Tháng này · Quý này · Năm nay · Tất cả. Bộ chọn hiển thị phạm vi dữ liệu có (`dataSpan`).
- **Gợi ý grain**: > 400 điểm ở grain Ngày → chip "Xem theo Tuần cho dễ đọc?" (không tự đổi).
- **Giữ dữ liệu cũ khi đang tính**: skeleton chỉ lần tải đầu; sau đó giữ snapshot cũ + thanh tiến độ mảnh + chip "Đang cập nhật…" → không nháy.
- **Thao tác dài** (import, khôi phục backup, xoá hết, dựng lại index): hộp tiến độ có % và [Huỷ].
- Khung biểu đồ cố định chiều cao (không giật layout). `animation: false` khi > 2000 điểm hoặc `prefers-reduced-motion` hoặc `navigator.deviceMemory ≤ 2`.
- Live mode khi > 50k dòng: throttle render 1s thay vì 250ms.

**Chặn phình ngay ở chỗ nhập (P1, FI-07):**
- Form nháp tối đa `MAX_DRAFT_ROWS`; chạm trần → "Nhiều dòng? Dùng Import/Dán bảng" (nút mở dialog).
- Dán > `PASTE_INLINE_MAX_ROWS` dòng vào form → tự mở `PasteImportDialog` đã điền sẵn.
- Hộp thoại xung đột: tóm tắt (G11).
- **Đồng hồ dung lượng** (header khi ≥ 70%, DataManager luôn hiện): số dòng / `MAX_ROWS_TOTAL`, % quota, loại lưu trữ. ≥ 70% vàng, ≥ 90% đỏ, kèm hành động: [Xuất backup] · [Lưu trữ năm cũ] · [Bật lưu nâng cao] (IndexedDB, P2).
- **Lưu trữ năm cũ**: chọn năm → tải file `kpi-archive-<năm>.json` → xác nhận đã có file → xoá các năm đó (1 delta, có hoàn tác) → có thể nhập lại bất cứ lúc nào bằng "Nhập backup".
- Bảng 100k dòng: "Đang hiển thị 1–50 / 87.432", nút "Đi tới ngày"; mobile = danh sách thẻ ảo hoá.
- Banner chế độ suy giảm (từ `health`): "Đang lưu tạm trong tab — hãy xuất backup" (storage memory) · "Chế độ tương thích" (worker) · "Không đồng bộ được giữa các tab" (sync).

---

## 8. Ma trận lỗi → phát hiện → tự phục hồi → người dùng thấy

| Lỗi | Phát hiện | Tự động | Người dùng thấy | Task |
|---|---|---|---|---|
| localStorage bị chặn (Safari private, iframe) | `setItem` thử khi khởi động throw | adapter `memory` | Banner đỏ "Không lưu được — xuất backup trước khi đóng tab" | DATA-03 |
| Quota đầy khi ghi | `QuotaExceededError` (+ mã 22/1014) | huỷ thế hệ mới, giữ bản cũ, giữ RAM, retry backoff | Toast + đồng hồ dung lượng đỏ + 3 hành động §7 | DATA-03/10 |
| Manifest hỏng/không parse được | `decodeState` ném mã `CORRUPT_MANIFEST` | thử `migrate` → quét partition còn lại dựng lại manifest | "Đã khôi phục dữ liệu từ bản lưu" hoặc "Không khôi phục được — nhập backup" | DATA-10 |
| 1 partition hỏng | checksum lệch | cách ly năm đó, nạp phần còn lại | "Dữ liệu năm 2024 bị hỏng (đã cách ly) — [Nhập backup]" | DATA-10 |
| 2 tab ghi cùng lúc | `manifest.gen` đổi bất ngờ | Web Lock + hợp nhất theo khoá | không thấy gì | DATA-10 |
| Worker không tạo được / crash / treo | onerror, timeout | restart ×2 → main thread | Banner "Chế độ tương thích" | DATA-11 |
| Rollup lệch | checksum snapshot ≠ store | `init` lại | không thấy gì (log `system/health`) | DATA-11 |
| Delta mất/sai thứ tự | `REVISION_GAP` | `init` lại | không thấy gì | DATA-06 |
| BroadcastChannel không có | `typeof BroadcastChannel` | fallback sự kiện `storage` | — | DATA-08 |
| CSV sai mã hoá/phân cách | header không khớp | thử mã hoá/phân cách khác | Preview + bảng ánh xạ cho sửa | DATA-07, FI-03 |
| Import vượt sức chứa | đếm trước khi ghi | từ chối toàn bộ | "File có 180.000 dòng, chỉ còn chỗ cho 50.000 — lọc khoảng ngày hoặc lưu trữ năm cũ" | DATA-07, FI-03 |
| Tổng vượt 2^53 | không thể xảy ra nhờ `MAX_VALUE` (G3); assert `Number.isSafeInteger` trong test | — | — | DATA-01, QA-08 |
| Component lỗi render | ErrorBoundary | — | Thẻ lỗi khu đó + Thử lại | FD-01 |
| Dự báo ra NaN/Infinity | `Number.isFinite` mỗi điểm | fallback naive | badge "độ tin cậy thấp" | FC-10 |
| Clipboard bị chặn | promise reject | fallback textarea + select | "Bôi đen và Ctrl+C" | AI-08 |

Mọi sự cố phát `system/health` lên `bus` → store giữ `health` → UI banner. Mỗi sự cố ghi `console.warn` 1 lần (không `console.log`).

---

## 9. Ngân sách hiệu năng bổ sung (QA-05, QA-08 đo; bổ sung docs/01 §5)

| Kịch bản | 50k | 200k (sống sót) |
|---|---|---|
| Khởi động tới khi thấy KPI (decode + init worker + snapshot) | < 1,2s | < 4s |
| Ghi 1 dòng → KPI/biểu đồ cập nhật | < 100ms | < 300ms |
| Ghi storage 1 delta (partition năm hiện tại) | < 30ms main thread | < 60ms |
| Live x60: snapshot mỗi tick | < 5ms | < 10ms |
| Import CSV (end-to-end) | < 3s | < 12s |
| Long Task trên main thread khi import | < 50ms | < 100ms |
| Chuỗi lưu trữ | ≤ 3,5MB UTF-16 | IndexedDB / lưu trữ năm cũ |
| Heap sau 10 phút live x60 | ổn định (± 10%) | ổn định |

---

## 10. Ca biên bổ sung (BA-08 chép vào `edge-cases.json`; DATA-01/07, FC-10, QA-08 phải pass)
| # | Input | Kỳ vọng |
|---|---|---|
| E31 | date = ngày trước `MIN_DATE` | error `DATE_TOO_OLD` |
| E32 | cost = `MAX_VALUE.cost + 1` | error `TOO_LARGE` |
| E33 | reach = `"1.2E+06"` | 1.200.000 |
| E34 | CSV UTF-8 có BOM, header "Ngày" | map đúng cột date |
| E35 | CSV windows-1258 | header tiếng Việt map đúng |
| E36 | CSV phân cách `;`, số `1.234.567` | parse đúng |
| E37 | CSV có 3 dòng tiêu đề trước header | nhận header dòng 4 |
| E38 | Dòng "Tổng cộng" cuối file | bỏ qua, cảnh báo `SUMMARY_ROW`, không cộng vào tổng |
| E39 | 3 dòng cùng ngày + chiến dịch trong 1 file | gộp `sum` thành 1, `mergedInFile = 2` |
| E40 | Import làm tổng vượt `MAX_ROWS_TOTAL` | từ chối, dữ liệu **không đổi** |
| E41 | Dán 5.000 dòng vào form | mở PasteImportDialog, không tạo 5.000 dòng nháp |
| E42 | Dữ liệu chỉ có 01/2015 và 10/2026 | chart mở 90 ngày gần nhất; dự báo chỉ dùng đoạn 2026 |
| E43 | Dòng cuối cách hôm nay 30 ngày | `forecastStatus = 'stale'`, không nowcast |
| E44 | 1 ngày cost ×100 | dự báo không lệch > 20% so với khi không có ngày đó; anomaly báo ngày đó |
| E45 | Tên chiến dịch 500 ký tự | cắt còn `MAX_CAMPAIGN_NAME`, cảnh báo |
| E46 | Tạo chiến dịch thứ `MAX_CAMPAIGNS + 1` | lỗi `LIMIT_EXCEEDED` |
| E47 | Sửa ngày của dòng sang ngày đã có dữ liệu | áp duplicate policy (không tạo 2 dòng cùng khoá) |
| E48 | Live x60 chạy 10 phút | storage được ghi ít nhất mỗi `PERSIST_MAX_WAIT_MS` |
| E49 | Xoá thủ công 1 key partition rồi reload | các năm khác vẫn nạp; báo năm bị mất |
| E50 | Chuỗi thao tác ngẫu nhiên thêm/sửa/xoá/import/hoàn tác | checksum store = checksum worker = rebuild |

---

## 11. Bất biến property-based bổ sung (QA-08, bổ sung docs/08 §2)
7. Sau mọi chuỗi thao tác ngẫu nhiên (add/update/remove/import/undo, có cả delta từ tab khác): `applyDelta` tích luỹ ≡ `buildRollups(entries cuối)` và checksum khớp.
8. Partition codec: `decode(encode(s)) ≡ s` (bỏ qua `createdAt/updatedAt`), với mọi chia năm/chiến dịch.
9. Ghi 2 pha: ném `QuotaExceededError` ngẫu nhiên ở bất kỳ `setItem` nào → sau reload luôn nạp được **hoặc** trạng thái trước **hoặc** trạng thái sau, không bao giờ trạng thái lai/hỏng.
10. Mọi tổng trong rollup là `Number.isSafeInteger`.
