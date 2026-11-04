// Owner: data-engineer (Huy) — ACC-03. POST multipart `file` (magic bytes PNG/JPEG/WebP, ≤ 200 KB) · DELETE.
import { accountStub } from '@/lib/server/accountConfig';

export async function POST(): Promise<Response> {
  return accountStub('ACC-03');
}
export async function DELETE(): Promise<Response> {
  return accountStub('ACC-03');
}
