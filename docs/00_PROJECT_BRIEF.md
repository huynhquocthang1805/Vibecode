# 00 — Project Brief: Đề 7 · Dashboard KPI Chiến dịch Mini

## Bối cảnh
Marketer cần theo dõi hiệu quả quảng cáo mỗi ngày nhưng không phải ai cũng rành Excel. Xây dashboard nhập liệu và đọc chỉ số tự động.

## Yêu cầu chức năng (P0 — bắt buộc)
| # | Yêu cầu | Task chính |
|---|---|---|
| F1 | Form nhập số liệu theo ngày: reach, click, chi phí, số đơn hàng; nhập nhiều dòng; lưu localStorage | DATA-01..04, FI-01, FI-02 |
| F2 | Biểu đồ đường/cột reach, chi phí, đơn hàng theo ngày | FD-03 |
| F3 | Tự động tính CTR, CPC, chi phí/đơn hàng | DATA-02, FD-02 |
| F4 | AI nhận xét xu hướng tăng/giảm + 03 gợi ý | FC-01, AI-01..07, FD-05 |
| F5 | Nút xuất báo cáo tóm tắt dạng text để copy | AI-08, BA-04, FD-06 |

## Mở rộng theo định hướng chủ dự án
| Mã | Tính năng | Mức |
|---|---|---|
| X1 | Tổng hợp Ngày / Tuần / Tháng / Quý, so sánh cùng kỳ like-for-like | P1 |
| X2 | Web Worker + incremental rollup (dữ liệu lớn, realtime) | P1 |
| X3 | Import CSV / dán từ Excel, bảng ảo hoá, biểu đồ LTTB | P1 |
| X4 | Dự báo Holt-Winters + khoảng tin cậy + backtest | P1 |
| X5 | Nowcast cuối tháng / cuối quý (thực tế + dự báo) | P1 |
| X6 | Live mode mô phỏng dữ liệu realtime trong ngày | P2 |
| X7 | Phát hiện bất thường realtime + toast cảnh báo | P2 |
| X8 | Đồng bộ nhiều tab | P2 |
| X9 | Mục tiêu tháng (ngân sách/đơn) + pacing | P2 |
| X10 | IndexedDB adapter khi vượt quota localStorage | P2 |

## Rubric chấm (100 điểm) → cách đội ăn điểm
| Tiêu chí | Điểm | Bằng chứng đội phải có | Owner chính |
|---|---|---|---|
| Hoàn thành chức năng & đúng nghiệp vụ | 25 | 5 tính năng chạy xuyên suốt; công thức đúng (tỉ số của tổng), ca biên đúng | TL, DATA, FD, BA |
| Thiết kế kỹ thuật & chất lượng mã | 20 | Kiến trúc rõ (docs/01), contracts, pure functions, TS strict, CI xanh, lý do chọn công nghệ | TL |
| Tích hợp AI & kiểm soát đầu ra | 15 | **AI thật** (mock tối đa 4/15!), structured output, Zod, đối chiếu số, đúng 3 gợi ý, fallback, eval report | AI, BA |
| Kiểm thử, ổn định, xử lý lỗi | 15 | Validation chặn dữ liệu sai, test unit/property/E2E, xử lý lỗi storage/AI/timeout | QA, DATA |
| Làm chủ Vibe Coding & phản biện | 15 | `docs/11_AI_USAGE_LOG.md`, thư mục `.claude/` (agents, rules, skills), ví dụ AI sai → đội sửa, bộ Q&A phản biện | PM, TL |
| Giao diện & trải nghiệm | 5 | Dễ thao tác, dễ đọc, dùng tốt trên mobile 375px | FD, FI |
| Triển khai & bàn giao | 5 | Link online Vercel, source, README hướng dẫn chạy, video đúng yêu cầu | PM |

Lưu ý ban tổ chức: không bắt buộc backend/database thật; **không cộng điểm vì dùng nhiều công nghệ** → mọi phần "big data / realtime / dự báo" chạy trong trình duyệt, không thêm hạ tầng, và mỗi lựa chọn phải giải thích được.

## Nguyên tắc vàng
1. P0 chạy end-to-end trước Gate G1. Không ai làm P2 khi G1 chưa qua.
2. Số liệu do **code** tính; AI chỉ **diễn giải**. AI nói sai số → guardrail sửa.
3. Mọi thứ hiển thị phải đọc được trên điện thoại.
