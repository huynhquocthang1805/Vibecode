# KPI Mini — Dashboard KPI Chiến dịch (Đề 7)

Web app một trang giúp Marketer nhập số liệu quảng cáo theo ngày, tự tính CTR / CPC / CPA, xem biểu đồ, nhận AI nhận xét xu hướng + 3 gợi ý, và xuất báo cáo text gửi sếp/khách hàng.

> Trạng thái: **khung dự án (Wave 0)** — trang hiển thị các khu tạm, các hàm là stub `NOT_IMPLEMENTED: <TASK-ID>`. Tiến độ: `TASKS.md`. Bản đầy đủ README ở PM-02.

## Chạy local
Yêu cầu Node 22 (`.nvmrc`).
```bash
npm ci
cp .env.example .env.local   # điền AI_API_KEY nếu cần gọi AI thật
npm run dev                  # http://localhost:3000
```

## Lệnh
| Lệnh | Việc |
|---|---|
| `npm run check` | lint + typecheck + test (chạy trước mỗi PR) |
| `npm run build` | build production |
| `npm run test:e2e` | Playwright (tự build + start; `BASE_URL=...` để test bản deploy) |
| `npm run format` | Prettier |

## Công nghệ
Next.js 16 (App Router, TypeScript strict) · Tailwind 4 + shadcn/ui · ECharts · Zustand · Zod · Web Worker + Comlink · Vitest + fast-check + Playwright · Gemini (server-side). Lý do chọn: `CLAUDE.md` §2, `docs/01_ARCHITECTURE.md`.

> Next.js 16 khác nhiều so với kiến thức cũ của AI (Cache Components bật sẵn, `LayoutProps` sinh tự động…). Trước khi code, đọc `AGENTS.md` và tài liệu trong `node_modules/next/dist/docs/`.

## Đội & cách làm việc
5 người, mỗi người một (hoặc hai) vai AI agent — xem **`TEAM.md`** (phân công, nhánh, prompt mẫu) và **`CLAUDE.md`** (luật chung).
Tài liệu đặc tả: `docs/00`–`docs/13`.
