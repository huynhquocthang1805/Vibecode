import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';

import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

import './globals.css';

// Font thiết kế cho tiếng Việt — dấu hiển thị chuẩn ở mọi cỡ chữ
const appSans = Be_Vietnam_Pro({
  variable: '--font-app-sans',
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'KPI Mini — Dashboard chiến dịch quảng cáo',
  description: 'Nhập số liệu quảng cáo theo ngày, tự tính CTR/CPC/CPA, AI nhận xét xu hướng và xuất báo cáo.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="vi" className={`${appSans.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
