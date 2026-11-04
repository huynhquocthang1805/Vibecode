// Owner: data-engineer (Huy) — ACC-02: thay bằng toNextJsHandler(auth) của better-auth.
import { accountStub } from '@/lib/server/accountConfig';

export async function GET(): Promise<Response> {
  return accountStub('ACC-02');
}
export async function POST(): Promise<Response> {
  return accountStub('ACC-02');
}
