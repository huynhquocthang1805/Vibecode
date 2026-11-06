# REVIEW — ACC-FIX-02 (PR #35) — ✅ APPROVE

## Vòng 1

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ Không có lỗi chặn |
| Ownership | ✅ Nhánh techlead; chỉ sửa `package.json`, `drizzle.config.ts`, `.env.example`, `scripts/db-migrate.mjs`, `docs/14` (có CR-005 cho phần docs), `TASKS.md`, handoff |
| `npm run check` | ✅ lint + typecheck xanh · Vitest 75 file, **4173 pass**, 2 expected fail (`it.fails` đã biết), 0 fail |
| `npm run build` | ✅ xanh; không có DB → script bỏ qua. Còn log `BetterAuthError` do ACC-FIX-01 (đã có task riêng, không thuộc PR này) |
| Hợp đồng / `domain.ts` | ✅ Không đổi chữ ký |
| `any` / `ts-ignore` / `console.log` | ✅ Không có (`console.error` ở nhánh lỗi, có chủ đích) |
| Secret | ✅ Script không in `DATABASE_URL`; chỉ in thông điệp lỗi |
| Build không cần DB (docs/14 §1.2) | ✅ Thiếu `DATABASE_URL` hoặc `pglite://memory` thì bỏ qua |
| Nhánh lỗi / ca biên | ✅ Handoff ghi đã thử 6 nhánh URL, migrate lần 2 áp 0, lỗi thì exit 1, luồng tài khoản 18/18 trên PGlite |
| Handoff + log AI | ✅ `handoffs/ACC-FIX-02.md` |

### Lỗi phải sửa
Không có.

### Lưu ý không chặn
1. Nhánh Neon (`neon-http`) chưa chạy được trên Neon thật trong môi trường cloud, chỉ chạy trên PGlite. Rủi ro thấp vì cùng migrator của drizzle. Sau khi bật ACC-07, kiểm log build có dòng `[db-migrate] Neon: đã áp 1 migration mới`.
2. Script không có unit test tự động (chỉ thử tay). Nên cho QA thêm một test spawn script với `pglite://<tmpdir>` khi rảnh.
3. Deploy Preview dùng chung `DATABASE_URL` với Production nếu tick cả hai. Migration idempotent nên an toàn, nhưng migration phá huỷ sau này sẽ chạy cả ở preview.
4. `drizzle.config.ts` dùng `process.loadEnvFile`, cần Node ≥ 22. Nên ghi `engines` trong `package.json` nếu chưa có.

### Điểm tốt
- Sửa đúng gốc lỗi: `dbCredentials` thiếu và không có bước migrate tự động.
- Lỗi migrate làm build đỏ nên Vercel giữ bản cũ, không lên bản thiếu bảng.
- Idempotent, bỏ qua đúng chế độ khách/CI, không in chuỗi kết nối.
- Handoff có hướng dẫn bật Vercel rõ ràng và cách kiểm tra (401 so với 503).
