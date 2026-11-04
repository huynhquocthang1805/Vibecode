# Handoff — ACC-00 · Khung tài khoản & database (CR-005) cho Huy
- **Role:** techlead   **Người:** Thắng · Claude   **Nhánh:** feat/techlead/ACC-00   **Thời gian:** 2026-11-04
- **Contracts:** bổ sung `domain.ts` (UserProfile, ProfilePatch, CloudSnapshotMeta, AccountError, LIMITS_ACCOUNT) + `docs/10` §I — không đổi kiểu cũ ✅

## Đã làm
- Quyết định chủ dự án → **CR-005**: tài khoản thật (better-auth) + Postgres Neon (drizzle) + avatar lưu bytea + đồng bộ dữ liệu KPI; **local-first**, khách vẫn đủ P0, thiếu env → 503 không crash.
- `docs/14_ACCOUNTS_DB.md`: nguyên tắc, stack, schema, 8 API, kiểm tra bảo mật (magic bytes, cấm SVG, rate limit, cookie, CSRF), client (không gian localStorage theo user, xung đột 409), env, **12 ca nghiệm thu A1–A12**.
- Cài: `better-auth@1.7.16`, `drizzle-orm@0.45.4`, `@neondatabase/serverless@1.2.0`; dev `drizzle-kit@0.31.11`, `@electric-sql/pglite@0.5.15`. Script `db:generate`, `db:migrate`. `.env.example` thêm biến.
- Stub 6 route (`/api/auth/[...all]`, `/api/account`, `/profile`, `/avatar`, `/avatar/[userId]`, `/data`): 503 `NOT_CONFIGURED` khi thiếu `DATABASE_URL`/`BETTER_AUTH_SECRET`, 501 khi chưa làm. `accountConfigured()` thật + test. `<AccountMenu />` (stub, chưa hiện gì) cắm vào slot `controls` của `DashboardPage`.
- CLAUDE.md §2 (bỏ "KHÔNG dùng backend/database", thêm 2 dòng stack), §4 ownership cho Huy, §9; TASKS Wave A (ACC-01..07); TEAM.md (Huy + prompt); PR guard (đường dẫn ACC cho data-engineer); role file data-engineer (luật riêng ACC).

## Kiểm thử
- `npm run check` → 3.820 pass (2 test mới `accountConfig`) · `npm run build` xanh, đủ 6 route mới (ƒ dynamic), **không cần DB lúc build**.
- `npm audit --omit=dev`: 4 moderate trong `drizzle-kit` (esbuild cũ, chỉ CLI dev) — chấp nhận, ghi docs/14 §2.

## Cần người khác làm
- **Huy:** ACC-01 → ACC-06 theo docs/14 (nhánh `feat/data-engineer/ACC-…`).
- **Thắng (ACC-07):** Vercel → Storage → tạo Neon (tự set `DATABASE_URL`) · thêm `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL=https://vibecode-three-xi.vercel.app` · chạy `npm run db:migrate` một lần sau khi ACC-01 merge.

## Ghi chú dùng AI
| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-04 | techlead (Claude) | ACC-00 | Hỏi chủ dự án trước khi đổi kiến trúc (CLAUDE.md cấm backend), chọn stack, đặc tả + stub cho Huy | Quyết định | AI đề xuất làm cục bộ (đúng luật cũ); chủ dự án chọn server thật → ghi CR-005, giữ ràng buộc "không làm hỏng P0" | `docs/14`, `domain.ts` |
