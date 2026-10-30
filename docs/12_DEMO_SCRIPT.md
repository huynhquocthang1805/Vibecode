# 12 — Kịch bản demo (khung, ~5 phút — chỉnh theo thời lượng ban tổ chức)

Owner: `pm-release`. Quay trên bản deploy, cửa sổ ẩn danh, màn 1280px + 1 đoạn mobile.

| Phút | Nội dung | Thao tác | Ăn điểm tiêu chí |
|---|---|---|---|
| 0:00–0:20 | Vấn đề | "Marketer không rành Excel vẫn cần đọc KPI mỗi ngày" | — |
| 0:20–1:10 | F1 nhập liệu | Nhập 3 dòng tay; cố nhập click > reach → bị chặn; dán 7 dòng từ Excel; trùng ngày → chọn Cộng dồn; reload → dữ liệu còn | Chức năng, Kiểm thử |
| 1:10–1:40 | F2 + F3 | KPI cards CTR/CPC/CPA, biểu đồ reach/chi phí/đơn; tooltip công thức | Chức năng |
| 1:40–2:20 | Dữ liệu lớn | Nạp `campaign-2y` (2.190 dòng) hoặc import CSV 50k dòng → UI không đơ; chuyển Ngày → Tuần → Tháng → Quý; mở `?debug=1` cho xem thời gian xử lý (ms) | Kỹ thuật |
| 2:20–2:55 | Dự báo | Dải dự báo + khoảng tin cậy; "Dự kiến cuối tháng/quý"; badge sai số backtest | Kỹ thuật |
| 2:55–3:30 | Realtime | Bật Live x60 → số hôm nay tăng, nowcast nhảy theo, cảnh báo CPC bất thường; mở tab 2 thấy đồng bộ | Kỹ thuật |
| 3:30–4:15 | F4 AI | Bấm Phân tích → headline + 3 gợi ý cụ thể; chỉ ra nhãn model, "đã đối chiếu số liệu"; (tuỳ chọn) bật chế độ lỗi → thẻ dự phòng | Tích hợp AI |
| 4:15–4:40 | F5 xuất báo cáo | Chọn mẫu Ngắn → Sao chép → dán vào Zalo/Notepad | Chức năng |
| 4:40–5:00 | Mobile + kết | Mở trên điện thoại: nhập 1 dòng, xem dashboard; nhắc link, repo, `.claude/` đội agent | UI, Bàn giao, Vibe coding |

Chuẩn bị trước: dữ liệu demo sẵn trong file CSV, key AI còn quota, phương án mạng yếu (`ALLOW_STUB=1` trên bản phụ), quay dự phòng từng đoạn.
