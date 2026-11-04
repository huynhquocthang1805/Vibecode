// Owner: data-engineer (Huy) — ACC-03. Trả ảnh avatar của chính chủ phiên (docs/14 §4).
import { accountStub } from '@/lib/server/accountConfig';

export async function GET(): Promise<Response> {
  return accountStub('ACC-03');
}
