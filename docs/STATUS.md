# STATUS — 2026-11-02

Owner: pm-release (Thắng + Claude).

## Đã xong
- Phân công 5 người + quy trình nhánh/PR (`TEAM.md`).
- Đặc tả dữ liệu lớn & xử lý lỗi (`docs/13`), hợp đồng v1 **đóng băng**.
- **Wave 0 techlead: TL-01 · TL-02 · TL-03 · TL-04** — repo chạy được, stub đầy đủ, CI.
- **BA-01 (Nhân)** — merge 2026-11-01: docs/03 + 81 ca biên; techlead kiểm 71/71 ca hàm khớp oracle độc lập. Huy dùng ngay cho DATA-01/02; Nhân dùng cho QA-01.
- **DATA-01..04 + FC-01 (Huy)** — merge 2026-11-02: store thật thay store tạm. Còn 5 lỗi R-01..R-05 → **DATA-FIX-01 (P0)**.

## Mở khoá ngay (W1 bắt đầu được)
| Người | Bắt đầu |
|---|---|
| Huy | **DATA-FIX-01** → DATA-05-lite (snapshot P0) |
| Hoàng Anh | AI-01 → AI-03 → AI-02 |
| Trường | FD-01 → FD-02 → FD-03 |
| Nhân | ~~BA-01~~ ✅ → BA-05 → BA-02 → QA-01 |

## Bị chặn / rủi ro
- Chưa có link Vercel preview (Gate G1 cần) → Thắng kết nối Vercel.
- Chưa bật branch protection → ai cũng có thể push nhầm lên `main`.

## Quyết định cần chủ dự án
- Không có.
