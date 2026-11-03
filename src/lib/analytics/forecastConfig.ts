/**
 * FC-02..06: giá trị theo docs/04, tập trung tạm tại analytics theo kế hoạch đã duyệt.
 * BA-02/techlead chuyển cấu hình nghiệp vụ sang config/thresholds.ts khi tích hợp.
 * Giới hạn dữ liệu vẫn chỉ lấy từ LIMITS (domain.ts).
 */
export const FORECAST_CONFIG = {
  seasonLength: 7,
  movingWindow: 7,
  minDays: 7,
  holtMinDays: 14,
  seasonalMinDays: 14,
  wintersMinDays: 28,
  grid: [0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9],
  damping: 0.98,
  backtestHorizon: 7,
  backtestFolds: 3,
  minImprovement: 0.05,
  highSmape: 15,
  mediumSmape: 30,
  z80: 1.2816,
  z95: 1.96,
} as const;
