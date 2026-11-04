// Owner: ba-analyst — BA-02 (techlead điền thay Nhân 2026-11-04). docs/05 §6 bước 6.
// Cụm "nói chung chung" trong gợi ý AI. Guardrail so khớp sau khi bỏ dấu + chữ thường,
// nên chỉ cần 1 cách viết (hoá/hóa đều khớp). Gợi ý chứa cụm này mà ngắn (< 40 ký tự)
// hoặc không có con số nào → bị thay bằng gợi ý dự phòng.
// Thêm cụm mới: viết đúng cụm marketer hay gặp, KHÔNG thêm từ đơn ("tối ưu") vì sẽ bắt nhầm gợi ý tốt.

export const BANNED_PHRASES: readonly string[] = [
  // docs/05 §4 quy tắc 4 — ví dụ cấm gốc
  'tối ưu chiến dịch',
  'cải thiện nội dung',
  // biến thể hay gặp trong output LLM tiếng Việt
  'tối ưu hoá',
  'cải thiện hiệu quả',
  'nâng cao hiệu quả',
  'tăng cường quảng cáo',
  'đẩy mạnh quảng cáo',
  'tăng tương tác',
  'cải thiện chiến dịch',
  'tối ưu ngân sách',
  'tiếp tục theo dõi',
  'theo dõi thêm',
];
