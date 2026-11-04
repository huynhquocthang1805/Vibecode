import type { AnalyticsSnapshot } from '@/types/domain';

/** Chỉ nạp bộ minh hoạ khi người dùng yêu cầu. Tách loader để kiểm thử lỗi mạng. */
export async function loadReviewFixture(): Promise<AnalyticsSnapshot> {
  const { default: fixture } = await import('./reviewFixture.json');
  return fixture as AnalyticsSnapshot;
}
