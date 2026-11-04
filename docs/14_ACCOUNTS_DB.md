# 14 — Tài khoản, hồ sơ, avatar & database (CR-005)

Owner: `techlead` (đặc tả) · triển khai: **Huy** (`data-engineer`, task ACC-01..ACC-06). Kiểu: `src/types/domain.ts` (mục "Tài khoản & đồng bộ").
Quyết định chủ dự án 2026-11-04: thêm tài khoản thật có server, làm song song với Gate G1. **Không được làm hỏng P0** (CLAUDE.md §8).

## 1. Nguyên tắc bắt buộc
1. **Local-first, khách vẫn dùng đủ 5 tính năng P0**: không đăng nhập vẫn nhập liệu, xem KPI, AI, xuất báo cáo như cũ (localStorage là yêu cầu đề bài). Tài khoản chỉ **thêm**: hồ sơ + avatar + đồng bộ dữ liệu lên server.
2. **Thiếu cấu hình không được crash**: chưa có `DATABASE_URL` / `BETTER_AUTH_SECRET` → mọi API tài khoản trả `503 NOT_CONFIGURED`, UI ẩn nút đăng nhập, hiện "Tài khoản chưa bật trên máy chủ". Build (`npm run build`) **không** cần DB.
3. Secret chỉ ở server (`process.env.*`, không `NEXT_PUBLIC_`). Không log mật khẩu, token, cookie, nội dung dữ liệu KPI.
4. Mọi input server qua **Zod** trước. Mọi lỗi trả `AccountError` (tiếng Việt).

## 2. Stack (đã cài ở ACC-00)
| Việc | Thư viện | Ghi chú |
|---|---|---|
| Đăng nhập / phiên | `better-auth` 1.7 | Email + mật khẩu (băm sẵn, scrypt) · Google OAuth **tuỳ chọn** khi có `GOOGLE_CLIENT_ID/SECRET` · phiên lưu DB, cookie `httpOnly; Secure; SameSite=Lax` · kiểm Origin chống CSRF |
| ORM + migration | `drizzle-orm` 0.45 + `drizzle-kit` (dev) | Schema TypeScript → SQL migration trong `drizzle/` (commit) |
| DB production | Postgres (Neon) qua `@neondatabase/serverless` | Vercel → Storage/Marketplace → Neon → tự set `DATABASE_URL` |
| DB test / E2E | `@electric-sql/pglite` (Postgres WASM trong tiến trình) | `DATABASE_URL=pglite://memory` hoặc `pglite://./.pglite` → CI không cần DB ngoài |
| Avatar | **Lưu trong Postgres** (`bytea`) | Không dịch vụ file riêng; ảnh đã nén ≤ 200 KB |

`npm audit`: 4 cảnh báo *moderate* nằm trong `drizzle-kit` (esbuild cũ, chỉ CLI dev, không vào bundle) — chấp nhận.

## 3. Schema (Postgres)
Bảng của better-auth (sinh bằng `npx @better-auth/cli generate` hoặc viết tay theo docs better-auth cho Drizzle): `user`, `session`, `account`, `verification`. Thêm 2 bảng riêng:
```ts
// src/lib/server/db/schema.ts
profile:   userId (PK, FK user.id ON DELETE CASCADE) · displayName varchar(60) · company varchar(80) null
           jobTitle varchar(60) null · avatar bytea null · avatarType varchar(16) null · avatarVersion int default 0
           updatedAt timestamptz
user_data: userId (PK, FK user.id ON DELETE CASCADE) · state text (chuỗi encodeState — codec cột của DATA-03)
           revision int · rows int · bytes int · updatedAt timestamptz
```
Xoá tài khoản → cascade xoá hết (quyền được xoá dữ liệu).

## 4. API (route handlers, `runtime` mặc định — KHÔNG `export const runtime`, xem R-01 PR #3)
| Route | Method | Vào | Ra |
|---|---|---|---|
| `/api/auth/[...all]` | * | better-auth (`toNextJsHandler`) | đăng ký, đăng nhập, đăng xuất, phiên |
| `/api/account/profile` | GET | — (cần phiên) | `UserProfile` |
| | PUT | `ProfilePatch` (Zod: trim, độ dài theo `LIMITS_ACCOUNT`, bỏ ký tự điều khiển) | `UserProfile` |
| `/api/account/avatar` | POST | `multipart/form-data` field `file` | `UserProfile` (avatarUrl mới, `avatarVersion+1`) |
| | DELETE | — | `UserProfile` (avatarUrl = null) |
| `/api/account/avatar/[userId]` | GET | — | ảnh, `Cache-Control: private, max-age=31536000, immutable` (URL có `?v=`), `X-Content-Type-Options: nosniff`; chỉ chủ tài khoản xem được |
| `/api/account/data` | GET | — | `{ meta: CloudSnapshotMeta, state: string } \| 204` (chưa có) |
| | PUT | `{ state: string, baseRevision: number }` | `CloudSnapshotMeta` · `baseRevision ≠ revision hiện tại` → **409 CONFLICT** kèm `server` meta |
| `/api/account` | DELETE | `{ confirm: "XOÁ" }` | 204 — xoá tài khoản + dữ liệu |

