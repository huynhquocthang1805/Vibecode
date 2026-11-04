# REVIEW — DATA-10 · DATA-11 (PR #11, nhánh `feat/data-engineer/DATA-10-DATA-11`)

## Vòng 1 — Verdict: **REQUEST_CHANGES**

| Hạng mục | Kết quả |
|---|---|
| PR guard (`/tmp/guard.md`) | ✅ Không có lỗi chặn |
| Ownership (chỉ `lib/data/storage`, `lib/workers`, handoff) | ✅ |
| `npm run check` | ✅ lint + typecheck xanh; Vitest 44 file, 3793 pass, 11 expected fail, 0 fail |
| `npm run build` | ✅ |
| Hợp đồng `AnalyticsWorkerApi` / `StorageAdapter` | ⚠️ `init` nhận thêm `PackedEntries`, thêm `ping` — mở rộng tương thích ngược, cần ghi vào CHANGE_REQUESTS (xem L-01) |
| Không `any` / `ts-ignore` / `console.log` | ✅ (chỉ `console.warn` có sẵn ở worker) |
| Test ca lỗi / ca biên | ❌ Thiếu: sửa dòng mà tổng không đổi, lỗi `save` ở tầng store, race 2 tab, restart worker sau `applyDelta` |
| Handoff + log AI | ✅ `handoffs/DATA-10.md`, `DATA-11.md` |

### Lỗi phải sửa

**R-01 (Cao) — `save` giờ ném lỗi khi quota/chặn ghi nhưng store không bắt → mất dữ liệu + unhandled rejection.**
`src/lib/data/storage/localStorageAdapter.ts` (`setRaw`: `throw err`; `save` rethrow ở pha 1/2) kết hợp `src/lib/data/store.ts:122` và `:151` (`void storageAdapter.save(...)` không `.catch`).
Trước PR, `setRaw` hạ xuống in-memory. Giờ khi hết quota: promise reject không ai bắt, `usage()` không chạy, UI không biết, và dữ liệu không còn nằm trong bất kỳ lớp lưu nào. Điều này trái "lỗi runtime không làm trắng trang / không mất dữ liệu" (CLAUDE.md §5, docs/13).
Cách sửa: trong `save`, bắt lỗi của 2 pha, giữ manifest cũ như hiện tại, phát `system/health` (`storage`, `degraded`, kèm `storage/warning`) rồi **resolve** (hoặc để store `.catch` và hiển thị trạng thái suy giảm). Thêm test: quota đầy → `save` không reject, store vẫn giữ `entries`, có sự kiện health.

**R-02 (Cao) — Xác định partition "bẩn" chỉ bằng `rows` + 4 tổng → sửa đổi giữ nguyên tổng không bao giờ được lưu.**
`localStorageAdapter.ts` (khối `isDirty`, khoảng dòng 330–345).
Ví dụ: `updateEntry` đổi ngày hoặc chuyển chiến dịch của 1 dòng trong cùng năm, hoán đổi số liệu giữa 2 dòng, đổi `source`. `rows` và các tổng không đổi → partition bị coi là sạch → dữ liệu cũ nằm lại trên đĩa, reload thấy bản cũ (mất sửa lặng lẽ). Các tổng cũng là thứ `load()` dùng để tự kiểm tra, nên không thể thay bằng chúng.
Cách sửa: dùng chuỗi đã mã hoá để so sánh (giữ `raw` cache theo năm trong adapter, so `raw === prevRaw`), hoặc thêm hash nội dung (vd FNV trên payload) vào `PartitionMeta`; hoặc store truyền danh sách năm bẩn từ delta. Thêm test: đổi ngày / đổi `campaignId` / hoán đổi hai dòng cùng năm, save → load phải trả đúng bản mới.

**R-03 (Trung bình) — `load()` dọn "key mồ côi" không nằm trong khoá ghi → race giữa 2 tab gây mất partition.**
`localStorageAdapter.ts` bước "4. Dọn rác key mồ côi" trong `load()`.
Tab A đang ở pha 1 (đã ghi `…:p:2026:N+1`, chưa commit manifest); Tab B gọi `load()` (hydrate/đồng bộ), thấy key đó không có trong manifest → xoá. Tab A commit manifest trỏ tới key đã mất → năm 2026 "thiếu" (E49).
Cách sửa: bọc cả `load()` (ít nhất bước dọn rác) trong `runWithLock('kpi-dash:write', …)`, hoặc chỉ dọn các key có `gen` < gen manifest. Thêm test mô phỏng xen kẽ.

**R-04 (Trung bình) — Supervisor khởi động lại worker bằng dữ liệu cũ.**
`src/lib/workers/client.ts`: `lastEntriesSnapshot` chỉ gán trong `init`; `applyDelta` không cập nhật → sau `handleWorkerFailure` re-init với snapshot cũ, mất mọi thay đổi từ lần `init` cuối (live mode, nhập mới). Ngoài ra `handleWorkerFailure` khi chuyển chế độ tương thích gán `singletonClient` là engine **không** bọc supervisor/timeout, và gọi `init(...)` không `await`/không bắt lỗi.
Cách sửa: cho client giữ bản sao `entries` đang đồng bộ (áp delta vào nó) hoặc cho `useAnalytics` truyền lại `entries` từ store khi worker restart (store là nguồn sự thật); bọc engine tương thích bằng `createSupervisedClient`; `.catch` cho `init` nền. Thêm test: init → applyDelta → giả lập lỗi worker → snapshot phản ánh cả delta.

