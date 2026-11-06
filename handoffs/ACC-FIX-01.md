# Handoff — ACC-FIX-01 · Khởi tạo lười betterAuth() trong lib/server/auth.ts
- **Role:** data-engineer   **Người:** Huy · Gemini (Argon)   **Nhánh:** feat/data-engineer/DATA-FIX-03-ACC-FIX-01   **Thời gian:** 2026-11-06 23:15
- **Contracts:** đã đọc `domain.ts` & `docs/10_CONTRACTS.md §I` — không đổi chữ ký `export const auth` ✅

## Đã làm
- Sửa `src/lib/server/auth.ts`:
  - Chuyển khởi tạo `betterAuth(...)` vào hàm lười `getAuth()`, chỉ tạo instance khi `accountConfigured() === true` (có đủ `DATABASE_URL` và `BETTER_AUTH_SECRET`).
  - Giữ nguyên hợp đồng `export const auth: ReturnType<typeof betterAuth>` thông qua `Proxy` chuyển tiếp thuộc tính và bind hàm sang instance thực tế.
  - Bỏ fallback secret cứng lúc import; đặt `baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000'` khi khởi tạo để không phát sinh cảnh báo `WARN [Better Auth]: Base URL is not set`.
  - Khi chạy `npm run build` hoặc import route ở chế độ khách (chưa cấu hình DB/auth), `betterAuth()` hoàn toàn không bị gọi, không còn in `BetterAuthError: You are using the default secret` hay cảnh báo `baseURL` (đúng yêu cầu `docs/14 §1.2`).
- Bổ sung unit test trong `src/app/api/auth/auth.test.ts` xác minh `auth` khởi tạo lười qua `Proxy` và ném `ACCOUNT_NOT_CONFIGURED` nếu truy cập trực tiếp khi chưa cấu hình.

## File thay đổi
- `src/lib/server/auth.ts`
- `src/app/api/auth/auth.test.ts`

## API / component công khai
```ts
export const auth: ReturnType<typeof betterAuth>;
export function requireUser(req: Request): Promise<{ id: string; email: string } | Response>;
```

## Kiểm thử
- Lệnh: `npx vitest run src/app/api/auth/auth.test.ts src/app/api/account/account.test.ts` → 13 passed / 0 failed (sạch cảnh báo `Base URL is not set`).
- Lệnh: `npm run build` → xanh, im lặng hoàn toàn khi không có `DATABASE_URL` / `BETTER_AUTH_SECRET`.

## Cách dùng cho người nhận
- Mọi route `/api/auth/[...all]` và `/api/account/*` tiếp tục kiểm tra `if (!accountConfigured()) return notConfiguredResponse();` trước khi gọi `auth` hoặc `requireUser`.

## Hạn chế / nợ kỹ thuật
- Không có.

## Cần người khác làm
- Techlead / PM: Review và merge PR.

## Ghi chú dùng AI
- Dòng log (PM chép vào `docs/11_AI_USAGE_LOG.md` lúc merge):

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-06 23:15 | data-engineer | ACC-FIX-01 | Khởi tạo lười betterAuth() qua Proxy khi accountConfigured() | Sửa lỗi + test | Không có lỗi phát sinh | `src/lib/server/auth.ts`, `src/app/api/auth/auth.test.ts` |

