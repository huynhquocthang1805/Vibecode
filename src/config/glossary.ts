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
    'Dự kiến cuối kỳ = thực tế đến hôm nay + dự báo phần còn lại của tháng hoặc quý. Đây là ước tính, không phải số thực tế, và có thể thay đổi khi có số liệu mới.',
  likeForLike:
    'So sánh công bằng: kỳ đang chạy dở được so với cùng số ngày đầu của kỳ trước (VD 1–29/10 so với 1–29/09).',
  forecastInterval:
    'Khoảng dự báo 80% hoặc 95% thể hiện mức bất định ước tính quanh kết quả dự báo. Khoảng rộng nghĩa là khó đoán hơn; đây không phải cam kết kết quả thực tế sẽ nằm trong khoảng đó.',
  anomaly:
    'Bất thường là số liệu tăng hoặc giảm khác rõ so với các ngày trước. Hãy kiểm tra cách nhập và hoạt động chiến dịch trước khi kết luận nguyên nhân.',
  missingValue:
    'Dấu “—” nghĩa là chưa tính được chỉ số, không phải bằng 0. Hãy kiểm tra số liệu dùng làm mẫu số hoặc kỳ so sánh.',
};

// Giữ alias đã xuất ở PR45, dùng chung định nghĩa.
Object.assign(GLOSSARY, {
  CTR: GLOSSARY.ctr,
  CPC: GLOSSARY.cpc,
  CPA: GLOSSARY.cpa,
  CVR: GLOSSARY.cvr,
  'khoảng tin cậy': GLOSSARY.forecastInterval,
  'bất thường': GLOSSARY.anomaly,
});

/** Tra cứu không phân biệt hoa thường, không trả thuộc tính prototype. */
export function glossaryFor(term: string): string | null {
  const key = term.trim().toLocaleLowerCase('vi');
  const found = Object.entries(GLOSSARY).find(([name]) => name.toLocaleLowerCase('vi') === key);
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
