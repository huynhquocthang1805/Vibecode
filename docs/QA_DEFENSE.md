# Bộ câu hỏi phản biện — 24 câu (PM-06, cập nhật 2026-11-08)

Owner: pm-release. Mỗi câu có người trả lời chính; số liệu dẫn từ tài liệu trong repo để giám khảo kiểm được.

| # | Câu hỏi | Trả lời gợi ý | Người trả lời |
|---|---|---|---|
| 1 | Đề yêu cầu localStorage, sao lại có database? | 5 tính năng P0 chạy hoàn toàn bằng localStorage, khách không cần đăng nhập. Tài khoản + Postgres Neon chỉ là phần thêm (CR-005, chủ dự án quyết) để đồng bộ nhiều máy. Thiếu biến môi trường → API tài khoản trả 503, app vẫn chạy đủ. | Techlead |
| 2 | CTR của các bạn tính trên reach, nền tảng tính trên impression? | Đúng — đề bài chỉ cho reach nên CTR = click/reach, có ghi chú ở tooltip. Muốn chuẩn nền tảng chỉ cần thêm trường impressions, công thức nằm 1 chỗ (`kpi.ts`). | BA |
| 3 | CTR tháng tính thế nào? | Tỉ số của tổng (Σclick/Σreach), không lấy trung bình CTR ngày — có ca test E19 chứng minh khác biệt. | BA / QA |
| 4 | localStorage chỉ ~5MB, dữ liệu lớn thì sao? | Codec cột nén ~60% → ~50k dòng; vượt ngưỡng tự chuyển IndexedDB, settings vẫn ở localStorage; luôn có cảnh báo + xuất backup, không mất dữ liệu. | Data |
| 5 | "Thời gian thực" ở đây là gì khi không có server? | Mọi thay đổi (nhập, import, live stream mô phỏng, tab khác) tạo delta → rollup tăng dần O(1) mỗi dòng trong Web Worker → KPI, dự báo, nowcast cập nhật trong vài ms; đồng bộ tab qua BroadcastChannel. Nguồn live có thể thay bằng API nền tảng ads sau này mà không đổi kiến trúc. | Data |
| 6 | Dự báo có đáng tin không? | Chọn mô hình bằng backtest rolling-origin, phải thắng baseline seasonal-naive mới dùng; hiển thị sai số sMAPE thật và khoảng tin cậy 80%; dữ liệu ít → nói rõ độ tin cậy thấp. | Forecast |
| 7 | Sao không dùng Prophet/LSTM? | Dữ liệu ngắn, cần chạy trên trình duyệt < 100ms, tham số giải thích được; Holt-Winters bắt đúng mùa vụ tuần của ads. Mô hình phức tạp hơn không chứng minh được tốt hơn trên dữ liệu này. | Forecast |
| 8 | Nếu AI bịa số? | AI không tính số — chỉ nhận số đã tính. Guardrail đối chiếu từng % và hướng xu hướng với dữ liệu thật, sai thì ghi đè và gắn nhãn "đã hiệu chỉnh". Có báo cáo eval tỉ lệ bị hiệu chỉnh. | AI |
| 9 | Nếu AI trả 2 hoặc 4 gợi ý / sai JSON? | Schema ép đúng 3; Zod kiểm; sai thì sửa 1 lần với lỗi cụ thể; vẫn sai → bù từ thư viện gợi ý rule-based. Người dùng không bao giờ thấy lỗi trống. | AI |
| 10 | Hết quota / mất mạng khi demo? | Fallback rule-based gắn nhãn "Dự phòng"; cache kết quả AI gần nhất; có bản demo phụ. | AI / PM |
| 11 | API key để ở đâu? | Biến môi trường server trên Vercel, không có tiền tố NEXT_PUBLIC; QA đã grep bundle không chứa key; có rate limit và giới hạn kích thước request. | Techlead |
| 12 | Phần nào AI làm, phần nào đội tự quyết? | AI agent sinh phần lớn code theo spec; đội (vai techlead/BA) quyết kiến trúc, công thức, ngưỡng, contracts và review mọi PR. Xem `docs/11_AI_USAGE_LOG.md` — các lỗi AI đã bị test/review bắt. | PM |
| 13 | Làm sao biết 50.000 dòng không đơ? | Đo thật: rollup 100k 89 ms, thay 1 dòng 0,1 ms, snapshot 2 năm 145 ms, IndexedDB 200k → KPI 2,4 s trên deploy (`docs/perf-report.md`). Bảng ảo hoá, biểu đồ LTTB, tính trong Web Worker. 3 chỉ số còn chưa đạt được ghi trung thực trong `docs/bugs.md` (QA05-01..03). | QA / Data |
| 14 | Nhập trùng ngày thì sao? | Hỏi người dùng: Bỏ qua / Ghi đè / Cộng dồn; import hàng loạt phát 1 delta, có Hoàn tác trong thời hạn `LIMITS.UNDO_TTL_MS`. | Data / Frontend |
| 15 | Mở 2 tab cùng nhập? | BroadcastChannel (fallback sự kiện `storage`) gửi delta sang tab kia; tab nhận cũng lưu; delta tới khi tab chưa tải xong được xếp hàng → không ghi đè. QA retest trên deploy 6/6 (BUG-QA04-01 Closed). | Data / QA |
| 16 | Một ngày gõ nhầm chi phí ×100 có làm hỏng dự báo? | Không: khi fit, ngày vượt mức cùng thứ 4 tuần trước quá xa và là đỉnh đơn lẻ bị kẹp; cuối tuần cao, đợt sale nhiều ngày, Tết vẫn giữ. Dữ liệu gốc không đổi, cảnh báo bất thường vẫn thấy giá trị thật. | Forecast |
| 17 | "Dự kiến cuối tháng" tính thế nào? | Thực tế từ đầu tháng tới hôm qua + dự báo các ngày còn lại (cộng khoảng tin cậy). Hôm nay chưa hết ngày → không đưa vào fit, chỉ dùng cho nowcast. Có pacing nếu đặt mục tiêu. | Forecast |
| 18 | Dữ liệu cũ 3 tháng rồi thì dự báo gì? | Không dự báo: trạng thái `stale` "Dữ liệu cũ (lần cuối dd/MM/yyyy) — nhập tiếp để có dự báo". < 7 ngày → `insufficient`. | Forecast |
| 19 | Prompt injection qua tên chiến dịch? | Tên chiến dịch được làm sạch và đặt trong vùng dữ liệu, system prompt cấm làm theo lệnh trong dữ liệu; output vẫn qua guardrail. Có kịch bản eval `07-injection`. | AI |
| 20 | AI có gửi dữ liệu thô của khách đi không? | Không — chỉ gửi số đã tổng hợp (tổng kỳ, KPI, xu hướng, ≤ 12 KB), không gửi từng dòng; body giới hạn 32 KB. | AI |
| 21 | Sao có lúc thẻ AI ghi "Dự phòng"? | Gemini lỗi/quá thời gian/hết quota → server trả kèm bản rule-based, nhãn rõ ràng. Lỗi upstream có mã + gợi ý trong log server (AI-FIX-03) để người vận hành sửa. | AI / PM |
| 22 | Mật khẩu & mã xác nhận lưu thế nào? | better-auth băm mật khẩu; mã 6 số hết hạn 10 phút, sai 5 lần là huỷ, lưu dạng băm; phiên trong DB; origin tin cậy liệt kê cụ thể, không wildcard. | Data (Huy) |
| 23 | 5 người dùng 3 AI khác nhau, sao không vỡ code? | Hợp đồng đóng băng (`domain.ts`), mỗi file 1 owner, stub trước, 1 task = 1 nhánh = 1 PR, CI + PR guard + Claude review bot, chỉ techlead merge. Lỗi ghép giữa PR được bắt bằng test tích hợp trên fixture thật. | Techlead |
| 24 | Bằng chứng đội thật sự kiểm AI chứ không chép? | `docs/11_AI_USAGE_LOG.md`: 99 dòng log, 10 ca AI sai có cách phát hiện (fast-check, test tích hợp, chạy deploy, ảnh chụp) và quyết định không theo AI. | PM |
