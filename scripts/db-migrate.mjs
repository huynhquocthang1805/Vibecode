#!/usr/bin/env node
/**
 * ACC-FIX-02 (techlead): áp migration `drizzle/` lên database TRƯỚC `next build` (docs/14 §6).
 * Chạy tự động trong `npm run build` → trên Vercel mỗi lần deploy, bảng luôn khớp schema.
 *   - Không có DATABASE_URL           → bỏ qua (chế độ khách, CI, máy dev) — build không cần DB (docs/14 §1.2)
 *   - pglite://memory | memory://      → bỏ qua (app tự migrate lúc chạy, lib/server/db/client.ts)
 *   - pglite://<thư mục>               → migrate PGlite tại thư mục đó (để kiểm thử script)
 *   - postgres(ql)://… (Neon)          → migrate qua neon-http (không cần transaction)
 * Lỗi → exit 1: Vercel giữ nguyên bản deploy cũ, không lên bản thiếu bảng. Không bao giờ in DATABASE_URL.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS = resolve(process.cwd(), 'drizzle');
const TABLE = 'drizzle.__drizzle_migrations';
const log = (m) => process.stdout.write(`[db-migrate] ${m}\n`);

async function countApplied(run) {
  try {
    const rows = await run(`select count(*)::int as n from ${TABLE}`);
    return Number(rows[0]?.n ?? 0);
  } catch {
    return 0; // bảng theo dõi chưa có = chưa migrate lần nào
  }
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return log('Không có DATABASE_URL → bỏ qua (chế độ khách).');
  if (url === 'pglite://memory' || url === 'memory://')
    return log('PGlite bộ nhớ → bỏ qua (app tự migrate khi chạy).');
  if (!existsSync(MIGRATIONS)) throw new Error('Không thấy thư mục drizzle/ (migration).');

  if (url.startsWith('pglite://')) {
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    const client = new PGlite(url.slice('pglite://'.length));
    const run = async (q) => (await client.query(q)).rows;
    const before = await countApplied(run);
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS });
    const after = await countApplied(run);
    await client.close();
    return log(`PGlite: đã áp ${after - before} migration mới (tổng ${after}).`);
  }

  if (!/^postgres(ql)?:\/\//.test(url)) throw new Error('DATABASE_URL phải bắt đầu bằng postgres:// hoặc postgresql:// (Neon).');
  const { neon } = await import('@neondatabase/serverless');
  const { drizzle } = await import('drizzle-orm/neon-http');
  const { migrate } = await import('drizzle-orm/neon-http/migrator');
  const sql = neon(url);
  const run = (q) => sql.query(q);
  const before = await countApplied(run);
  await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS });
  const after = await countApplied(run);
  log(`Neon: đã áp ${after - before} migration mới (tổng ${after}).`);
}

main().catch((err) => {
  // Chỉ in thông điệp lỗi, không in chuỗi kết nối
  console.error(`[db-migrate] LỖI: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
