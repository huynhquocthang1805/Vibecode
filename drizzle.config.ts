import { existsSync } from 'node:fs';

import { defineConfig } from 'drizzle-kit';

// ACC-FIX-02: drizzle-kit (db:generate / db:migrate chạy tay) cần chuỗi kết nối — trước đây thiếu nên
// `npm run db:migrate` lỗi "connection url is required". Máy dev: đọc DATABASE_URL từ .env.local (Node ≥ 22).
// Deploy Vercel không cần lệnh này: `npm run build` tự migrate qua scripts/db-migrate.mjs.
if (!process.env.DATABASE_URL && existsSync('.env.local')) process.loadEnvFile('.env.local');

export default defineConfig({
  schema: './src/lib/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
