# REVIEW — DATA-05 · DATA-06 · DATA-07 (PR #4) — REQUEST_CHANGES

## Vòng 1

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ không có lỗi chặn |
| `npm run check` | ✅ lint + typecheck sạch; 18 file test, 3639 pass, 8 expected fail, 0 fail |
| `npm run build` | ✅ |
| Ownership | ✅ chỉ sửa `lib/data`, `lib/workers`, handoff của data-engineer |
| Hợp đồng `docs/10_CONTRACTS.md` | ✅ chữ ký giữ nguyên |
| Không `any`/`ts-ignore`/`console.log` | ✅ |
| Test nhánh lỗi/ca biên | ⚠️ engine, rollup, import có; **hook `useAnalytics` không có test** |
| Realtime incremental (CLAUDE.md §1) | ❌ hook không dùng `applyDelta` (R-02) |
| Gọi từ UI thật | ❌ vòng lặp vô hạn với `DashboardPage` (R-01) |

### Lỗi phải sửa

**R-01 (Cao) — `src/lib/workers/useAnalytics.ts` (effect deps `q`)**
`DashboardPage.tsx:51` truyền object literal mới mỗi lần render. `q` nằm trong deps nên effect chạy lại sau mỗi render. Mỗi lần xong `setData(snap)` lại tạo snapshot mới → re-render → effect chạy lại → snapshot lại, lặp mãi (mỗi ~50ms + thời gian tính). Hậu quả: CPU 100% và biểu đồ nhấp nháy. Test không bắt được vì không test hook.
Cách sửa: dùng khoá ổn định, ví dụ `const qKey = JSON.stringify(q)` làm dep (hoặc so sánh từng field), và giữ `q` qua ref.

**R-02 (Cao) — `useAnalytics.ts`: không incremental**
Hook chỉ `init(entries)` một lần. Mọi thay đổi sau đó đều đi qua nhánh "checksum lệch" rồi `init(entries)` lại, tức rebuild O(n) mỗi lần, và `snapshot` bị tính 2 lần. `applyDelta` và `REVISION_GAP` không được dùng ở đâu. Với 50k dòng thì mỗi lần nhập một dòng đều rebuild toàn bộ.
Cách sửa: lấy delta từ store (hoặc từ `bus`, hoặc so `revision`) và gọi `client.applyDelta(delta, revision)`. Bắt `REVISION_GAP` thì mới `init` lại. Giữ checksum làm lưới an toàn cuối. Nếu store chưa phát delta thì ghi CHANGE_REQUEST cho techlead, đừng bỏ qua.

**R-03 (Trung bình) — `src/lib/data/store.ts` `importBatch` (E38)**
Nhận diện hàng tổng bằng `includes('sum'|'total'|'tong')` trên cả `date` lẫn `campaignId`. Chiến dịch tên "Summer Sale", "Consumer…", "Totally…", "Tongue…" bị bỏ lặng lẽ (chỉ có warning) → mất dữ liệu thật.
Cách sửa: so khớp theo từ nguyên vẹn, ví dụ regex `^(tổng|tong|total|sum|grand total)(\s+cộng)?$` đã chuẩn hoá. Chỉ kiểm cột `date` (và `campaign` khi bằng đúng từ khoá). Thêm test: campaign "Summer Sale" vẫn được nhận.

**R-04 (Trung bình) — `useAnalytics.ts`: thiếu test**
Hợp đồng nêu rõ latest-wins, debounce, tự chữa lệch, không throw. Chưa có test nào cho hook (Testing Library `renderHook`). Cần ít nhất: q ổn định không lặp, thay đổi store → gọi `applyDelta` (không `init`), lỗi worker → `error` mà không throw, kết quả cũ bị bỏ khi có request mới.

**R-05 (Thấp) — `src/lib/workers/client.ts`**
Chỉ fallback khi *khởi tạo* Worker lỗi. Worker chết hoặc treo lúc chạy thì `snapshot` reject/treo mãi và không có timeout. Supervisor đầy đủ thuộc DATA-11 nên không chặn, nhưng cần thêm timeout tối thiểu hoặc ghi rõ trong handoff.

