import type { RawInsightOutput } from '../schemas';
import type { LlmProvider } from './types';

export interface StubProviderOptions {
  mockResponse?: RawInsightOutput;
  simulateError?: string;
  delayMs?: number;
}

export class StubProvider implements LlmProvider {
  readonly name = 'stub';
  private readonly options: StubProviderOptions;

  constructor(opts?: StubProviderOptions) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_STUB !== '1') {
      throw new Error('PROVIDER_ERROR: Stub provider bị cấm ở môi trường production trừ khi có ALLOW_STUB=1.');
    }
    this.options = opts ?? {};
  }

  async generateJson(
    _system: string,
    _user: string,
    _jsonSchema: object,
    opts: { timeoutMs: number; temperature: number },
  ): Promise<unknown> {
    if (this.options.simulateError) {
      throw new Error(`PROVIDER_ERROR: ${this.options.simulateError}`);
    }

    if (this.options.delayMs) {
      if (this.options.delayMs > opts.timeoutMs) {
        await new Promise((r) => setTimeout(r, opts.timeoutMs));
        throw new Error('TIMEOUT: Quá thời gian chờ stub provider.');
      }
      await new Promise((r) => setTimeout(r, this.options.delayMs));
    }

    if (this.options.mockResponse) {
      return this.options.mockResponse;
    }

    const defaultMock: RawInsightOutput = {
      overall: 'up',
      headline: 'Hiệu quả chiến dịch đang tăng trưởng tốt nhờ tối ưu chuyển đổi.',
      metricComments: [
        {
          metric: 'orders',
          direction: 'up',
          changePct: 20,
          comment: 'Đơn hàng tăng trưởng 20% so với kỳ trước.',
        },
        {
          metric: 'cpa',
          direction: 'down',
          changePct: -10,
          comment: 'Chi phí trên mỗi đơn hàng giảm 10% mang lại hiệu quả tốt.',
        },
      ],
      forecastComment: 'Dự báo xu hướng tích cực sẽ tiếp tục duy trì đến cuối tháng.',
      suggestions: [
        {
          title: 'Tăng ngân sách nhóm sản phẩm bán chạy',
          action: 'Tăng ngân sách 15% cho nhóm sản phẩm chủ lực trong 3 ngày tới.',
          rationale: 'CPA đang ở mức thuận lợi thấp hơn mức trung bình.',
          expectedImpact: 'Gia tăng số lượng đơn hàng thêm 15% - 25%.',
          priority: 'high',
          relatedMetrics: ['orders', 'cost', 'cpa'],
        },
        {
          title: 'Làm mới hình ảnh quảng cáo tiếp cận',
          action: 'Thay thế 2 mẫu ảnh có CTR thấp bằng hình ảnh chụp thực tế.',
          rationale: 'CTR bắt đầu có dấu hiệu chững lại sau 10 ngày phân phối.',
          expectedImpact: 'Cải thiện tỉ lệ nhấp CTR thêm 0.4%.',
          priority: 'medium',
          relatedMetrics: ['ctr', 'clicks'],
        },
        {
          title: 'Thiết lập khung giờ đẩy mạnh ngân sách',
          action: 'Tập trung chi tiêu vào khung giờ 19h đến 22h các ngày trong tuần.',
          rationale: 'Lượng chuyển đổi tập trung chủ yếu vào buổi tối.',
          expectedImpact: 'Tối ưu hiệu quả chi tiêu theo hành vi mua hàng.',
          priority: 'low',
          relatedMetrics: ['cost', 'orders'],
        },
      ],
      riskFlags: ['Theo dõi biến động giá thầu vào các ngày cuối tuần.'],
    };

    return defaultMock;
  }
}

