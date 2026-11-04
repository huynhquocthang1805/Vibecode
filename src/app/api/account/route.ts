// Owner: data-engineer (Huy) — ACC-03. DELETE { confirm: "XOÁ" } → xoá tài khoản + dữ liệu (cascade).
import { accountStub } from '@/lib/server/accountConfig';

export async function DELETE(): Promise<Response> {
  return accountStub('ACC-03');
}
