# Handoff — DATA-04b · Nạp fixture thật BA-05 & đăng ký chiến dịch mẫu
- **Role:** `data-engineer`   **Người:** Huy · Gemini (Argon)   **Nhánh:** `feat/data-engineer/DATA-04b`   **Thời gian:** 2026-11-04 10:25
- **Contracts:** đã đọc `domain.ts` v1 và `docs/10_CONTRACTS.md §C` — không đổi chữ ký ✅

## Đã làm
- **Bỏ dữ liệu tạm dùng `toISOString`**:
  - Loại bỏ hoàn toàn vòng lặp sinh số liệu giả lập thủ công bằng `new Date().toISOString().slice(0, 10)` trong `loadMock`.
- **Nạp fixture thật của BA-05**:
  - `loadMock('demo-30d')`: Nạp 30 dòng dữ liệu chuẩn từ `@/fixtures/demo-30d.json` (chiến dịch `default`).
  - `loadMock('campaign-2y')`: Nạp 2.190 dòng dữ liệu chuẩn từ `@/fixtures/campaign-2y.json` (gồm 3 chiến dịch, 730 ngày).
  - `loadMock('edge-cases')`: Chạy từng mục qua `validateEntry(input, { today: item.context?.today })` và chỉ nhận các bản ghi hợp lệ (`res.ok === true`), sử dụng `value` đã được chuẩn hoá và loại bỏ triệt để các ca lỗi như E04 `clicks > reach`, số âm, sai ngày (R-01).
- **Đăng ký 3 chiến dịch mẫu vào store**:
  - Xuất hằng số `MOCK_CAMPAIGNS`:
    - `{ id: 'thoi-trang', name: 'Thời trang', createdAt: 0 }`
    - `{ id: 'my-pham', name: 'Mỹ phẩm', createdAt: 0 }`
    - `{ id: 'do-gia-dung', name: 'Đồ gia dụng', createdAt: 0 }`
  - Khi nạp `campaign-2y`, tự động bổ sung 3 chiến dịch mẫu này vào danh sách `campaigns` của store theo cơ chế merge (không làm mất chiến dịch người dùng đã có), giúp bộ chọn chiến dịch trên UI hiển thị chính xác tên người dùng thân thiện.
- **Tối ưu bundle với Dynamic Import**:
  - Sử dụng dynamic `import()` theo nhu cầu trong hàm async `loadMock`, tránh phình bundle Next.js ban đầu.

## File thay đổi
- `src/lib/data/store.ts`
- `src/lib/data/store.test.ts`
- `handoffs/DATA-04b.md`

## API / component công khai
```ts
export const MOCK_CAMPAIGNS: readonly Campaign[];
// Chữ ký giữ nguyên theo docs/10_CONTRACTS.md
loadMock(name: 'demo-30d' | 'campaign-2y' | 'edge-cases'): Promise<void>;
```

## Kiểm thử
- Lệnh: `npm run test -- src/lib/data/store.test.ts` → 8 passed / 0 failed.
- Toàn bộ suite: `npm run check` → 41 test files passed.
- Ca biên đã phủ:
  - `demo-30d` (30 dòng, chiến dịch default).
  - `campaign-2y` (2190 dòng, 3 chiến dịch mẫu).
  - `edge-cases` (R-02: xác thực chỉ nhận 4 mục hợp lệ sau dedupe, toàn bộ thoả `clicks <= reach` và các chỉ số >= 0, không có ID từ ca lỗi `expect.ok === false`).
  - `validateBatch` vượt qua 100% dữ liệu fixture `demo-30d` và `campaign-2y` (0 rejected).

## Cách dùng cho người nhận
- Component DataManager hoặc nút "Dùng dữ liệu mẫu" gọi `await useDataStore.getState().loadMock('demo-30d')` hoặc `await useDataStore.getState().loadMock('campaign-2y')`.

## Hạn chế / nợ kỹ thuật
- `edge-cases.json` là fixture chứa cả ca kiểm thử hợp lệ và không hợp lệ; `loadMock('edge-cases')` lọc và nạp các ca hợp lệ (`expect.ok === true`).

## Cần người khác làm
- Không có.

## Ghi chú dùng AI
- Trợ lý AI refactor chuyển từ sinh ngẫu nhiên sang lazy load fixture chuẩn của BA-05, lọc dữ liệu hợp lệ qua `validateEntry` và đăng ký 3 chiến dịch mẫu tương ứng.
- Dòng log (PM chép vào `docs/11_AI_USAGE_LOG.md` lúc merge):

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-04 | data-engineer | DATA-04b | Sửa R-01 & R-02: validateEntry cho edge-cases, test chặt clicks <= reach và loại trừ ID lỗi | Code + Test | Khắc phục format kết quả của validateBatch | src/lib/data/store.ts, src/lib/data/store.test.ts |
