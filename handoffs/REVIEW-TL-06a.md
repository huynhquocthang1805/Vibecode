# Review TL-06a — Ghép `today` thật + E2E smoke Gate G1 · **APPROVE**

## Vòng 1
| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ không có lỗi chặn |
| `npm run check` | ✅ lint · typecheck · vitest 42 file, 3.779 pass + 11 expected-fail, 0 fail |
| `npm run build` | ✅ exit 0 (`/` static, `/api/insights` dynamic) |
| Hợp đồng `domain.ts` / `docs/10` | ✅ không đổi |
| Ownership | ✅ techlead: `DashboardPage.tsx`, `pr-guard.mjs`, handoffs; `tests/e2e` do techlead mồi, QA-04 tiếp quản (ghi trong handoff) |
| Không `any` / `ts-ignore` / `console.log` / secret | ✅ |
| `today` theo giờ VN | ✅ `todayVN()` qua `useSyncExternalStore` (server snapshot `''` → tránh `new Date()` lúc prerender Next 16) |
| Test ca lỗi / biên | ✅ E2E: validation click > reach, trang trống (E26), 375px không tràn ngang, reload giữ dữ liệu |
| Handoff + log AI | ✅ `handoffs/TL-06a.md`, `handoffs/GATE-G1.md` |

## Lỗi phải sửa
Không có.

## Lưu ý không chặn
- `test.fail` ở E26 (R-02, AI-FIX-01) và F5 (AI-08) là chủ ý, đã ghi trong GATE-G1; phải bỏ khi hai task đó merge, nếu không E2E sẽ đỏ vì "unexpectedly passed".
- Lần đầu render `today = ''` → `useAnalytics` chạy với `today` rỗng một nhịp; hook không throw nên chấp nhận được, nhưng nên bỏ qua query khi `today === ''` (TL-06).
- Tôi không chạy Playwright trong review này (cần trình duyệt); dựa vào kết quả 14 passed trong handoff.
- G1 vẫn CHƯA ĐẠT (3 việc chặn) — TL-06 giữ `[~]`.

## Điểm tốt
- Chấm G1 trung thực, tách rõ việc chặn / không chặn, thứ tự merge rõ ràng.
- E2E tính tay KPI (2,19% · 5.441 · 132.143) khớp "tỉ số của tổng", chạy cả desktop và iPhone 12.
- Ghi lại cả những lần AI sai (`useState` → lỗi build) trong log AI.
