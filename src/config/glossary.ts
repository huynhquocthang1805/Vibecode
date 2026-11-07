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
  cvr: 'Tỉ lệ chuyển đổi = Đơn ÷ Click. Bao nhiêu phần trăm người bấm vào đã mua — càng cao càng tốt.',  nowcast: 'Ước tính kết quả cuối tháng hoặc quý từ dữ liệu đã có. Đây là dự báo, không phải số thực tế.',
  likeForLike:
    'So sánh công bằng: kỳ đang chạy dở được so với cùng số ngày đầu của kỳ trước (VD 1–29/10 so với 1–29/09).',
  forecastInterval: 'Khoảng dự báo: con số thực tế có khả năng cao nằm trong khoảng này (80% hoặc 95%).',
  CTR: 'Tỉ lệ người nhấp quảng cáo trong số người được tiếp cận. CTR = Lượt nhấp ÷ Lượt tiếp cận × 100%.',
  CPC: 'Số tiền trung bình trả cho mỗi lượt nhấp quảng cáo. CPC = Chi phí ÷ Lượt nhấp; chưa có lượt nhấp thì chưa tính được.',
  CPA: 'Số tiền trung bình để có một đơn hàng. CPA = Chi phí ÷ Số đơn; chưa có đơn thì chưa tính được.',
  CVR: 'Tỉ lệ lượt nhấp tạo ra đơn hàng. CVR = Số đơn ÷ Lượt nhấp × 100%; dữ liệu bất thường có thể khiến tỉ lệ vượt 100%.',
  'khoảng tin cậy': 'Khoảng giá trị mô hình dự báo cho kết quả; khoảng rộng cho thấy độ bất định lớn. Không bảo đảm kết quả thực tế sẽ nằm trong khoảng.',
  'bất thường': 'Ngày có chỉ số khác xa mức thông thường theo bộ phát hiện bất thường. Đây là dấu hiệu cần kiểm tra, không tự động kết luận sai sót.',
};


/** Tra cứu thuật ngữ, ưu tiên tên KPI viết hoa, vẫn giữ các khóa lowercase của dashboard. */
export function glossaryFor(term: string): string | null {
  const key = term.trim();
  const direct = GLOSSARY[key];
  if (direct !== undefined) return direct;
  const preferred = GLOSSARY[key.toUpperCase()];
  if (preferred !== undefined) return preferred;
  const found = Object.entries(GLOSSARY).find(([name]) => name.toLocaleLowerCase('vi') === key.toLocaleLowerCase('vi'));
  return found?.[1] ?? null;
}

/** Copy dành cho UI. Frontend owner sẽ áp dụng ở component của họ sau review. */
export const UI_MICROCOPY = {
  empty: {
    noEntries: {
      title: 'Chưa có dữ liệu quảng cáo',
      detail: 'Nhập số liệu của một ngày hoặc tải bộ dữ liệu mẫu để bắt đầu.',
      action: 'Thêm số liệu',
    },
    noResults: {
      title: 'Không tìm thấy dữ liệu phù hợp',
      detail: 'Thử chọn chiến dịch khác hoặc mở rộng khoảng ngày.',
      action: 'Đổi bộ lọc',
    },
    noForecast: {
      title: 'Chưa đủ dữ liệu để dự báo',
      detail: 'Thêm dữ liệu gần đây và thử lại. Chưa có dự báo không có nghĩa là kết quả bằng 0.',
    },
    noOrders: 'Chưa có đơn hàng nên CPA chưa tính được (—).',
  },
  loading: {
    data: 'Đang đọc dữ liệu…',
    import: 'Đang kiểm tra tệp nhập…',
    forecast: 'Đang tính dự báo…',
    insight: 'Đang phân tích số liệu…',
  },
  error: {
    invalidRow: 'Dòng này có thông tin chưa hợp lệ. Kiểm tra các ô được đánh dấu.',
    quota: 'Không đủ dung lượng lưu trên thiết bị. Hãy sao lưu dữ liệu trước khi xoá hoặc lưu trữ năm cũ.',
    worker: 'Đang chuyển sang chế độ tính toán tương thích. Dữ liệu đã lưu vẫn được giữ.',
    network: 'Không kết nối được dịch vụ phân tích. Bạn vẫn có thể xem số liệu và thử lại.',
    clipboard: 'Không sao chép tự động được. Hãy bôi đen nội dung và nhấn Ctrl+C.',
    stale: 'Dữ liệu đã cũ nên không thể ước tính kết quả tháng hoặc quý hiện tại.',
  },
  confirmations: {
    deleteAll: 'Xoá tất cả số liệu đã lưu trên thiết bị này? Hành động này không thể hoàn tác nếu chưa sao lưu.',
    importLimit: 'Tệp vượt giới hạn số dòng. Dữ liệu hiện có sẽ không bị thay đổi.',
    duplicate: 'Ngày này đã có dữ liệu. Chọn ghi đè, cộng dồn hoặc bỏ qua trước khi tiếp tục.',
  },
} as const;
