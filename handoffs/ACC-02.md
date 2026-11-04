# Handoff — ACC-02 · better-auth server + /api/auth/[...all] + requireUser + rate limit (A2–A5)
- **Role:** data-engineer   **Người:** Huy · Gemini Argon   **Nhánh:** feat/data-engineer/ACC-01-ACC-02   **Thời gian:** 2026-11-04 18:10
- **Contracts:** đã đọc `domain.ts` — không đổi chữ ký ✅

## Đã làm
- Cấu hình server `better-auth` trong `src/lib/server/auth.ts`:
  - Drizzle adapter kết nối qua `getDb()` và `schema`.
  - Email/Password authentication với `minPasswordLength: LIMITS_ACCOUNT.PASSWORD_MIN` (8).
  - Tích hợp rate limiting (10 requests/phút/IP) cho sign-in và sign-up theo `LIMITS_ACCOUNT.LOGIN_RATE_PER_MIN`.
  - Hỗ trợ IP address headers (`x-forwarded-for`, `x-real-ip`).
  - Hỗ trợ Google social provider tuỳ chọn khi có `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`.
  - Helper `requireUser(req: Request)`: kiểm tra phiên từ cookie headers, trả `{ id, email }` hoặc Response 401 tiếng Việt (`AccountError`), hoặc 503 khi chưa cấu hình.
- Tạo client `better-auth` trong `src/lib/auth-client.ts` qua `createAuthClient()`.
- Cập nhật route handler `/api/auth/[...all]/route.ts`:
  - Trả 503 `NOT_CONFIGURED` khi chưa cấu hình `DATABASE_URL` / `BETTER_AUTH_SECRET`.
  - Đảm bảo migration sẵn sàng (`ensureMigrated()`) trước khi dispatch qua `auth.handler(req)`.
- Viết integration test suite `src/app/api/auth/auth.test.ts` trên PGlite bao phủ đầy đủ tiêu chí A1–A5:
  - A1: thiếu env → 503 `NOT_CONFIGURED`.
  - A2: đăng ký email mới → nhận cookie phiên → requireUser xác thực thành công.
  - A3: mật khẩu < 8 (400), email sai định dạng (400), email trùng (422), sai mật khẩu không lộ email tồn tại (401).
  - A4: 11 lần đăng nhập sai / phút từ cùng IP → 429 RATE_LIMITED.
  - A5: đăng xuất → phiên bị huỷ, requireUser trả 401.

## File thay đổi
- `src/lib/server/auth.ts`
- `src/lib/auth-client.ts`
- `src/app/api/auth/[...all]/route.ts`
- `src/app/api/auth/auth.test.ts`
- `handoffs/ACC-02.md`

## API / component công khai
```ts
export const auth: ReturnType<typeof betterAuth>;
export function requireUser(req: Request): Promise<{ id: string; email: string } | Response>;
export const authClient: ReturnType<typeof createAuthClient>;
```

## Kiểm thử
- Lệnh: `npx vitest run src/app/api/auth/auth.test.ts` → 5 passed / 0 failed
- Nghiệm thu:
  - A1: 503 NOT_CONFIGURED khi thiếu biến môi trường.
  - A2: Đăng ký thành công, sinh session token cookie và đọc lại phiên.
  - A3: Bắt lỗi validation mật khẩu / email, không rò rỉ thông tin người dùng.
  - A4: Rate limit kích hoạt ở lần thứ 11 trả 429.
  - A5: Đăng xuất huỷ phiên và chặn truy cập trái phép.

## Cách dùng cho người nhận
- Trong các route handler `/api/account/*`, gọi `const userOrRes = await requireUser(req); if (userOrRes instanceof Response) return userOrRes;` để xác thực người dùng.
- Trong React component client, dùng `authClient.useSession()`, `authClient.signIn.email()`, `authClient.signUp.email()`, `authClient.signOut()`.

## Hạn chế / nợ kỹ thuật
- Không có.

## Cần người khác làm
- Không có.

## Ghi chú dùng AI
- AI chú ý cấu hình rate limit đúng theo định dạng của better-auth `storage: 'memory'` và `customRules`, tránh tạo thêm bảng DB không cần thiết và đáp ứng chuẩn A4.
- Dòng log (PM chép vào `docs/11_AI_USAGE_LOG.md` lúc merge):

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-04 18:10 | data-engineer | ACC-02 | Tích hợp better-auth server, requireUser, rate limit, authClient, route handler | feat | Không có | src/lib/server/auth.ts, src/app/api/auth/[...all]/route.ts |

