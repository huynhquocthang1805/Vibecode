# Handoff — REVIEW-QA04-FC10 · Đóng BUG-QA04-01 + review tab nhận (vai Huy) + review FC-10 (vai Thắng 2)
- **Role:** techlead (làm thay qa-engineer / data-engineer / forecast-engineer theo yêu cầu chủ dự án)   **Người:** Thắng · Claude Code   **Nhánh:** feat/techlead/REVIEW-QA04-FC10   **Thời gian:** 2026-11-07
- **Contracts:** đã đọc `domain.ts` — không đổi chữ ký public ✅ (`winsorize` là hàm nội bộ của `robust.ts`, không có trong docs/10)

## 1. Retest BUG-QA04-01 trên deploy (vai Nhân) → **Closed**
- `BASE_URL=https://vibecode-three-xi.vercel.app npx playwright test tests/e2e/crosstab.spec.ts --repeat-each=3` → **6/6 pass** (desktop + iPhone 12), main `210b72f`.
- Toàn bộ e2e trên deploy: 44/46. 2 lỗi = `account.spec` A1 trên 2 viewport: `apiRequestContext.get: getaddrinfo ENOTFOUND` — request context Node của Playwright không đi qua proxy của môi trường cloud. Đây là lỗi **môi trường test**, không phải sản phẩm: `curl` cùng deploy → `/api/account/profile` 401, `/api/auth/get-session` 200 (DB + tài khoản đã bật → ACC-07 đánh [x]).

## 2. Review phần lưu ở tab nhận (vai Huy) — 1 lỗi, đã sửa
- **Lỗi:** TL-06d cho `applyRemoteDelta` gọi `schedulePersist`. Nếu delta từ tab khác tới khi tab nhận **chưa hydrate** (đang đọc localStorage), store lúc đó rỗng → áp delta lên trạng thái rỗng rồi lên lịch lưu → ghi đè dữ liệu đã lưu bằng đúng 1–vài dòng vừa nhận. Cửa sổ thời gian ngắn nhưng mất dữ liệu là không chấp nhận được (CLAUDE.md §8: đúng nghiệp vụ > ổn định).
- **Sửa (`src/lib/data/store.ts`):** chưa hydrate → xếp delta vào hàng đợi (`MAX_PENDING_REMOTE = 100`, quá thì bỏ — tab vẫn đọc bản lưu khi hydrate xong); hydrate xong (cả nhánh có dữ liệu lẫn nhánh lỗi/rỗng) gọi `drainPendingRemote()` áp lần lượt.
- **Test (`remotePersist.test.ts`):** "delta tới khi CHƯA hydrate → không áp, không ghi" — 0 lần save khi chưa hydrate; sau hydrate + drain lưu đủ 3 ngày (2 cũ + 1 mới); drain lần 2 trả 0. Đã xác nhận test **đỏ** khi bỏ guard.

## 3. Review FC-10 (vai Thắng 2) — 3 lỗi, đã sửa
Thăm dò trên bộ dữ liệu test (DATA-12) và fixture:
| Ca | Bản FC-10 đầu | Sau review |
|---|---|---|
| Bộ "weekend" (đơn T7–CN cao ×2,3) | kẹp **12/42** ngày → mất mùa vụ cuối tuần | 0 |
| Chiến dịch mới tăng ×20 trong 90 ngày | kẹp 3 ngày mới nhất → dự báo 3738 thay vì ~4000 | 0, dự báo ≥ 90% mức cuối |
| campaign-2y (Tết nhiều ngày, 11/11) | — (bản cùng-thứ chưa có điều kiện đỉnh lẻ kẹp 13 ngày, orders rơi khỏi Holt-Winters) | Tết giữ nguyên, Holt-Winters |
| Ngày gõ nhầm ×100 (kể cả ngày mới nhất) | kẹp | kẹp |

- **`winsorize(values, dates, k)`** (đổi chữ ký nội bộ): tham chiếu = median các ngày **cùng thứ trong 4 tuần trước** (nhân quả, áp được cho ngày mới nhất); 2 tuần đầu → median các ngày cùng thứ khác trong chuỗi → median cả chuỗi. Chỉ kẹp **phía trên**, tại `ref + max(5·MAD phần dư, 125%·ref, 5 đơn vị)`, và **chỉ đỉnh đơn lẻ** (ngày kề cũng vượt → đợt thật). Ngày giảm/0 giữ nguyên (có thể là tạm dừng thật).
- **`forecast.ts`:** robust chỉ chạy trên cửa sổ fit 365 ngày (docs/04 §3) — khoảng trống/ngày nhầm cũ hơn 1 năm không làm lệch ngưỡng kẹp hay điểm cắt. Test: kết quả chuỗi 520 ngày (có khoảng trống + ×100 ở năm trước) **bằng đúng** kết quả 365 ngày cuối.
- docs/13 §5 cập nhật mô tả winsorize.

## File thay đổi
- `src/lib/data/store.ts`, `src/lib/data/remotePersist.test.ts`
- `src/lib/analytics/robust.ts`, `src/lib/analytics/robust.test.ts`, `src/lib/analytics/forecast.ts`
- `docs/bugs.md`, `docs/13_SCALE_RESILIENCE.md`, `TASKS.md`

## Kiểm thử
- `npm run lint` ✅ · `npm run typecheck` ✅ · `npm run test` → 4234 passed + 1 expected fail (BUG-QA03-01) ✅
- `src/lib/analytics/robust.test.ts`: 17 test (thêm 7, sửa 2: ngày mới nhất, hằng + đỉnh (nay kẹp), ngày giảm, weekend, ×20, đơn ít, đợt nhiều ngày, cửa sổ 365).
- `tests/integration/pipeline.review.test.ts` (campaign-2y chọn Holt-Winters) ✅ · FC-09 forecastValidation ✅.
- `npm run build` ✅ · e2e local (`next start`, AI stub) **46/46** ✅

## Hạn chế / nợ kỹ thuật
- Đỉnh sale **1 ngày** thật (11/11) vẫn bị kẹp khi fit — chủ ý: không lặp theo tuần nên không nên kéo mức dự báo; dữ liệu gốc + anomaly vẫn thấy giá trị thật.
- account.spec A1 không chạy được từ môi trường cloud tới deploy (proxy) — chạy được từ máy thường/CI.

## Ghi chú dùng AI
| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-07 | qa-engineer (techlead làm) | REVIEW-QA04-FC10 | Chạy crosstab.spec trên deploy, phân loại 2 lỗi A1 là do môi trường | Test | — | docs/bugs.md |
| 2026-11-07 | data-engineer review | REVIEW-QA04-FC10 | Tìm race delta trước hydrate ghi đè dữ liệu do chính TL-06d gây ra; thêm hàng đợi + test đỏ→xanh | Review/Fix | Bản TL-06d của AI thiếu guard hydrate | store.ts |
| 2026-11-07 | forecast-engineer review | REVIEW-QA04-FC10 | Thăm dò winsorize trên bộ dữ liệu test → kẹp sai cuối tuần/tăng trưởng; viết lại theo cùng thứ + đỉnh đơn lẻ | Review/Fix | Bản sửa đầu vẫn kẹp 2 ngày đầu chuỗi và Tết — test tích hợp campaign-2y bắt được | robust.ts |
