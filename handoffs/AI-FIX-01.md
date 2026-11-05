# Handoff — AI-FIX-01 · useInsights: Chặn gọi khi thiếu dữ liệu (E26), gộp request trùng, khoá effect theo cacheKey & chống race condition
- **Role:** `ai-engineer`   **Người:** Hoàng Anh · Gemini (Argon)   **Nhánh:** `feat/ai-engineer/AI-FIX-01`   **Thời gian:** 2026-11-05 10:15
- **Contracts:** đã đọc `domain.ts` v1 và `docs/10_CONTRACTS.md §E` — không đổi chữ ký ✅

## Đã làm
- **Sửa R-02 (Cao) — Chặn gọi khi thiếu dữ liệu (E26)**:
  - Trong `useInsights`: nếu `snap === null` hoặc `!snap.trend?.dataQuality.sufficient` (dữ liệu < 3 ngày), lập tức trả về `{ data: null, status: 'idle', refresh }` và không kích hoạt `fetch` trong `useEffect`.
  - Trong `refresh()`: chặn gọi API nếu dữ liệu chưa đủ điều kiện `sufficient = true`.
  - Khắc phục triệt để lỗi khi mở trang trống / chưa có dữ liệu gửi POST `/api/insights` với range rỗng gây lỗi `400 BAD_REQUEST`.
  - Bỏ `test.fail` ở bài kiểm thử E2E `F4 · E26` trong `tests/e2e/g1-smoke.spec.ts`.
- **Sửa R-03 (Trung bình) — Gộp request trùng (In-flight request deduplication)**:
  - Khởi tạo bộ lưu trữ request đang bay ở cấp module: `inflightRequests = new Map<string, Promise<FetchOutcome>>()`.
  - Khi nhiều component (ví dụ `DashboardPage` cho nút xuất báo cáo và `AiInsightCard`) cùng gọi `useInsights` với cùng một snapshot/cacheKey, request thứ hai sẽ tái sử dụng lại Promise đang bay thay vì gửi thêm request thứ hai.
  - Tự động hiển thị trạng thái `loading` ngay từ render đầu tiên nếu tái sử dụng promise đang bay của instance khác.
  - Thêm cơ chế broadcast kết quả qua `subscribers` cho các hook cùng lắng nghe `cacheKey`, giúp tất cả các instance luôn đồng bộ trạng thái khi một bên tải xong hoặc gọi `refresh()`.
- **Sửa R-04 (Thấp) — Khoá effect theo cacheKey + revision**:
  - Tách các khoá định danh nguyên thuỷ: `isSufficient`, `cacheKey` (`makeCacheKey(campaignId, grain, rangeKey)`), và `revision`.
  - Khoá mảng phụ thuộc của `useEffect` theo `[isSufficient, cacheKey, revision, applyOutcome, fetchInsights]`.
  - Khi caller re-render liên tục và sinh ra object snapshot mới (nhưng cùng `cacheKey` và `revision`), effect không bị chạy lại, loại bỏ nguy cơ lặp vô hạn.
  - Tuân thủ nghiêm ngặt quy tắc của React 19 linter (`react-hooks/refs` và `react-hooks/set-state-in-effect`), không cập nhật ref hay setState đồng bộ trong effect body.
- **Sửa R-05 (Trung bình) — Chống race condition ghi đè kết quả cũ khi đổi cacheKey hoặc unmount**:
  - Chuyển logic broadcast vào trực tiếp bên trong `executeApiRequest`: chỉ phát duy nhất một lần tới các subscriber đang active của đúng `cacheKey` đó, loại bỏ hoàn toàn nhánh `else { applyOutcome(outcome); }` nguy hiểm.
  - Thêm `activeKeyRef` theo dõi cacheKey hiện hành của hook; subscriber kiểm tra `activeKeyRef.current === cacheKey` trước khi cập nhật state và refs, đảm bảo khi người dùng chuyển grain (Ngày → Tuần/Tháng), request cũ về chậm sẽ bị bỏ qua và không đè lên dữ liệu mới (kể cả khi key mới lấy từ cache hay từ network).
  - Unmount giữa chừng huỷ đăng ký subscriber an toàn, không gọi setState trên component đã unmount.

## File thay đổi
- `src/lib/ai/useInsights.ts`: Triển khai R-02, R-03, R-04, R-05, in-flight request dedup, broadcast subscribers một nơi và guard activeKey.
- `src/lib/ai/useInsights.test.tsx`: Bổ sung 7 unit test mới cho R-02, R-03, R-04, và 3 test ca biên R-05 (tổng 11 tests).
- `tests/integration/fd-review.review.test.tsx`: Chuyển 2 test nghiệm thu R-02 và R-03 từ `it.fails` sang `it` thường (đều pass).
- `tests/e2e/g1-smoke.spec.ts`: Bỏ `test.fail` tại test `F4 · E26` theo đúng chỉ dẫn của GATE-G1.

## API / component công khai
```ts
export function useInsights(snap: AnalyticsSnapshot | null): UseInsightsResult;
export function _resetInflightState(): void; // Helper dọn dẹp cho test runner
```

## Kiểm thử
- `npm run lint`: Xanh (0 warning, 0 error).
- `npm run typecheck`: Xanh (0 type error).
- `npm run test`: **63 test files passed (3,936 passed, 0 failed)**.
- `npx vitest run src/lib/ai/useInsights.test.tsx`: 11 passed / 0 failed.
- `npx vitest run tests/integration/fd-review.review.test.tsx`: 3 passed / 0 failed.
- `npm run build`: Xanh (tất cả 9 routes build thành công).

## Cách dùng cho người nhận
- Dùng bình thường `const { data, status, error, refresh } = useInsights(snapshot);`. Hook tự động xử lý an toàn khi snapshot rỗng, thiếu dữ liệu hoặc khi chuyển đổi nhanh giữa các khoảng/grain mà không cần caller phải guard ở ngoài.

## Hạn chế / nợ kỹ thuật
- Không có.

## Cần người khác làm
- Techlead: Review và merge PR vào `main`.

## Ghi chú dùng AI
| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-05 10:05 | ai-engineer | AI-FIX-01 | Sửa R-02 guard sufficient (E26), R-03 in-flight request dedup, R-04 khoá effect theo cacheKey+revision | fix | React 19 cảnh báo ref trong render và setState trong effect; sửa thành effect ref và derived state | src/lib/ai/useInsights.ts, src/lib/ai/useInsights.test.tsx, tests/integration/fd-review.review.test.tsx, tests/e2e/g1-smoke.spec.ts |
| 2026-11-05 10:15 | ai-engineer | AI-FIX-01 | Sửa R-05 chống race condition đè kết quả khi đổi grain hoặc unmount, thêm 3 unit test | fix | Không có | src/lib/ai/useInsights.ts, src/lib/ai/useInsights.test.tsx |
