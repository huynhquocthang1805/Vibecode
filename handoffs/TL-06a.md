# Handoff — TL-06a · Ghép trang + E2E smoke Gate G1 (phần 1 của TL-06)
- **Role:** techlead   **Người:** Thắng · Claude   **Nhánh:** feat/techlead/TL-06a   **Thời gian:** 2026-11-04
- **Contracts:** không đổi `domain.ts` / `docs/10` ✅

## Đã làm
- `src/app/DashboardPage.tsx`: `today` = `todayVN()` (bỏ tạm "ngày cuối của dữ liệu") — đọc qua `useSyncExternalStore` vì Next 16 Cache Components cấm `new Date()` khi prerender (thử `useState(() => todayVN())` → build lỗi "unstable value new Date()"; `setState` trong effect → lint `react-hooks/set-state-in-effect`). Bỏ nhãn "… dòng (store tạm)" còn sót (Shell đã có badge số dòng).
- `tests/e2e/g1-smoke.spec.ts`: 7 kịch bản G1 × 2 project (chromium-desktop, iphone-12) — nhập 3 ngày, validation, KPI tính tay, reload, biểu đồ, AI 3 gợi ý (stub), E26, xuất báo cáo, 375px. 2 kịch bản chưa đạt đánh `test.fail` (đã kiểm thất bại đúng lý do: E26 nhận 2 request; F5 dialog báo "chưa sẵn sàng").
- `handoffs/GATE-G1.md`: chấm G1 lần 1 — CHƯA ĐẠT, 3 việc chặn.

## Kiểm thử
- `npm run lint` · `typecheck` · `test` (3.779 pass) · `build` (exit 0, không cảnh báo) ✅
- `BASE_URL=http://localhost:3130 PW_CHROMIUM_PATH=… npx playwright test tests/e2e/g1-smoke.spec.ts` (server `AI_PROVIDER=stub ALLOW_STUB=1`) → **14 passed** (10 xanh thật + 4 expected-fail).

## Cần người khác làm
- Nhân: mở PR BA-03-code. · Hoàng Anh: AI-FIX-01. · Thắng 2: AI-08. · Nhân/QA-04: mở rộng E2E này thành 8 spec docs/08 §4.
- TL-06 (ký G1) giữ `[~]` tới khi 3 việc chặn xong.

## Ghi chú dùng AI
| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-04 | techlead (Claude) | TL-06a | Ghép today thật, E2E G1, chấm G1 | Sinh code | AI dùng `useState(() => todayVN())` → build Next 16 lỗi (new Date() lúc prerender), thử effect → lint chặn; đúng là `useSyncExternalStore`. E2E F5 lần đầu tưởng thất bại sai lý do do grep trộn log 2 test — chạy riêng xác nhận đúng | `DashboardPage.tsx`, `g1-smoke.spec.ts` |
