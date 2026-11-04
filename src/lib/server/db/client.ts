// Owner: data-engineer (Huy) — ACC-01: Database client (Neon & PGlite support, lazy init)
import 'server-only';

import path from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';

import { schema } from './schema';

export type Database = NeonHttpDatabase<typeof schema> | PgliteDatabase<typeof schema>;

let _db: Database | null = null;
let _pgliteClient: PGlite | null = null;
let _migrationPromise: Promise<void> | null = null;
let _isPglite = false;

function resolvePglitePath(url: string): string {
  if (url === 'pglite://memory' || url === 'memory://') {
    return 'memory://';
  }
  if (url.startsWith('pglite://')) {
    return url.slice('pglite://'.length);
  }
  return url;
}

export function getDb(): Database {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;

  if (url && (url.startsWith('postgres://') || url.startsWith('postgresql://'))) {
    const sql = neon(url);
    _db = drizzleNeon(sql, { schema });
    _isPglite = false;
    return _db;
  }

  // PGlite (pglite://... or fallback for build/test)
  _isPglite = true;
  const pgliteTarget = url ? resolvePglitePath(url) : 'memory://';
  _pgliteClient = new PGlite(pgliteTarget);
  _db = drizzlePglite(_pgliteClient, { schema });
  return _db;
}

/** Đảm bảo migration đã chạy (tự động với PGlite / test harness) */
export async function ensureMigrated(): Promise<void> {
  const db = getDb();
  if (!_isPglite) return;

  if (!_migrationPromise) {
    _migrationPromise = (async () => {
      const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
      await migratePglite(db as PgliteDatabase<typeof schema>, { migrationsFolder });
    })();
  }
  await _migrationPromise;
}

/** Dùng cho test harness để xoá sạch dữ liệu giữa các test */
export async function resetDb(): Promise<void> {
  if (_db) {
    try {
      await _db.delete(schema.user);
      await _db.delete(schema.verification);
    } catch {
      // Bỏ qua nếu bảng chưa được tạo
    }
  }
}

/** Đóng kết nối PGlite */
export async function closeDb(): Promise<void> {
  _migrationPromise = null;
  if (_pgliteClient) {
    await _pgliteClient.close();
    _pgliteClient = null;
  }
  _db = null;
  _isPglite = false;
}
