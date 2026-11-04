# Handoff — ACC-06 · Test: unit + integration route trên PGlite (A1–A11) + E2E tests/e2e/account.spec.ts; g1-smoke vẫn xanh khi không có DB
- **Role:** data-engineer   **Người:** Huy · Gemini Argon   **Nhánh:** feat/data-engineer/ACC-03-ACC-06   **Thời gian:** 2026-11-04 18:35
- **Contracts:** đã đọc `domain.ts` v1.0.0 — không đổi chữ ký ✅

## Đã làm
- **Kiểm thử Unit & Integration trên PGlite (Bộ tiêu chí nghiệm thu A1–A11)**:
  - `src/lib/server/accountConfig.test.ts`: Kiểm tra phát hiện cấu hình và trả lỗi 503 khi chưa có env DB (A1).
  - `src/lib/server/db/client.test.ts`: Khởi tạo Drizzle trên PGlite, kiểm tra nạp đủ 6 bảng, migration tự động và cascade xoá user (A1, A11).
  - `src/app/api/auth/auth.test.ts`: Tích hợp `better-auth` với PGlite: đăng ký/đăng nhập/đăng xuất (A2), kiểm tra mật khẩu ngắn, email sai định dạng, email trùng lặp, không rò rỉ email khi đăng nhập sai (A3), giới hạn tốc độ 10 lần sai/phút trả về 429 RATE_LIMITED (A4), kiểm tra vô hiệu hoá token sau khi đăng xuất trả về 401 (A5).
  - `src/app/api/account/account.test.ts`: Kiểm tra toàn bộ luồng route tài khoản trên PGlite thật: lấy/sửa profile với giới hạn độ dài và ký tự điều khiển (A6), upload avatar nhận định dạng PNG/JPEG/WebP ≤ 200 KB, từ chối SVG/file giả mạo/> 200 KB (A7), bảo mật chỉ chủ sở hữu xem được avatar nhị phân (A8), đồng bộ cloud phát hiện xung đột 409 khi baseRevision bị lệch và chấp nhận bản cập nhật mới (A9), từ chối state hỏng 400 hoặc payload > 4 MB 413 mà không ảnh hưởng DB (A10), xoá tài khoản xác nhận chuỗi "XOÁ" kích hoạt cascade dọn sạch DB (A11).
  - `src/lib/data/storage/userStorage.test.ts`: Kiểm tra phân vùng localStorage theo `userId` và di chuyển dữ liệu khách sang tài khoản.
  - `src/components/account/accountUi.test.tsx`: Kiểm tra UI ánh xạ lỗi tiếng Việt và tương tác giải quyết xung đột `ConflictDialog`.
- **Kiểm thử E2E Playwright (`tests/e2e/account.spec.ts`)**:
  - A1: Xác nhận khi ứng dụng không có cấu hình DB (`DATABASE_URL` thiếu), toàn bộ API `/api/account/*` và `/api/auth/*` trả về đúng chuẩn `503 NOT_CONFIGURED`, hoàn toàn không gây sập ứng dụng hay ném lỗi unhandled rejection.
  - A1: Khách không đăng nhập vẫn sử dụng trơn tru đầy đủ 5 tính năng cốt lõi P0 (nhập liệu, hiển thị biểu đồ, tính KPI, sinh nhận xét, xuất báo cáo).
  - A12: Kiểm tra viewport di động 375 px trên cả trình duyệt máy tính (Chromium) và thiết bị di động giả lập (iPhone 12) đảm bảo không bị tràn ngang (`scrollWidth === innerWidth`), các nút thao tác menu đạt chuẩn chạm tối thiểu.
- **Bảo đảm tính độc lập của P0**:
  - `tests/e2e/g1-smoke.spec.ts` chạy xanh 100% trong môi trường không có DB.

## File thay đổi
- `src/app/api/account/account.test.ts`
- `src/lib/data/storage/userStorage.test.ts`
- `src/components/account/accountUi.test.tsx`
- `tests/e2e/account.spec.ts`
- `handoffs/ACC-06.md`

## API / component công khai
- Toàn bộ test suite được đăng ký vào lệnh chuẩn `npm run test` và `npx playwright test`.

## Kiểm thử
- Lệnh Vitest: `npm run test`
  - Kết quả: **53 test files passed (3842 passed, 11 expected fail, 0 failed)**
- Lệnh Playwright Account: `npx playwright test tests/e2e/account.spec.ts`
  - Kết quả: **6 passed (12.5s)** trên cả Chromium Desktop và Mobile Safari (iPhone 12).
- Lệnh Playwright Smoke: `npx playwright test tests/e2e/g1-smoke.spec.ts`
  - Kết quả: **14 passed (21.9s)** xanh 100%.

## Cách dùng cho người nhận
- Chạy `npm run check` để chạy linter, typecheck và toàn bộ unit/integration test.
- Chạy `npx playwright test` để chạy toàn bộ kiểm thử E2E.

## Hạn chế / nợ kỹ thuật
- Không có.

## Cần người khác làm
- Không có.

## Ghi chú dùng AI
- Dòng log (PM chép vào `docs/11_AI_USAGE_LOG.md` lúc merge):

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-04 18:35 | data-engineer | ACC-06 | Viết test suite A1–A11 trên PGlite và test E2E Playwright A1, A12 | test | Chạy sign-up lặp lại trong test làm dính rate limit; sửa dynamic IP/email để cô lập | src/app/api/account/account.test.ts |
