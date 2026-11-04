// Owner: data-engineer (Huy) — ACC-04. GET bản cloud · PUT { state, baseRevision } → 409 CONFLICT khi lệch revision.
import { accountStub } from '@/lib/server/accountConfig';

export async function GET(): Promise<Response> {
  return accountStub('ACC-04');
}
export async function PUT(): Promise<Response> {
  return accountStub('ACC-04');
}
