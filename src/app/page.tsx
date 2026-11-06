import { accountConfigured } from '@/lib/server/accountConfig';

import { DashboardPage } from './DashboardPage';

export default function Page() {
  // docs/14 §1.2: server chưa bật tài khoản → không hiện nút đăng nhập, không gọi /api/auth (hết lỗi 503 ở console).
  // Trang được prerender lúc build → đổi biến môi trường trên Vercel thì Redeploy.
  return <DashboardPage accountsEnabled={accountConfigured()} />;
}
