// Owner: data-engineer (Huy) — ACC-02: better-auth route handler
import { accountConfigured, notConfiguredResponse } from '@/lib/server/accountConfig';
import { auth } from '@/lib/server/auth';
import { ensureMigrated } from '@/lib/server/db/client';

async function handle(req: Request): Promise<Response> {
  if (!accountConfigured()) {
    return notConfiguredResponse();
  }
  await ensureMigrated();
  return auth.handler(req);
}

export const GET = handle;
export const POST = handle;
