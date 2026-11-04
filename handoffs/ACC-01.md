# Handoff — ACC-01 · DB: schema Drizzle + migration + getDb neon/pglite + harness test PGlite
- **Role:** data-engineer   **Người:** Huy · Gemini Argon   **Nhánh:** feat/data-engineer/ACC-01-ACC-02   **Thời gian:** 2026-11-04 18:10
- **Contracts:** đã đọc `domain.ts` — không đổi chữ ký ✅

## Đã làm
- Cấu hình `drizzle.config.ts` trỏ tới `./src/lib/server/db/schema.ts`, output `./drizzle`, dialect `postgresql`.
- Xây dựng schema Drizzle đầy đủ (`src/lib/server/db/schema.ts`):
  - 4 bảng better-auth: `user`, `session`, `account`, `verification`.
  - 2 bảng riêng theo đặc tả docs/14 §3: `profile` (userId FK cascade, avatar dạng bytea, avatarType, avatarVersion, updatedAt) và `userData` (bảng `user_data`, userId FK cascade, state, revision, rows, bytes, updatedAt).
  - Tự động cascade delete toàn bộ bảng liên quan khi xoá `user` (nghiệm thu A11).
  - Custom type `bytea` cho Postgres / Neon / PGlite, chuẩn hoá Uint8Array / Buffer / hex string.
- Chạy `npm run db:generate` sinh migration SQL đầu tiên trong `drizzle/0000_familiar_wind_dancer.sql`.
- Xây dựng DB client (`src/lib/server/db/client.ts`):
  - `getDb(): Database`: khởi tạo lười (lazy initialization), hỗ trợ Neon serverless HTTP và PGlite (`pglite://memory`, `pglite://<path>`). Khi thiếu env, fallback memory an toàn để `npm run build` không lỗi.
  - `ensureMigrated()`: tự động chạy Drizzle migration trên PGlite.
  - `resetDb()`, `closeDb()`: hỗ trợ test harness reset dữ liệu giữa các test suite.

## File thay đổi
- `drizzle.config.ts`
- `drizzle/` (migration SQL và metadata)
- `src/lib/server/db/schema.ts`
- `src/lib/server/db/client.ts`
- `src/lib/server/db/client.test.ts`
- `handoffs/ACC-01.md`

## API / component công khai
```ts
export type Database = NeonHttpDatabase<typeof schema> | PgliteDatabase<typeof schema>;
export function getDb(): Database;
export function ensureMigrated(): Promise<void>;
export function resetDb(): Promise<void>;
export function closeDb(): Promise<void>;
```

## Kiểm thử
- Lệnh: `npx vitest run src/lib/server/db/client.test.ts` → 3 passed / 0 failed
- Nghiệm thu:
  - Khởi tạo `getDb()` nạp đủ 6 bảng.
  - CRUD trên `user`, `profile` (lưu bytea avatar), `userData`.
  - A11: xoá user → cascade tự động xoá profile, user_data, session, account.

## Cách dùng cho người nhận
- Gọi `getDb()` trong server component / server actions / route handler để truy vấn Drizzle.
- Gọi `await ensureMigrated()` trước khi query trên PGlite trong môi trường test/dev.

## Hạn chế / nợ kỹ thuật
- Không có.

## Cần người khác làm
- Techlead: chạy `npm run db:migrate` trên Neon khi deploy production (ACC-07).

## Ghi chú dùng AI
- AI đề xuất đóng kết nối `pgliteClient.close()` trong `resetDb()`, dẫn đến các test suite sau dùng `auth` bị lỗi "PGlite is closed" do adapter `better-auth` được khởi tạo singleton; đã sửa thành `delete` rows để giữ kết nối sống và dọn dữ liệu sạch sẽ.
- Dòng log (PM chép vào `docs/11_AI_USAGE_LOG.md` lúc merge):

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-04 18:10 | data-engineer | ACC-01 | Tạo Drizzle schema, migration, getDb hỗ trợ Neon/PGlite | feat | `resetDb` ban đầu close client làm gãy singleton better-auth; sửa thành truncate/delete | src/lib/server/db/client.ts |

