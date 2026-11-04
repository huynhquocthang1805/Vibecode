# Handoff — ACC-03 · Hồ sơ + avatar (magic bytes, ≤ 200 KB, cấm SVG) + xoá tài khoản (A6–A8, A11)
- **Role:** data-engineer   **Người:** Huy · Gemini Argon   **Nhánh:** feat/data-engineer/ACC-03-ACC-06   **Thời gian:** 2026-11-04 18:35
- **Contracts:** đã đọc `domain.ts` v1.0.0 — không đổi chữ ký ✅

## Đã làm
- **Hồ sơ người dùng (`/api/account/profile`)**:
  - `GET`: Yêu cầu phiên đăng nhập (`requireUser`), trả về `UserProfile` (id, email, name, avatarUrl, createdAt).
  - `PUT`: Cập nhật tên hiển thị (`name`), giới hạn tối đa 50 ký tự, loại bỏ ký tự điều khiển (control chars) tránh XSS/injection.
- **Tải lên & quản lý Avatar (`/api/account/avatar`)**:
  - `POST`: Nhận file multipart `file`, kiểm tra dung lượng ≤ 200 KB.
  - Kiểm tra định dạng qua magic bytes nhị phân trong `src/lib/server/accountHelper.ts`: hỗ trợ PNG (`89 50 4E 47`), JPEG (`FF D8 FF`), WebP (`RIFF...WEBP`). Từ chối tuyệt đối SVG hoặc file giả mạo extension.
  - Giới hạn tần suất 10 lần tải/phút trên mỗi người dùng.
  - Lưu nhị phân vào cột `avatar` (bytea), tự tăng `avatarVersion` để cache busting.
  - `DELETE`: Xoá avatar khỏi hồ sơ (`avatar = null`), trả về profile mới.
- **Phục vụ Avatar nhị phân (`/api/account/avatar/[userId]`)**:
  - `GET`: Chỉ cho phép người dùng chính chủ xem avatar của chính họ (trả 404 Not Found nếu người khác truy cập theo đặc tả bảo mật). Trả nhị phân kèm header `Cache-Control: private, max-age=31536000, immutable` và `X-Content-Type-Options: nosniff`.
- **Xoá tài khoản (`/api/account`)**:
  - `DELETE`: Yêu cầu body `{ confirm: "XOÁ" }`. Kiểm tra chính xác chuỗi xác nhận, xoá bản ghi người dùng trong bảng `user`. Kích hoạt cơ chế CASCADE tự động dọn sạch hồ sơ, phiên làm việc, tài khoản OAuth và dữ liệu lưu trữ đám mây. Trả về `204 No Content`.

## File thay đổi
- `src/lib/server/accountHelper.ts`
- `src/app/api/account/profile/route.ts`
- `src/app/api/account/avatar/route.ts`
- `src/app/api/account/avatar/[userId]/route.ts`
- `src/app/api/account/route.ts`
- `handoffs/ACC-03.md`

## API / component công khai
```ts
// GET /api/account/profile -> UserProfile
// PUT /api/account/profile -> Body: { name?: string } -> UserProfile
// POST /api/account/avatar -> FormData file -> UserProfile
// DELETE /api/account/avatar -> UserProfile
// GET /api/account/avatar/[userId] -> Binary image (private cache)
// DELETE /api/account -> Body: { confirm: "XOÁ" } -> 204 No Content
```

## Kiểm thử
- Lệnh: `npx vitest run src/app/api/account/account.test.ts` → 6 passed / 0 failed
- Ca kiểm thử:
  - A6: GET profile trả thông tin người dùng và PUT sửa tên (chặn tên > 50 ký tự, lọc ký tự điều khiển).
  - A7: POST avatar nhận PNG/JPEG/WebP ≤ 200 KB, từ chối file > 200 KB, từ chối SVG và file giả danh PNG.
  - A8: GET avatar bởi chính chủ thành công; user B truy cập URL avatar của user A bị 404.
  - A11: Xoá tài khoản từ chối nếu không gõ đúng "XOÁ"; xoá thành công kích hoạt cascade xoá toàn bộ dữ liệu.

## Cách dùng cho người nhận
- Dùng qua hook `useAccount` hoặc gọi trực tiếp fetch API có kèm cookie phiên `better-auth`.

## Hạn chế / nợ kỹ thuật
- Không có.

## Cần người khác làm
- Không có.

## Ghi chú dùng AI
- Dòng log (PM chép vào `docs/11_AI_USAGE_LOG.md` lúc merge):

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-04 18:35 | data-engineer | ACC-03 | Xây dựng API profile, avatar magic bytes và xoá tài khoản xác nhận | feat | Không có | src/app/api/account/profile/route.ts, src/app/api/account/avatar/route.ts, src/app/api/account/route.ts |
