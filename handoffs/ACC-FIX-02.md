# ACC-FIX-02 — Database chạy được trên Vercel (migration tự động)

Người làm: Thắng (techlead) · Claude · 2026-11-06 · nhánh `feat/techlead/ACC-FIX-02`

## Kiểm tra
Môi trường cloud không gọi được `vibecode-three-xi.vercel.app` (proxy chặn) → kiểm bằng bản build production + **DB thật PGlite** (Postgres WASM, cùng schema/migration với Neon).

Luồng tài khoản trên `next start` với `DATABASE_URL=pglite://memory` — **18/18 đạt**:
đăng ký 200 · phiên · hồ sơ GET/PUT (tiếng Việt) · data GET 204 → PUT rev 1 → PUT baseRevision 0 → **409 CONFLICT** kèm `server` · state hỏng 400 · avatar PNG 200 (`?v=1`, `image/png`) · SVG đội lốt PNG **415** · đăng xuất → profile **401** · đăng nhập lại 200 · sai mật khẩu 401 (UI dịch "Email hoặc mật khẩu không chính xác.") · xoá tài khoản 204 → đăng nhập lại 401.
Không có `db.transaction` trong code tài khoản; better-auth mặc định `transaction: false` → chạy được trên driver neon-http.

## Lỗi chặn đã sửa
| Lỗi | Hậu quả | Sửa |
|---|---|---|
| `drizzle.config.ts` thiếu `dbCredentials` → `npm run db:migrate` lỗi "connection url is required" | Bật Neon xong **không có bảng** → đăng ký 500 | Thêm `dbCredentials.url` + đọc `.env.local` khi chạy tay |
| Không có bước migrate tự động trên Vercel (client chỉ tự migrate PGlite) | Phải chạy tay từ máy có chuỗi kết nối Neon | `scripts/db-migrate.mjs` chạy trong `npm run build`: không DB → bỏ qua · PGlite bộ nhớ → bỏ qua · PGlite thư mục / Neon → migrate (idempotent, lần 2 áp 0). Lỗi → build đỏ, Vercel giữ bản cũ. Không in chuỗi kết nối |

Đã thử: 6 nhánh URL của script · build có DB (`[db-migrate] đã áp 1 migration`, đủ 6 bảng: account, profile, session, user, user_data, verification) rồi app chạy trên DB đó (đăng ký 200) · build không DB (CI) · 4.173 test · E2E 44/44.
Có `BETTER_AUTH_SECRET` lúc build thì log `BetterAuthError` biến mất.

## Bật trên Vercel (ACC-07 — Thắng)
1. Vercel → project **vibecode** → **Storage** → **Create Database** → **Neon** (gói Free) → **Connect** vào project, tick Production + Preview → Vercel tự thêm `DATABASE_URL`.
2. **Settings → Environment Variables**: `BETTER_AUTH_SECRET` = `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` · `BETTER_AUTH_URL` = `https://vibecode-three-xi.vercel.app`.
3. **Redeploy** → log build phải có `[db-migrate] Neon: đã áp 1 migration mới (tổng 1)`.
4. Thử: mở `https://vibecode-three-xi.vercel.app/api/account/profile` → `401` (chưa đăng nhập) là **DB đã bật** (`503 NOT_CONFIGURED` = chưa). Trên web: Đăng nhập → Tạo tài khoản → đổi tên/avatar → reload vẫn đăng nhập.

## Cần người khác làm
- **Huy**: review `scripts/db-migrate.mjs`, `drizzle.config.ts`; ACC-FIX-01 vẫn mở (khởi tạo auth lười).

## Log AI
| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-06 | techlead | ACC-FIX-02 | Chạy luồng tài khoản 18 bước trên DB thật, phát hiện migrate hỏng, viết script migrate trong build | test+fix | Lint chặn `console.log` trong script → đổi `process.stdout.write` | scripts/db-migrate.mjs, drizzle.config.ts, package.json |
