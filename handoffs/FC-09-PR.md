## Task
- **ID:** FC-02, FC-03, FC-04, FC-05, FC-06, FC-09   **Role:** forecast-engineer   **Người:** Thắng 2 · ChatGPT/Codex
- **Handoff:** handoffs/FC-02.md, FC-03.md, FC-04.md, FC-05.md, FC-06.md, FC-09.md

## Đã làm
- Thay stub bằng ba baseline, Holt/Holt-Winters, grid fit SSE, backtest rolling-origin, lựa chọn model và khoảng dự báo 80/95%. Chỉ fit quá khứ, không chấm ngày nội suy như quan sát thật; giữ baseline khi cải thiện dưới 5%.
- Nowcast cộng thực tế và dự báo đúng ngày tới cuối tháng/quý, không đếm đôi hôm nay partial; KPI là tỉ số của tổng. Báo lỗi rõ nếu forecast không phủ đủ kỳ.
- Báo cáo kiểm định 60 hàng trên campaign-2y: HW được chọn cho mỹ phẩm/đồ gia dụng, moving average cho thời trang. Giữ nguyên hợp đồng và ownership; FC-07/08, FC-10 nằm ngoài phạm vi.

## Kiểm thử
- [x] npm run lint xanh
- [x] npm run typecheck xanh
- [x] npm run test xanh: 26 file, 3.702 passed + 8 expected fail có sẵn
- [x] 58 test analytics mới: lỗi/ca biên, chống dùng holdout để fit, property 200 lượt, dữ liệu BA-05 và rollup thật
- [x] Hiệu năng máy dev: forecastAll p95 32,847–41,266 ms; nowcast p95 0,591–0,665 ms; điều kiện đo tại docs/forecast-validation.md
- UI: không thay đổi component

## Tự kiểm
- [x] Chỉ sửa analytics được sở hữu, tài liệu forecast và handoff của task
- [x] Không sửa domain.ts, docs/10, TASKS.md, TEAM.md hoặc file quản lý chung
- [x] Không any, @ts-ignore, console.log, secret; không đổi chữ ký contracts
- [x] Rebase origin/main mới nhất tại thời điểm kiểm tra (6aa2d00)

## Cần người khác làm / change request
- Huy/techlead: worker phải yêu cầu horizon đủ tới cuối quý và bắt lỗi nowcast từng kỳ riêng. Hiện horizon mặc định 30 làm thiếu ngày quý; không nên làm mất cả nowcast tháng khi quý thiếu.
- Huy/techlead: áp dụng forecastStatus stale/disabled trước khi tính/hiển thị forecast (FC-10/DATA-06).
- Nhân/techlead: chuyển cấu hình forecast tạm đã được duyệt ở analytics/forecastConfig.ts về config/thresholds.ts.
- Hoàng Anh: nối pacing khi FC-08 hoàn tất. hourFraction chưa có trong contract; dùng max(actualToday, forecastToday).
- Khoảng dự báo là xấp xỉ, chưa kiểm định coverage; dataset giả lập và các fold chọn model chưa phải holdout độc lập.

## Ghi chú dùng AI
| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-04 | forecast-engineer | FC-02–06, FC-09 | Thuật toán, test, đo thực tế, handoff | Code/test/docs | AI tự sửa test harness/precision/union; tối ưu SSE sau đo vượt ngân sách, kết quả sai số giữ nguyên | src/lib/analytics/**, docs/forecast-validation.md, handoffs/FC-*.md |

