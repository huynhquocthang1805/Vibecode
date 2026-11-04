// Owner: ba-analyst — BA-02 (techlead điền thay Nhân 2026-11-04); BA-07 mở rộng tooltip/microcopy.
// Giải thích cho marketer không rành Excel: nghĩa + công thức + chiều tốt/xấu (docs/03 §1, §3).
// Khoá theo Metric — KpiCards hiển thị GLOSSARY[metric] trong tooltip.

export const GLOSSARY: Record<string, string> = {
  reach: 'Số người đã nhìn thấy quảng cáo. Càng cao càng nhiều người biết đến chiến dịch.',
  clicks: 'Số lần người xem bấm vào quảng cáo. Không thể lớn hơn reach.',
  cost: 'Tiền đã chi cho quảng cáo (VND). Chi phí tăng chỉ tốt khi đơn hàng tăng nhanh hơn.',
  orders: 'Số đơn hàng có được từ quảng cáo. Càng cao càng tốt.',
  ctr: 'Tỉ lệ click = Click ÷ Reach. Cho biết quảng cáo có hấp dẫn không — càng cao càng tốt.',
  cpc: 'Chi phí mỗi click = Chi phí ÷ Click. Càng thấp càng tốt; tăng là đang trả đắt hơn cho mỗi lượt bấm.',
  cpa: 'Chi phí mỗi đơn = Chi phí ÷ Số đơn. Chỉ số quan trọng nhất — càng thấp càng tốt. Chưa có đơn thì hiện "—".',
  cvr: 'Tỉ lệ chuyển đổi = Đơn ÷ Click. Bao nhiêu phần trăm người bấm vào đã mua — càng cao càng tốt.',
  nowcast: 'Dự kiến cuối kỳ = số thực tế đến hôm nay + dự báo cho những ngày còn lại của tháng/quý.',
  likeForLike:
    'So sánh công bằng: kỳ đang chạy dở được so với cùng số ngày đầu của kỳ trước (VD 1–29/10 so với 1–29/09).',
  forecastInterval: 'Khoảng dự báo: con số thực tế có khả năng cao nằm trong khoảng này (80% hoặc 95%).',
};
