// Owner: ba-analyst — BA-07. Theo quy ước KPI của ứng dụng, không phải mọi nền tảng quảng cáo.
// Mỗi tooltip tối đa hai câu; KPI của nhiều ngày dùng tỉ số của tổng (docs/03).
// Khoá theo Metric — KpiCards hiển thị GLOSSARY[metric] trong tooltip.

export const GLOSSARY: Record<string, string> = {
  reach:
    'Lượt tiếp cận bạn nhập cho từng ngày. Tổng nhiều ngày là cộng các lượt, không phải số người duy nhất của cả kỳ.',
  clicks: 'Số lượt bấm vào quảng cáo bạn ghi nhận. Trong ứng dụng này, số click không được lớn hơn reach cùng ngày.',
  cost: 'Số tiền đã chi cho quảng cáo, tính bằng đồng Việt Nam. Cần xem cùng số đơn và CPA để đánh giá hiệu quả.',
  orders: 'Số đơn hàng bạn ghi nhận cho chiến dịch. Nhiều đơn hơn cần được xem cùng chi phí để đánh giá hiệu quả.',
  ctr: 'Tỉ lệ click = Tổng Click ÷ Tổng Reach, hiển thị theo phần trăm. Reach bằng 0 thì hiện “—” vì chưa tính được.',
  cpc: 'Chi phí mỗi click = Tổng Chi phí ÷ Tổng Click, tính bằng đồng. Thấp hơn nghĩa là trả ít tiền hơn mỗi lượt bấm; chưa có click thì hiện “—”.',
  cpa: 'Chi phí mỗi đơn = Tổng Chi phí ÷ Tổng Số đơn, tính bằng đồng. Thấp hơn nghĩa là trả ít tiền hơn mỗi đơn; chưa có đơn thì hiện “—”.',
  cvr: 'Tỉ lệ chuyển đổi = Tổng Đơn ÷ Tổng Click, hiển thị theo phần trăm. Chưa có click thì hiện “—”; có thể vượt 100% khi số đơn lớn hơn click, hãy kiểm tra cách ghi nhận.',
  nowcast:
    'Dự kiến cuối kỳ = thực tế đến hôm nay + dự báo phần còn lại của tháng hoặc quý. Đây là ước tính có thể thay đổi khi có số liệu mới.',
  likeForLike:
    'So sánh công bằng: kỳ đang chạy dở được so với cùng số ngày đầu của kỳ trước (VD 1–29/10 so với 1–29/09).',
  forecastInterval:
    'Khoảng dự báo 80% hoặc 95% thể hiện mức bất định ước tính quanh kết quả dự báo. Khoảng rộng nghĩa là khó đoán hơn; đây không phải cam kết kết quả thực tế sẽ nằm trong khoảng đó.',
  anomaly:
    'Bất thường là số liệu tăng hoặc giảm khác rõ so với các ngày trước. Hãy kiểm tra cách nhập và hoạt động chiến dịch trước khi kết luận nguyên nhân.',
  missingValue:
    'Dấu “—” nghĩa là chưa tính được chỉ số, không phải bằng 0. Hãy kiểm tra số liệu dùng làm mẫu số hoặc kỳ so sánh.',
};
