# Bộ câu hỏi phản biện (bản khởi đầu — pm-release bổ sung tới ≥ 20 câu)

| # | Câu hỏi | Trả lời gợi ý | Người trả lời |
|---|---|---|---|
| 1 | Sao không làm backend/database? | Đề không yêu cầu và không cộng điểm vì nhiều công nghệ. Yêu cầu là localStorage. Backend duy nhất là API route giữ key AI. Ít thành phần = ít điểm hỏng. | Techlead |
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