**R-06 (Thấp) — `rollup.ts` checksum khi bỏ qua ngày < 2015**
`buildRollups` tính `checksum.rows = entries.length` và cộng cả dòng bị `continue` (d < 0), còn `applyDelta` thì không cộng. Hai bên lệch nhau và gây self-heal vô tận. Cho cả hai cùng bỏ qua hoặc cùng đếm. `firstDay/lastDay` cũng không được tính lại sau khi xoá, nên `dataSpan` có thể sai.

### Lưu ý không chặn
- `csv.ts` đọc cả file vào bộ nhớ, tách dòng bằng `split(/\r?\n/)` nên field có xuống dòng trong ngoặc kép bị vỡ, và Papaparse chạy trên main thread (không worker/chunk như docs). Chấp nhận được cho P1, nên ghi vào handoff.
- `autoMapHeaders` khớp theo chuỗi con (`don`, `day`, `nhap`). Header như "CPC (Chi phí trên mỗi lượt nhấp)" hoặc "Chi phí / đơn hàng" có thể bị ánh xạ nhầm nếu đứng trước cột thật. Nên ưu tiên khớp chính xác và để người dùng chỉnh mapping ở FI-03.
- `getSeries` chặn cứng 10.000 bucket mà không báo (≈ 27 năm theo ngày). Nên đưa vào `LIMITS` hoặc phát cảnh báo.

### Điểm tốt
- Rollup mảng dày Float64Array, `applyDelta` O(|delta|), KPI tính từ tổng.
- like-for-like (CR-003) đúng ý, có test nhiều ca biên.
- Worker engine tách `createAnalyticsEngine` nên test được trên main thread và có fallback.
- Import có BOM, windows-1258, tự dò delimiter và dòng header, có test abort.
- Handoff đầy đủ cho 3 task.

---

## Vòng 2 — APPROVE

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ không có lỗi chặn |
| `npm run check` | ✅ lint + typecheck sạch; 19 file test, 3644 pass, 8 expected fail, 0 fail |
| `npm run build` | ✅ |
| Ownership / hợp đồng | ✅ chỉ sửa `lib/data`, `lib/workers`; chữ ký giữ nguyên |
| R-01 vòng lặp vô hạn | ✅ dùng `qKey` ổn định + `qRef`; có test |
| R-02 incremental | ✅ nghe `bus 'entries/changed'` → `applyDelta`; chỉ `init` khi lỗi/`REVISION_GAP`; có test |
| R-03 hàng tổng | ✅ regex khớp từ nguyên vẹn; test "Summer Sale"/"Consumer Goods" |
| R-04 test hook | ✅ 4 test (q ổn định, applyDelta, lỗi không throw, REVISION_GAP) |
| R-05 timeout | ✅ `SNAPSHOT_TIMEOUT_MS` bọc `snapshot` |
| R-06 checksum/bounds | ✅ `buildRollups` chỉ đếm dòng hợp lệ; `recalculateBounds` sau khi xoá |

### Lưu ý không chặn
- Thiếu test riêng cho: latest-wins của hook, `SNAPSHOT_TIMEOUT`, và `recalculateBounds`/checksum bỏ ngày < 2015. Bổ sung ở QA-02 hoặc DATA-11.
- `recalculateBounds` quét O(capacity) mỗi lần xoá, không còn O(|delta|) khi xoá hàng loạt trên dữ liệu lớn; xem lại ở DATA-11/perf.
- Nhiều instance `useAnalytics` dùng chung một client singleton: mỗi instance đều `applyDelta` nên instance sau gặp `REVISION_GAP` và `init` lại (đúng nhưng tốn). Nên gom về một subscriber ở DATA-11.
- Timeout chỉ bọc `snapshot`; supervisor restart worker thuộc DATA-11.
- Các lưu ý vòng 1 về `csv.ts` (đọc cả file, chưa worker/chunk), `autoMapHeaders` khớp chuỗi con, giới hạn 10.000 bucket vẫn còn hiệu lực.
- PR có cả code DATA-06 (worker + `useAnalytics`) nhưng PR guard chỉ ghi DATA-05, DATA-07; PM kiểm tra trạng thái DATA-06 trong `TASKS.md`.

### Điểm tốt
- Sửa đủ 6 lỗi vòng 1, các lỗi quan trọng đều có test kèm theo.
- Tự chữa lệch nhiều lớp: `REVISION_GAP` → init, lỗi khác → init, checksum lệch → init.
