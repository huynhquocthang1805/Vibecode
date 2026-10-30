---
paths:
  - "src/components/**"
  - "src/app/**/*.tsx"
---

# Quy tắc giao diện (owner: frontend-dashboard, frontend-input)
- Component không tính toán nghiệp vụ: lấy số từ `AnalyticsSnapshot`/store, định dạng bằng `lib/domain/format.ts`.
- Text tiếng Việt; nhãn/tooltip lấy từ `src/config/metricMeta.ts` và `glossary.ts`.
- Mọi khu có đủ 3 trạng thái: rỗng / đang tải (Skeleton) / lỗi (có hành động khắc phục).
- Mobile-first: kiểm ở 375px; vùng chạm ≥ 44px; không tràn ngang; input số dùng `inputMode="numeric"`.
- Tăng/giảm luôn kèm ▲▼ (không chỉ dựa vào màu). Màu metric lấy từ `chartTheme.ts`.
- ECharts và dialog nặng import động (`next/dynamic`, `ssr: false`).
- Selector Zustand hẹp; `React.memo` cho thẻ nhận cập nhật realtime; tôn trọng `prefers-reduced-motion`.
- Thêm `data-testid` cho phần tử E2E cần (QA đề xuất).
