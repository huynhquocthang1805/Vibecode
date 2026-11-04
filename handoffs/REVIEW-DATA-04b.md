# REVIEW — DATA-04b · `loadMock` dùng fixture thật + đăng ký 3 chiến dịch mẫu

## Vòng 1 — Verdict: ❌ REQUEST_CHANGES

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ Không có lỗi chặn (3 file, đúng ownership data-engineer) |
| `npm run check` (lint + typecheck + test) | ✅ 41 file pass, 3781 test pass, 8 expected-fail, 0 fail |
| `npm run build` | ✅ Xanh |
| Chữ ký `loadMock` / `domain.ts` | ✅ Giữ nguyên (docs/10 §B) |
| Không `any` / `ts-ignore` / `console.log` | ✅ |
| Handoff + dòng log AI | ✅ `handoffs/DATA-04b.md` |
| `demo-30d`: 30 dòng, chiến dịch `default` | ✅ Test có kiểm |
| `campaign-2y`: 2190 dòng, 3 chiến dịch | ✅ Fixture đúng 730 dòng/chiến dịch; test kiểm id + tên |
| `edge-cases`: nạp dữ liệu hợp lệ | ❌ Nạp cả bản ghi không hợp lệ (R-01) |
| Test có ca lỗi/ca biên | ❌ Test edge-cases quá lỏng (R-01) |

### Lỗi phải sửa

**R-01 — Cao — `src/lib/data/store.ts` (nhánh `edge-cases` trong `loadMock`), `src/lib/data/store.test.ts`**
`loadMock('edge-cases')` lấy mọi mục `kind === 'validate'` có `input.date` rồi đẩy thẳng vào store, **không xét `expect.ok`**.
Trong `src/fixtures/edge-cases.json` có khoảng 30 mục `expect.ok === false`. Ví dụ E04 có `clicks 1001 > reach 1000` (`CLICKS_GT_REACH`),
cùng các ca số âm, ngày tương lai, ngày sai định dạng.
Hậu quả: dữ liệu vi phạm validation vào thẳng store, checksum và rollup. Nhánh này bỏ qua `validateEntry`, nên CTR có thể > 100% hoặc ra số âm.
Handoff ghi "Nạp các bản ghi hợp lệ" nhưng code không làm vậy.
Cách sửa:
- Chỉ nạp mục có `expect.ok === true`, hoặc chạy từng `input` qua `validateEntry(raw, { today: item.context.today })` và chỉ giữ kết quả `ok`. Cách thứ hai bền hơn khi fixture đổi.
- Dùng `value` đã chuẩn hoá nếu validation trả về.
- Khóa dedupe `campaignId|date` hiện tại giữ lại.

**R-02 — Trung bình — `src/lib/data/store.test.ts`**
Test `edge-cases` chỉ kiểm `length > 0` và `checksum.rows === entries.length`, nên không bắt được R-01. Bổ sung:
- Mọi entry trong store thoả `clicks <= reach` và các chỉ số >= 0.
- Không entry nào có `id` nằm trong tập mục `expect.ok === false`.
- Số entry khớp số mục hợp lệ sau dedupe.

### Lưu ý không chặn
- `demo-30d` và `campaign-2y` cast `as DailyEntry[]` không qua Zod. Chấp nhận được vì fixture do BA-05 sinh, nhưng nên có một test chạy `validateBatch` trên chúng.
- `loadMock` chỉ thêm chiến dịch mà không dọn chiến dịch cũ. Hành vi này đúng ý (không mất chiến dịch người dùng), nên ghi rõ vào handoff.
- Handoff ghi "Hạn chế: Không có". Sau khi sửa R-01 thì mô tả `edge-cases` cần khớp code.

### Điểm tốt
- Dynamic `import()` fixture, không làm phình bundle ban đầu.
- Bỏ hẳn `toISOString` và dữ liệu tạm.
- `MOCK_CAMPAIGNS` export rõ ràng, merge theo `id` nên không trùng lặp.
- Giữ `clearUndo()` (R-01 cũ) và luồng delta/revision/checksum.

## Vòng 2 — Verdict: ✅ APPROVE

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ Không có lỗi chặn (4 file, đúng ownership data-engineer) |
| `npm run check` (lint + typecheck + test) | ✅ 42 file pass, 3782 test pass, 11 expected-fail, 0 fail |
| `npm run build` | ✅ Xanh |
| Chữ ký `loadMock` / `domain.ts` | ✅ Giữ nguyên |
| Không `any` / `ts-ignore` / `console.log` | ✅ |
| R-01 (edge-cases nạp bản ghi không hợp lệ) | ✅ Đã sửa: chạy `validateEntry(input, { today })`, chỉ giữ `ok`, dùng `value` chuẩn hoá, dedupe `campaignId\|date` (`store.ts`) |
| R-02 (test edge-cases lỏng) | ✅ Test kiểm đúng 4 entry, `clicks <= reach`, các chỉ số >= 0 |
| `validateBatch` trên demo-30d / campaign-2y | ✅ Thêm test: 0 rejected |
| Handoff + dòng log AI | ✅ Đã cập nhật khớp code |

### Lưu ý không chặn
- Assert "không có ID từ ca lỗi" so `e.id` (dạng `campaignId|date`) với `id` mục fixture (dạng `E04`) nên luôn đúng, không kiểm thật. Assert đếm 4 entry và `clicks <= reach` đã đủ bắt R-01; nên đổi sang so khoá `campaignId|date` của các input `ok === false`.
- `loadMock` chỉ merge chiến dịch, không dọn chiến dịch cũ — đúng ý, nên ghi vào handoff.

### Điểm tốt
- Sửa đúng nguyên nhân gốc, dùng lại `validateEntry` thay vì lọc thủ công.
- Dynamic `import()` fixture, không phình bundle ban đầu.
- Giữ `clearUndo()` và luồng delta/revision/checksum.