**R-05 (Trung bình) — Test supervisor/self-heal chưa chứng minh hành vi cốt lõi.**
`src/lib/workers/supervisor.test.ts:135` chỉ kiểm tra chuyển chế độ tương thích; chưa có test: restart trong giới hạn `WORKER_MAX_RESTARTS` (lần 1–2 vẫn dùng worker), `SNAPSHOT_TIMEOUT` → retry, `REVISION_GAP` → re-init, lệch checksum → `recovered` (logic mới ở `useAnalytics.ts:86`), và `packEntries` với >500 dòng đi qua `init` ≡ truyền mảng thường (kết quả snapshot bằng nhau, kể cả `id`/`source`).
Cách sửa: bổ sung các test trên (dùng fake worker/engine).

### Lưu ý không chặn
- **L-01** Mở rộng `AnalyticsWorkerApi` (`init` nhận `PackedEntries`, thêm `ping`) và `PartitionMeta`/manifest chưa có trong `docs/10_CONTRACTS.md` — ghi vào `handoffs/CHANGE_REQUESTS.md` để techlead cập nhật hợp đồng.
- **L-02** Cache dự báo khoá theo `campaignId:horizon` + `completedVersion`; khi sang ngày mới mà không có delta (`q.today` đổi), `completedVersion` không tăng nên có thể dùng dự báo của ngày cũ. Nên đưa `q.today` vào khoá.
- **L-03** Nhánh tự cứu khi manifest hỏng dựng `campaigns: []`, mọi dòng thành `campaignId: 'default'` và id trùng `default|date` giữa các chiến dịch → mất phân biệt chiến dịch. Chấp nhận như phương án cuối nhưng nên cảnh báo rõ trong thông báo `recovered`.
- **L-04** `PARTITION_PREFIX` cố định bất kể tham số `key` của `createLocalStorageAdapter(key)`; hai adapter khác key sẽ dọn/xoá partition của nhau (test dùng key riêng dễ gây nhiễu). Nên suy ra prefix từ `key`.
- **L-05** `createdAt/updatedAt` mất khi decode (đặt bằng `savedAt`) — chấp nhận nhưng ghi vào handoff; bỏ cơ chế `:backup` cũ nên nên nêu rõ trong handoff.
- **L-06** Handoff ghi "12 passed" / "14 passed" trong khi cả hai vẫn nói "Hạn chế: Không có" — nên liệt kê R-01…R-04 nếu chưa sửa.

### Điểm tốt
- Thiết kế ghi 2 pha + thế hệ (`gen`) rõ ràng, dọn khóa cũ sau commit; tương thích ngược định dạng khối P0.
- Tự kiểm `rows/sum` khi đọc, cách ly partition hỏng sang `kpi-dash:corrupt:*` và vẫn nạp các năm còn lại (E49) kèm test.
- Codec cột + delta ngày + RLE gọn; test round-trip (bất biến #8) và hiệu năng 50.000 dòng.
- Tách `completedVersion` khỏi dữ liệu hôm nay để live mode không tính lại dự báo; có test `forecastCached`.
- Check + build xanh, không đụng file ngoài phạm vi sở hữu.

---

## Vòng 2 — Verdict: **APPROVE**

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ Không có lỗi chặn |
| `npm run check` | ✅ lint + typecheck xanh; Vitest 44 file, 3799 pass, 11 expected fail, 0 fail |
| `npm run build` | ✅ |
| R-01 quota/ghi lỗi | ✅ `save` bắt lỗi pha 1/2, rollback key mới, giữ state trong RAM, phát `system/health` degraded, không reject; store thêm `.catch`. Có test quota |
| R-02 partition bẩn | ✅ thêm hash FNV-1a vào `PartitionMeta`; test sửa giữ nguyên rows/tổng |
| R-03 race dọn rác | ✅ bọc lock + chỉ xoá key `gen` < gen manifest; có test |
| R-04 restart mất delta | ✅ `applyDelta` cập nhật snapshot; engine tương thích bọc supervisor, `init` nền có `.catch`; có test |
| R-05 test supervisor | ✅ có test pack >500 dòng, vượt `WORKER_MAX_RESTARTS`, `REVISION_GAP`, lệch checksum (chưa có test riêng cho retry `SNAPSHOT_TIMEOUT` — không chặn) |
| Ownership / `any` / `ts-ignore` | ✅ |
| Handoff + log AI | ✅ `DATA-10.md`, `DATA-11.md` đã cập nhật |

### Lưu ý không chặn
- **N-01** `client.ts` `applyDelta`: chỉ cập nhật snapshot khi `lastEntriesSnapshot.length > 0` → nếu `init([])` rồi mới nhập dữ liệu, restart worker mất delta; mỗi delta còn tốn O(n) (filter + Map toàn bộ) — live mode 50k dòng nên giữ sẵn Map theo id.
- **N-02** `simulateWorkerFailure` export trong code production chỉ để test; nên đánh dấu `@internal`.
- **N-03** Sau khi `isDegraded`, các lần `save` sau chỉ ghi RAM, không thử lại localStorage — nên thử lại định kỳ.
- Còn từ vòng 1: L-01 (ghi CHANGE_REQUESTS mở rộng `AnalyticsWorkerApi`/manifest), L-02 (đưa `q.today` vào khoá cache dự báo), L-05.

### Điểm tốt
- Sửa đủ R-01…R-05 kèm test; ghi 2 pha + rollback + fallback RAM không làm mất dữ liệu.
- Prefix partition suy ra từ `key` (xử lý L-04), cảnh báo rõ ở nhánh tự cứu (L-03).
