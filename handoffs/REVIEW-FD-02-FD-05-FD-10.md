# Review FD-02 + FD-05 + FD-10 (Trường) — PR #12 — techlead bot

## Vòng 1 — verdict: **REQUEST CHANGES**

PR guard: không có lỗi chặn (1 cảnh báo: `tests/integration/fd-review.review.test.tsx` ngoài phạm vi — xem lưu ý).

### Bảng kiểm tra
| Hạng mục | Kết quả |
|---|---|
| `npm run check` (lint + typecheck + test) | ✅ lint/typecheck sạch · Vitest **43 file, 3791 passed, 10 expected fail, 0 failed** |
| `npm run build` | ✅ biên dịch + typecheck + 5 trang tĩnh, `/api/insights` dynamic |
| Hợp đồng `domain.ts` / docs/10 | ✅ props công khai giữ nguyên; `EChartCanvas` nội bộ (thêm `pointCount`) |
| `any` / `ts-ignore` / `console.log` trong `src/components` | ✅ không có |
| Ownership | ✅ chỉ file của Trường; ⚠️ 1 dòng `it.fails` → `it` trong test QA (đã được techlead quyết định ở R-01, chấp nhận) |
| FD-02 R-01: giá trị chính = `comparison.current`, tổng kỳ phụ | ✅ `KpiCards.tsx`, test QA R-01 chuyển thành test thường và xanh |
| FD-05 R-02: guard `enough` trước `useInsights` | ✅ đúng phạm vi caller; 6 test trạng thái (`AiInsightCard.test.tsx`) |
| FD-10 R-05: bỏ tên cá nhân | ⚠️ code đúng, **không có test** |
| FD-10 R-06: lazy fixture + loading/lỗi | ⚠️ code đúng, **không có test nhánh lỗi/loading** |
| FD-10 Canvas khi > 1.000 điểm | ⚠️ code đúng, **không có test ngưỡng** |
| Bundle < 250 KB | ⚠️ 249.843 B (script modern); dư 157 B; tổng gồm `nomodule` 289 KB — handoff nêu trung thực |
| ECharts lazy, selector hẹp | ✅ ECharts modular (`echarts/core` + chỉ chart/component cần dùng) |
| Handoff + log AI | ✅ `FD-02.md`, `FD-05.md`, `FD-10.md` |
| Secret / gọi AI từ client | ✅ không |

### Lỗi phải sửa
| Mã | Mức | File | Cách sửa |
|---|---|---|---|
| R-01 | Trung bình | `src/components/dashboard/DashboardShell.tsx` (`togglePreview`, nhãn `workspaceLabel`) + test | Thiếu test cho các nhánh mới theo quy tắc "test phải có nhánh lỗi/ca biên". Thêm test (RTL): (a) bấm "Xem giao diện mẫu" → hiện "Đang tải bản mẫu…", nút khoá, rồi hiện nhãn "Dữ liệu minh hoạ"; (b) `import()` fixture bị lỗi (mock) → `toast.error` "Chưa tải được dữ liệu minh hoạ…", preview không bật, nút mở lại được; (c) `workspaceLabel`: "Tất cả chiến dịch" / tên chiến dịch được chọn / "Chiến dịch" khi id không tồn tại; không còn chuỗi "Minh Trường"/"MT". |
| R-02 | Trung bình | `src/components/dashboard/EChartCanvas.tsx` (+ `CampaignChart.tsx`) | Thêm test ngưỡng renderer: `pointCount` = 1.000 → `svg`, 1.001 → `canvas` (mock `echarts-for-react/lib/core` để đọc `opts.renderer`, hoặc tách hàm thuần `pickRenderer(pointCount)` rồi test biên 0/1.000/1.001). |

### Lưu ý không chặn
- Ngân sách bundle chỉ còn dư 157 B (script modern). Phép đo "modern, bỏ nomodule" cần techlead chốt trong TL-07; đừng ghi FD-10 là "đạt mọi thẻ script". Đề nghị PM giữ FD-10 ở mức "đạt theo phép đo modern" khi cập nhật TASKS.
- FD-05 chỉ đóng phía caller; R-02/R-03/R-04 phía hook vẫn thuộc AI-FIX-01 (Hoàng Anh). Request `sufficient=false` từ `DashboardPage` vẫn có thể phát sinh — không tính FD-05 là đóng E26 toàn app.
- AI-08 (`buildReport`, `copyText`) vẫn chưa có → xuất báo cáo báo "chưa sẵn sàng" (xử lý êm).
- `handoffs/FD-10/` có nhiều log/JSON/script (~20 file); đủ làm bằng chứng, đừng thêm nữa.
- Cherry-pick test QA (1c77d9a) vào nhánh frontend: chấp nhận cho PR này; PR #19 không được merge độc lập kẻo trùng/xung đột.

### Điểm tốt
Sửa đúng gốc R-01 (giá trị khớp delta, tổng kỳ hiển thị phụ, nhãn "kỳ đã chọn"); tách dialog/tab/nội dung AI thành chunk tải theo nhu cầu mà vẫn giữ props công khai; ECharts modular với ResizeObserver + rAF; handoff trung thực về số đo bundle và giới hạn; check/build/browser 375–1440px đều có bằng chứng.

Không đổi trạng thái `TASKS.md` (verdict ≠ APPROVE).
