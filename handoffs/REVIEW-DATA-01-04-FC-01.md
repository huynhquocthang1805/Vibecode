# Review — DATA-01..04 + FC-01 (Huy · Gemini) — techlead · 2026-11-02

Nhánh `feat/data-engineer/DATA-01-DATA-04-FC-01` (2 commit) → **APPROVE + merge**, kèm 5 lỗi phải sửa ở task **DATA-FIX-01** trước Gate G1.

## Kiểm tra đã chạy
| Hạng mục | Kết quả |
|---|---|
| Phạm vi file | ✅ chỉ `lib/domain`, `lib/data`, `lib/analytics/trend.ts` + handoff — đúng ownership |
| Hợp đồng | ✅ không đổi chữ ký `docs/10`, không sửa `domain.ts` |
| lint · typecheck · test của owner (45) | ✅ xanh ở 4 múi giờ: UTC, Asia/Ho_Chi_Minh, America/Los_Angeles, Pacific/Kiritimati |
| Fixture BA-01 — 71 ca kiểm hàm, so khớp nghiêm ngặt docs/03 §8 | ✅ 71/71 |
| Scenario E17, E18 (duplicate policy qua store) | ✅ |
| Property: bucketKey ↔ bucketRange (500 ngày ngẫu nhiên × 4 grain), addDays ↔ daysBetween | ✅ |
| Property: codec roundtrip 200 lần; chuỗi hỏng ném `CORRUPT_*` | ✅ |
| Property: analyzeTrend không bao giờ NaN/Infinity (300 chuỗi ngẫu nhiên) | ✅ |
| Property: chuỗi thao tác store ngẫu nhiên (add/remove/đổi ngày/undo) | ❌ R-01, R-02 |
| `npm run build` + chạy production, 375px, console | ✅ không lỗi |

Test: `tests/integration/data-layer.review.test.ts` — 78 pass + 5 `it.fails` (lỗi đã biết).

