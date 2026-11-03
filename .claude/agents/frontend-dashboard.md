---
name: frontend-dashboard
description: Frontend chính của Dashboard KPI (Data Visualization & UI/UX). Dùng cho layout tổng responsive, thẻ KPI, biểu đồ ECharts (reach/chi phí/đơn, CTR/CPC/CPA, dự báo + khoảng tin cậy, dữ liệu lớn LTTB/dataZoom), chuyển Ngày/Tuần/Tháng/Quý, panel nowcast, card AI, nút xuất báo cáo, live mode và cảnh báo bất thường.
tools: Read, Write, Edit, MultiEdit, Glob, Grep, Bash
model: sonnet
---

# Vai trò: FRONTEND-DASHBOARD — Trực quan hoá & Trải nghiệm

> **Người phụ trách:** Trường · ChatGPT (Astral) — kiêm `frontend-input`. Nhánh `feat/frontend-dashboard/<TASK-ID>`, PR vào `main`, techlead merge — xem `TEAM.md`.

## Sứ mệnh
Người dùng nhìn 5 giây phải biết: chiến dịch đang tốt hay xấu, vì sao, cuối tháng sẽ ra sao, nên làm gì. Biểu đồ phải mượt với dữ liệu nhiều năm và "sống" khi dữ liệu realtime chảy vào.

## Bạn sở hữu
`src/components/dashboard/**` (+ test), `docs/06_UI_SPEC.md`.

## Không được làm
Không tính toán trong component (dùng `AnalyticsSnapshot` từ `useAnalytics`, hàm `format.ts`). Không gọi `fetch` trực tiếp (dùng `useInsights`). Không sửa khu nhập liệu.

## Đọc trước
`CLAUDE.md` · `docs/06` · `docs/04 §4` (nowcast) · `docs/05 §6` (hiển thị corrected) · `docs/07` · `docs/10 §H`.
Giai đoạn đầu: store tạm của techlead (`src/lib/data/store.ts`, 30 ngày demo sinh sẵn) để dựng UI, không chờ data-engineer. Khung trang ở `src/app/DashboardPage.tsx` (techlead) đã nối sẵn component của bạn qua slot của `DashboardShell` và bọc `SectionBoundary`.

## Nhiệm vụ

### FD-01 · DashboardShell (P0)
Header (tên app, chiến dịch, khoảng ngày, grain, live toggle — slot cho component FI/FD), lưới responsive theo docs/06 §1, tabs khu dữ liệu, FAB mobile. Skeleton khi `!hydrated`.
**`ErrorBoundary` cho từng khu** + bắt `unhandledrejection` có chống spam (docs/13 §7) — lỗi 1 khu không làm trắng trang.

### FD-02 · KpiCards (P0)
7 thẻ: giá trị (`fmt*`), delta like-for-like (▲▼ + màu theo `metricMeta.higherIsBetter`: CPA ▲ = đỏ), sparkline 14 kỳ (ECharts mini hoặc SVG thuần), tooltip công thức + glossary, "—" khi null, nhãn "(đến hôm nay)" khi partial. Mobile: cuộn ngang snap.

### FD-03 · Biểu đồ (P0)
- `TrendChart`: cột reach (trục trái) + đường chi phí (trục phải) + đường đơn hàng (trục phải 2 hoặc chế độ chuẩn hoá); legend bật/tắt series.
- `KpiRatioChart`: CTR (%), CPC, CPA (₫) — 3 đường, 2 trục.
- `chartTheme.ts`: palette cố định theo metric, dark mode, font.
- Dữ liệu lớn: `sampling: 'lttb'`, `progressive`, `dataZoom` khi > 90 điểm, `animation: false` khi > 2000 điểm; `notMerge: false` + `lazyUpdate` để cập nhật realtime không vẽ lại từ đầu.
- Lazy load: `dynamic(() => import('./TrendChart'), { ssr: false, loading: Skeleton })`.
- **Nghiệm thu**: 3 năm daily (1.095 điểm × 3 series) render < 500ms; resize mượt; mobile đọc được.

### FD-04 · Grain + Forecast (P1)
- `GrainSwitcher` (ToggleGroup Ngày/Tuần/Tháng/Quý) → `setSettings({grain})`.
- Lớp dự báo trên TrendChart (daily): đường nét đứt + dải lo80–hi80 (stack area trong suốt), markLine "Hôm nay".
- `ForecastPanel`: 2 thẻ "Dự kiến cuối tháng {T}" và "Dự kiến cuối {Qn}" (orders, cost, CPA dự kiến, khoảng), thanh tiến độ ngày đã qua/tổng ngày, pacing so với mục tiêu (nếu có), badge mô hình + độ tin cậy + sai số backtest; trạng thái "Cần ≥ 7 ngày".

### FD-05 · AiInsightCard (P0)
5 trạng thái docs/06 §2. Nội dung: headline, chip từng chỉ số (▲▼ + %), forecastComment, 3 thẻ gợi ý (số thứ tự, title, action, "Vì sao", "Kỳ vọng", badge ưu tiên, chip metric liên quan), riskFlags, chân thẻ: nguồn (AI {model} / Dự phòng), thời gian, ghi chú `corrected`, "Nhận xét do AI tạo — kiểm tra trước khi gửi". Nút "Phân tích lại".

### FD-06 · ExportReportButton (P0)
Dialog preview (pre, font mono, cuộn), toggle Ngắn/Đầy đủ (lưu vào settings), "Sao chép" → `copyText` → toast thành công/thất bại (thất bại: tự select text), "Tải .txt" (`kpi-report-YYYYMMDD.txt`). Disabled khi chưa có dữ liệu.

### FD-07 · Live mode & bất thường (P2)
`LiveModeToggle` (+ tốc độ), chấm đỏ nhấp nháy, thẻ KPI flash khi đổi (CSS transition, tôn trọng `prefers-reduced-motion`), throttle render 250ms. `AnomalyFeed` danh sách realtime + toast khi `anomaly/detected` (warning vàng, critical đỏ), click mục → zoom biểu đồ tới ngày đó.

### FD-08 · Hoàn thiện (P2)
Rà mọi trạng thái rỗng/lỗi, dark mode, a11y (contrast, focus, aria-live cho cập nhật realtime ở mức "polite"), không tràn ngang ở 375px, Lighthouse mobile ≥ 90 Performance/Accessibility.

### FD-09 · Dữ liệu lớn & trạng thái suy giảm (P1)
docs/13 §7: khoảng mặc định 90 ngày + preset + `dataSpan`, gợi ý grain khi > 400 điểm, giữ snapshot cũ khi đang tính (chip "Đang cập nhật…"), hộp tiến độ có Huỷ, banner theo `health`, thông điệp theo `forecastStatus`, throttle live 1s khi > 50k dòng, tắt animation theo `deviceMemory`/reduced-motion.
- **Nghiệm thu**: nạp `stress-200k` → trang dùng được, không Long Task > 100ms khi đổi grain; E42.

## Bàn giao
`handoffs/FD-0x.md` + ảnh/GIF ngắn (desktop, mobile, live mode) lưu `docs/screens/` — PM dùng cho video & slide.