Kiểm tra bắt buộc:
- **Avatar**: xác định loại bằng **magic bytes** (không tin `Content-Type`): PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF....WEBP`; ≤ `AVATAR_MAX_BYTES` → sai `415 UNSUPPORTED_MEDIA` / `413`. **Cấm SVG** (XSS). Client nén về 256×256 bằng canvas (đồng thời xoá EXIF/GPS) trước khi gửi.
- **Data**: `state` ≤ `CLOUD_MAX_BYTES` (413); phải `decodeState` được (400 nếu hỏng) — server không tin client.
- **Rate limit** đăng nhập/đăng ký `LOGIN_RATE_PER_MIN` / IP (better-auth `rateLimit`), upload avatar 10/phút.
- Mọi route `/api/account/*` lấy phiên qua `auth.api.getSession({ headers })`; không có → `401 UNAUTHORIZED`.
- CSP hiện tại (`connect-src 'self'`, `img-src 'self' data: blob:`) đã đủ — API cùng origin. Google OAuth cần thêm `form-action https://accounts.google.com` (techlead sửa `next.config.ts` khi bật).

## 5. Client
- `src/lib/auth-client.ts`: `createAuthClient()` của better-auth/react (`useSession`, `signIn.email`, `signUp.email`, `signOut`, `signIn.social`).
- **Không gian dữ liệu theo tài khoản**: key localStorage `kpi-dash:v1` (khách) và `kpi-dash:v1:u:<userId>` (đã đăng nhập). Đăng nhập lần đầu khi máy đang có dữ liệu khách → hỏi: *"Chuyển 1.234 dòng đang có vào tài khoản?"* (Chuyển / Bắt đầu trống). Đăng xuất → về không gian khách, **không xoá** dữ liệu tài khoản trên máy trừ khi chọn "Đăng xuất và xoá dữ liệu trên máy này" (máy dùng chung).
- **Đồng bộ** (nút trong menu tài khoản + tự đẩy debounce 30 s sau thay đổi khi đã đăng nhập): `PUT /api/account/data` với `baseRevision`. 409 → dialog: *Giữ bản trên máy* (ghi đè bằng `baseRevision` mới) / *Lấy bản trong tài khoản* (thay local, có hoàn tác `undoLast`). Offline/lỗi mạng → thử lại sau, báo trạng thái "Chưa đồng bộ", **không mất dữ liệu local**.
- UI (`src/components/account/**`): `AccountMenu` (avatar tròn 32 px / chữ cái đầu, tên, Hồ sơ, Đồng bộ, Đăng xuất), `AuthDialog` (Đăng nhập / Tạo tài khoản, lỗi inline tiếng Việt, hiện/ẩn mật khẩu, ≥ 44 px, 375 px), `ProfileDialog` (tên, công ty, chức danh, đổi/xoá avatar có xem trước, xoá tài khoản gõ "XOÁ"). Đã cắm sẵn `<AccountMenu />` vào slot `controls` của `DashboardPage` (techlead). Trường có thể chỉnh giao diện sau qua change request.

## 6. Biến môi trường
| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `DATABASE_URL` | bật tài khoản | Neon `postgres://…?sslmode=require`; test: `pglite://memory` |
| `BETTER_AUTH_SECRET` | bật tài khoản | ≥ 32 ký tự ngẫu nhiên (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | production | `https://vibecode-three-xi.vercel.app` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | tuỳ chọn | có thì hiện nút "Đăng nhập bằng Google" |

Script: `npm run db:generate` (drizzle-kit generate) · `npm run db:migrate` (áp migration — chạy trên Vercel bằng build step hoặc tay một lần).

## 7. Nghiệm thu (Huy phải có test cho từng dòng)
| # | Ca | Kỳ vọng |
|---|---|---|
| A1 | Không có `DATABASE_URL` | build xanh; `/api/account/*` → 503 `NOT_CONFIGURED`; UI không có nút đăng nhập; 5 tính năng P0 + E2E `g1-smoke` vẫn xanh |
| A2 | Đăng ký email mới → đăng nhập → reload | vẫn đăng nhập (cookie phiên), `AccountMenu` hiện tên |
| A3 | Mật khẩu < 8, email sai định dạng, email đã tồn tại, sai mật khẩu | lỗi tiếng Việt, không lộ "email có tồn tại hay không" ở màn đăng nhập |
| A4 | 11 lần đăng nhập sai / phút | 429 |
| A5 | Đăng xuất | cookie xoá, `/api/account/profile` → 401, về không gian khách, dữ liệu khách còn nguyên |
| A6 | Sửa hồ sơ: tên 61 ký tự / chứa `<script>` | 400 / lưu dạng text, React escape khi hiện |
| A7 | Avatar PNG/JPEG/WebP ≤ 200 KB | lưu, URL đổi `?v=`; ảnh SVG / file .png giả (nội dung text) / > 200 KB → 415 / 415 / 413 |
| A8 | Người A gọi GET avatar / data của B | 401/404 — không xem được |
| A9 | Đồng bộ: máy 1 đẩy rev 1 → máy 2 đẩy với baseRevision 0 | 409 + `server.revision = 1`; chọn "Lấy bản tài khoản" → dữ liệu máy 2 = máy 1 |
| A10 | `state` hỏng / > 4 MB | 400 / 413, DB không đổi |
| A11 | Xoá tài khoản | 204; đăng nhập lại thất bại; hàng `profile`, `user_data` biến mất (cascade) |
| A12 | 375 px: AuthDialog, ProfileDialog, AccountMenu | không tràn, nút ≥ 44 px |

Tầng test: unit (Zod, magic bytes, merge local↔cloud) · integration route handler với **PGlite** (tạo schema bằng migration thật) · E2E Playwright `tests/e2e/account.spec.ts` (server với `DATABASE_URL=pglite://memory`, `BETTER_AUTH_SECRET=test…`). Không mock better-auth trong integration — chạy thật trên PGlite.
