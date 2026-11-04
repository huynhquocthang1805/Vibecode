# Rà nhiệm vụ Minh Trường — 2026-11-05

Theo TEAM/CLAUDE: frontend-dashboard + frontend-input, chỉ sửa components/dashboard, components/input, docs/06 và handoff/ảnh của nhiệm vụ. ACC-05 UI tài khoản hiện thuộc Huy, không thuộc Trường.

Đã fetch main `a008fb7`, giữ toàn bộ code đã merge của Trường. Không sửa TASKS, log dùng chung, domain, config hoặc file người khác.

| Task | Function/component | Kết quả rà soát |
|---|---|---|
| FD-01 | DashboardShell, SectionBoundary | Đã có; bổ sung health/quota và sheet mobile |
| FD-02 | KpiCards | Fix giá trị/delta đã merge PR12; thêm trạng thái snapshot và flash Live |
| FD-03 | TrendChart, KpiRatioChart, chartTheme, EChartCanvas | Đã có; thêm test renderer và trục forecast/partial/ít RAM |
| FD-04 | GrainSwitcher, ForecastPanel, CampaignChart | Bổ sung pacing có sẵn, preset tháng/quý/năm, forecast horizon khác nhau |
| FD-05 | AiInsightCard, InsightContent | Caller guard đã merge; AI-FIX-01 vẫn thuộc Hoàng Anh |
| FD-06 | ExportReportButton/Dialog | UI preview/copy/txt có sẵn; chưa end-to-end vì AI-08 buildReport/copyText của Thắng2 còn stub |
| FD-07 | LiveModeToggle, AnomalyFeed, useDisplaySnapshot | Đã nối simulator/bus, cleanup, tốc độ, throttle hiển thị; detector FC-07 còn phụ thuộc |
| FD-08 | DashboardShell, CSS, EntryForm(useId) | Browser desktop/tablet/mobile/dark/sheet xanh; chưa có Lighthouse/axe đầy đủ |
| FD-09 | AnalyticsStatus, health banners, DateRangeDialog | DataSpan/range/grain/updating/forecastStatus/quota; chưa API progress/cancel và chứng nhận stress200k |
| FD-10 | reviewLoader, DashboardShell/EChartCanvas tests | Đã làm test review thiếu; fixture lazy; bundle277KB vượt250KB, cần tối ưu ghép/account của chủ file |
| FI-01 | EntryForm/EntryFields, duplicate dialog | P0 đã merge; giữ validation/store, sửa ID khi form cùng xuất hiện trong sheet |
| FI-02 | EntryTable | P0 đã merge, giữ edit/xoá/undo |
| FI-02b | EntryTableContent/useVirtualizer | PR22: bảng/thẻ ảo hoá, filter/sort/đi tới ngày, test100k giới hạn DOM |
| FI-03 | CsvImportDialog/PasteImportDialog/ImportDialog | PR22: preview/mapping/error CSV/undo; commit đồng bộ còn phụ thuộc Worker API |
| FI-04 | CampaignManager/DataManager | PR22: tạo/đổi tên/chọn; chỉnh màu cần contract color |
| FI-05 | DataManager | P0 đã merge, PR22 thêm chọn demo30d/2y và tên adapter |
| FI-06 | EntryFields + mobile sheet | PR22 định dạng/caret/Enter; PR dashboard mở sheet và sửa ID/nhãn |
| FI-07 | ArchiveManager, quota, import undo | PR22: tải năm cũ→xác nhận→xoá→undo, chặn khi revision đổi |

## PR và tích hợp

- [PR22 nhập liệu](https://github.com/huynhquocthang1805/Vibecode/pull/22), nhánh từ main riêng.
- PR dashboard cũng từ main riêng, cùng sửa EntryForm nhưng PR22 không sửa file đó nên không có xung đột tại đây.
- Không tự merge; techlead review, PM cập nhật TASKS/log dựa trên các giới hạn trong handoff từng task.
- Không ghi nhận toàn bộ task đã đạt Definition of Done: các phụ thuộc và chứng nhận hiệu năng còn được nêu rõ.

## Change request tổng hợp

1. Thắng2: hoàn tất AI-08. Hoàng Anh: AI-FIX-01, FC-07/08.
2. Techlead/Huy: contract đổi màu; Worker progress/cancel và nhịp snapshot Live lớn; tách tải UI tài khoản để giảm initial bundle.
3. QA: Lighthouse/axe, stress200k, Long Task và browser import file lớn; script browser hiện chỉ chứng minh các luồng được ghi trong browser-checks.json.
4. Huy/techlead: production build exit0 nhưng Better Auth vẫn log thiếu secret/baseURL trong môi trường không cấu hình; app khách vẫn chạy. Không đọc/sửa .env.
