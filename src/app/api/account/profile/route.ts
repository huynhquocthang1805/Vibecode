// Owner: data-engineer (Huy) — ACC-03. GET → UserProfile · PUT ProfilePatch → UserProfile (docs/14 §4).
import { accountStub } from '@/lib/server/accountConfig';

export async function GET(): Promise<Response> {
  return accountStub('ACC-03');
}
export async function PUT(): Promise<Response> {
  return accountStub('ACC-03');
}
