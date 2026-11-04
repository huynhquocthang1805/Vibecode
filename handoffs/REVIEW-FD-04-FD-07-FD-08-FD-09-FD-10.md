# Review FD-04 + FD-07 + FD-08 + FD-09 + FD-10 (Trường) — PR #23 — techlead bot

## Vòng 1 — Verdict: **APPROVE** (FD-04/07/08/09 → `[x]`; **FD-10 giữ `[ ]`** vì chưa đạt bundle < 250 KB)

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ không lỗi chặn (34 file, đúng ownership frontend-dashboard + frontend-input) |
| `npm run check` | ✅ lint + typecheck sạch; 60 file, **3903 passed, 2 expected fail**, 0 failed |
| `npm run build` | ✅ biên dịch thành công, đủ route (cảnh báo BetterAuth thiếu `BETTER_AUTH_SECRET` do môi trường CI, không phải lỗi PR) |
| Hợp đồng / `domain.ts` | ✅ props công khai giữ nguyên; `AnalyticsStatus`, `reviewLoader` là nội bộ |
| `any` / `ts-ignore` / `console.log` / `NEXT_PUBLIC` / gọi AI từ client | ✅ không có trong diff `src/` |
| Logic nghiệp vụ trong component | ✅ chỉ hiển thị; pacing/nowcast lấy từ engine |
| Live mode (FD-07) | ✅ simulator import động, có cleanup `stop()`, lỗi tải → tắt Live + toast; khoá khi preview/chưa hydrate |
| Test nhánh lỗi / ca biên | ✅ `DashboardShell.test` (loading/khoá/lỗi tải/thử lại/nhãn), `EChartCanvas.test` (0/1000 SVG, 1001 Canvas), `CampaignChart.test` (trục ngày chung, deviceMemory thấp), `DashboardAdvanced.test` |
| UI 375/768/1440, dark mode | ✅ ảnh `docs/screens/FD-08-*`, `FD-09-*` và `handoffs/FD-09/browser-checks.json` |
| Handoff + log AI | ✅ `FD-04/07/08/09/10.md` + `FRONTEND-TRUONG-2026-11-05.md` |
| Bundle < 250 KB (FD-10) | ❌ **276.754 B** gzip modern / 316.381 B mọi script (`handoffs/FD-09/bundle.json`) — handoff nêu trung thực |

### Lỗi phải sửa
Không có lỗi chặn cho FD-04/07/08/09.

### Lưu ý không chặn
- **FD-10 chưa đóng:** tiêu chí "Bundle đầu < 250 KB" không đạt trên `main` mới (trước đó 249.843 B, dư 157 B). Mức tăng nhiều khả năng do `AccountMenu`/`AuthDialog`/`ProfileDialog`/`ConflictDialog` import trực tiếp (ngoài ownership Trường). Việc cần làm: techlead lazy-load `AccountMenu` ở `DashboardPage`, Huy lazy các dialog tài khoản (qua CR), rồi đo lại; khi < 250 KB (phép đo modern, TL-07 chốt) mới đánh `[x]` FD-10.
- Phép đo "modern" vs "mọi thẻ script" (polyfill `nomodule` ~39,6 KB) vẫn chờ techlead chốt.
- `handoffs/FD-09/` và `handoffs/FD-10/` có nhiều log/JSON/script; đủ làm bằng chứng, đừng thêm nữa.
- Test perf DATA-01 từng vượt 300 ms khi chạy cùng production build (chạy riêng thì xanh) — chạy check tách khỏi build/Chrome.
- Target/pacing chỉ hiện khi engine trả kết quả; AI-08/AI-FIX-01 thuộc người khác.

### Điểm tốt
Live mô phỏng nối store thật, dọn dẹp đúng, nói rõ "Tất cả → chiến dịch đầu tiên"; trục ngày chung cho các đường dự báo khác horizon; id form duy nhất bằng `useId`; AnomalyFeed bấm để xem khoảng ngày liên quan; handoff không tô hồng số đo bundle, chuyển đề xuất tối ưu thành change request thay vì sửa file ngoài phạm vi.