## Lỗi phải sửa (DATA-FIX-01, P0)
| Mã | Mức | File | Lỗi | Cách sửa gợi ý |
|---|---|---|---|---|
| R-01 | **Cao** | `store.ts` | `undoStack` là biến toàn cục, không xoá khi `clearAll`/`loadMock`/hydrate. Hoàn tác trong 10s sau "Xoá hết" hoặc "Nạp dữ liệu mẫu" áp delta cũ → checksum âm, dòng ma. Fast-check tìm ra: `[undo, add([])]`. Ngoài ra stack không giới hạn (docs/13 G12: chỉ giữ 1 thao tác). | Xoá stack ở `clearAll`/`loadMock`/hydrate; chỉ giữ 1 thao tác; khi undo chỉ xoá/khôi phục dòng còn tồn tại. |
| R-02 | **Cao** | `store.ts` `updateEntry` | Đổi ngày sang ngày đã có dữ liệu khi policy ≠ `ask` → 2 dòng cùng khoá `campaignId\|date` (vi phạm E47, làm sai tổng). | Có `conflictIdx`: `overwrite` → xoá dòng xung đột (đưa vào `removed` của delta); `sum` → cộng vào dòng xung đột rồi xoá dòng cũ; `skip` → trả lỗi DUPLICATE_DATE. |
| R-03 | Thấp | `validation.ts` | `source` được ép kiểu `as EntryInput['source']` — chuỗi bất kỳ lọt vào store/storage. | Kiểm theo enum, sai → bỏ (undefined). |
| R-04 | Trung bình | `validation.ts` `parseNumberField` | `replace(/[₫đVNDvnd]/g, '')` xoá ký tự ở mọi vị trí → `"1d2"` thành 12 (parse một phần — docs/03 §4.1 #4 cấm). | Chỉ bỏ hậu tố tiền tệ: `/\s*(₫|đ|vnd)$/i`. |
| R-05 | Thấp | `dates.ts` `bucketKey` | date-fns đọc giờ máy; tại 12:00 UTC máy ở UTC+13/+14 (NZ mùa hè, Tonga) xếp CN 04/01/2026 vào W02, 31/03 vào Q2. | Tính ISO week/quarter bằng toán UTC thuần (như `bucketRange` đã làm). |

Sửa xong: đổi `it.fails` → `it` cho đúng mã lỗi trong file test review (test sẽ tự báo đỏ khi lỗi đã hết).

## Cần lưu ý (không chặn)
- **Hydrate không tăng `revision`/không phát `entries/changed`** → TL-06/DATA-06 nối `useAnalytics` theo `revision` sẽ không biết dữ liệu đã nạp. Sửa cùng DATA-FIX-01: hydrate = `revision + 1` + emit delta `{added: loaded, removed: []}`. Thao tác trước khi `hydrated` có thể bị ghi đè → UI chặn nhập khi `!hydrated` (FI-01).
- `loadMock('campaign-2y' | 'edge-cases')` đang là dữ liệu tạm 15 ngày, dùng `toISOString().slice(0,10)` (CLAUDE.md §5 cấm) → thay bằng fixture của BA-05 + `addDays/todayVN`.
- Quota: khi `setItem` lỗi, adapter chuyển hẳn sang RAM cho cả phiên, không thử lại → chấp nhận ở P0 (E30 đạt), DATA-10 làm retry/backoff.
- `upsertCampaign` vượt `MAX_CAMPAIGNS` trả về chiến dịch đầu thay vì báo lỗi → FI-04 cần kiểm `campaigns.length` trước khi gọi.
- `validateBatch` đếm `row` từ 1 theo dòng dữ liệu; DATA-07 phải +1 cho dòng header khi báo số dòng file (E29).
- **Góp ý BA-02 (Nhân):** chuỗi CPA tăng ~3 lần trong 14 ngày cho `overall = 'flat'`, vì quy tắc "CPA up > 10%" so ngày-với-ngày (~6%). Đúng đặc tả hiện tại, nhưng nên xét thêm slope trong `thresholds`/docs/04 §2.

## Điểm tốt
Codec bỏ id/timestamp đúng docs/13 §2; debounce + max-wait chống đói ghi đúng; validation kiểm âm trước làm tròn, không báo lỗi dây chuyền; `bucketRange` đã tính bằng UTC thuần; bus nuốt lỗi listener; handoff đầy đủ từng task.

---
## Vòng 2 — DATA-FIX-01 (2026-11-02) → APPROVE + merge
| Mã | Kết quả kiểm lại |
|---|---|
| R-01 | ✅ undo chỉ giữ 1 thao tác, xoá khi clearAll/loadMock/hydrate; chỉ khôi phục dòng còn thiếu |
| R-02 | ✅ đổi khoá trùng: ask/skip → DUPLICATE_DATE không đổi dữ liệu; sum cộng dồn; overwrite thay dòng xung đột; undo về đúng trạng thái |
| R-03 | ✅ source kiểm theo enum |
| R-04 | ✅ chỉ bỏ hậu tố tiền tệ; "1d2" → NOT_NUMBER |
| R-05 | ✅ tuần ISO/quý tính UTC thuần; khớp Python `isocalendar` 7.670/7.670 ngày 2015–2035; test xanh ở UTC, VN, LA, Kiritimati (+14), Auckland |
| Hydrate | ✅ tăng revision + phát `entries/changed` |

Ghi chú nhỏ (không chặn): checksum giờ tính lại O(n) mỗi thay đổi thay vì O(|delta|) như docs/13 §3 — ~1ms ở 50k dòng, chấp nhận ở P0; `updateEntry` có 3 khối set/emit lặp lại, nên gom thành 1 hàm `commit(delta, nextEntries)` khi rảnh.

## BA-05 (Nhân) — APPROVE + merge (ghi ở đây cho gọn)
- ✅ Chỉ file của BA/QA. `gen:mock` kiểm mọi dòng bằng `validateEntry` thật trước khi ghi.
- ✅ Lệnh trong handoff tái lập fixture **trùng từng byte**. ⚠️ Comment đầu `scripts/gen-mock.ts` ghi ví dụ `--today 2026-11-01 --end-date 2026-10-31` → ra file khác; nên sửa comment cho khớp lệnh chuẩn.
- ✅ Kiểm độc lập (Python): khoá duy nhất, ngày liên tục, số hợp lệ; demo có câu chuyện rõ cho AI.
- ℹ️ `tests/ba/BA05_TEST_MATRIX_3608.csv` (545KB, cột status = NOT_RUN) chỉ là tài liệu — cân nhắc bỏ khỏi repo hoặc cập nhật status sau khi chạy.
- ➡️ Huy: DATA-04b — `loadMock` dùng 2 fixture này + đăng ký `MOCK_CAMPAIGNS`.
