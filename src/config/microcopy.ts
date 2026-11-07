// BA-07: câu chữ dùng chung theo docs/06 §2 và docs/13 §7; frontend owner nối vào UI.
export interface StateMessage {
  title: string;
  description: string;
  action?: string;
}
type Section = 'dashboard' | 'chart' | 'forecast' | 'ai' | 'table';
type State = 'empty' | 'loading' | 'error';

export const UI_COPY = {
  dashboard: {
    empty: {
      title: 'Bắt đầu với số liệu chiến dịch',
      description: '1. Nhập số liệu theo ngày → 2. Xem chỉ số và biểu đồ → 3. Phân tích rồi sao chép báo cáo.',
      action: 'Dùng dữ liệu mẫu',
    },
    loading: { title: 'Đang mở số liệu…', description: 'Chờ một chút để xem chỉ số của chiến dịch.' },
    error: {
      title: 'Chưa tải được bảng tổng quan',
      description: 'Hãy thử tải lại phần này; nếu có cảnh báo chưa lưu, hãy xuất bản sao lưu trước khi tải lại trang.',
      action: 'Thử lại',
    },
  },
  chart: {
    empty: {
      title: 'Chưa có số liệu trong khoảng đang chọn',
      description: 'Nhập số liệu hoặc đổi chiến dịch và khoảng ngày để xem biểu đồ.',
      action: 'Nhập số liệu',
    },
    loading: {
      title: 'Đang cập nhật biểu đồ…',
      description: 'Số liệu đang hiển thị sẽ được giữ lại trong lúc tính kết quả mới.',
    },
    error: {
      title: 'Chưa hiển thị được biểu đồ',
      description: 'Bạn vẫn có thể xem số liệu trong bảng và thử tải lại biểu đồ.',
      action: 'Thử lại',
    },
  },
  forecast: {
    empty: {
      title: 'Cần ít nhất 7 ngày có số liệu để dự báo',
      description: 'Nhập thêm số liệu những ngày đã kết thúc để xem ước tính cuối kỳ.',
      action: 'Nhập số liệu',
    },
    loading: { title: 'Đang tính dự báo…', description: 'Ước tính sẽ cập nhật theo số liệu mới.' },
    error: {
      title: 'Chưa tính được dự báo',
      description: 'Số thực tế vẫn có thể xem bình thường; hãy thử lại phần dự báo.',
      action: 'Thử lại',
    },
  },
  ai: {
    empty: {
      title: 'Cần ít nhất 3 ngày có số liệu để AI phân tích',
      description: 'Nhập thêm số liệu để nhận nhận xét và 3 gợi ý cho chiến dịch.',
      action: 'Nhập số liệu',
    },
    loading: { title: 'AI đang đọc số liệu…', description: 'Bạn có thể tiếp tục xem chỉ số trong lúc chờ.' },
    error: {
      title: 'Chưa nhận được phản hồi từ AI',
      description: 'Nếu có bản nhận xét dự phòng, đó là gợi ý theo quy tắc từ số liệu, không phải phản hồi AI.',
      action: 'Thử lại',
    },
  },
  table: {
    empty: {
      title: 'Chưa có dòng nào',
      description: 'Nhập số liệu theo ngày hoặc dán bảng từ Excel để bắt đầu.',
      action: 'Nhập số liệu',
    },
    loading: { title: 'Đang tải bảng số liệu…', description: 'Chờ một chút để xem các dòng đã lưu.' },
    error: {
      title: 'Chưa hiển thị được bảng số liệu',
      description: 'Hãy thử tải lại phần bảng; thông báo này không có nghĩa dữ liệu đã bị xóa.',
      action: 'Thử lại',
    },
  },
} satisfies Record<Section, Record<State, StateMessage>>;

export const DEGRADED_COPY = {
  storage: {
    title: 'Dữ liệu mới đang lưu tạm trong tab',
    description: 'Hãy xuất bản sao lưu trước khi đóng hoặc tải lại trang để tránh mất phần chưa lưu.',
    action: 'Xuất bản sao lưu',
  },
  worker: {
    title: 'Đang dùng chế độ tương thích',
    description: 'Bạn vẫn có thể làm việc, nhưng xử lý số liệu có thể chậm hơn.',
  },
  sync: {
    title: 'Chưa đồng bộ được giữa các tab',
    description: 'Tránh sửa cùng dữ liệu ở nhiều tab; hãy sao lưu các thay đổi trước khi tải lại.',
    action: 'Xuất bản sao lưu',
  },
  forecastStale: {
    title: 'Số liệu gần nhất đã cũ',
    description: 'Nhập tiếp số liệu gần đây để có dự báo phù hợp.',
    action: 'Nhập số liệu',
  },
} satisfies Record<string, StateMessage>;
