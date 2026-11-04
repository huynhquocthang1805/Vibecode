# STATUS — 2026-11-04

Owner: pm-release (Thắng + Claude). Mục tiêu: **Gate G1 — 5 tính năng P0 chạy xuyên suốt**.

## Tiến độ
| | Tổng | Xong `[x]` | Đang làm / có code `[~]` | Chưa bắt đầu |
|---|---|---|---|---|
| **P0** | 43 | **13** | **18** (code đã có ở nhánh/máy — chỉ cần sửa + merge) | 12 |
| P1 | 29 | 9 | 1 | 19 |

→ Nếu 18 task `[~]` được merge, P0 lên **31/43 (72%)**. Phần còn lại chủ yếu là P0* cuối (QA-04/06/07, PM-02..07) + BA-02, BA-04, AI-08, DATA-04b, QA-01, TL-06.

## Theo người
| Người | Đã merge | Đang chờ | Việc tiếp theo |
|---|---|---|---|
| Huy · Gemini | DATA-01..07, DATA-FIX-01, FC-01 | — | **DATA-FIX-02** (nowcast rỗng, R-07) → DATA-04b → DATA-08..11 |
| Hoàng Anh · Gemini | — | **PR #3 AI-01..07** — bot REQUEST_CHANGES: build đỏ (R-01 `runtime`), R-02, R-03 | Sửa 3 lỗi + rebase main → merge sau BA-03-code |
| Trường · ChatGPT | — | UI FD-01/02/03/05/06 + FI-01/02/05 **chỉ ở máy** | **Push + mở PR ngay** (8 task P0) |
| Nhân · ChatGPT | BA-01, BA-05, BA-03 *đặc tả*, BA-06 *đặc tả* | nhánh **BA-03-code** — 9/9 test xanh, chưa mở PR | **Mở PR BA-03-code** → **BA-02, BA-04 (P0)** — ngừng viết thêm đặc tả P1 |
| Thắng 2 · Claude tk 2 | FC-02..06, FC-09 (bot APPROVE) | — | **AI-08** (P0) → FC-10 |
| Thắng + Claude | TL-01..04, bot review + PR guard | — | Review/merge liên tục, TL-06 ghép trang khi UI + AI vào |

## Thứ tự merge đề xuất tới G1
1. **BA-03-code** (Nhân) — prompt thật; AI route phụ thuộc.
2. **PR #3 AI-01..07** (Hoàng Anh) — sau khi sửa R-01..R-03 + rebase.
3. **UI của Trường** (FD + FI) — nối với store/useAnalytics thật.
4. **BA-04 → AI-08** (mẫu báo cáo → buildReport) → FD-06 dùng được.
5. **TL-06** ghép + Gate G1 trên https://vibecode-three-xi.vercel.app/ (desktop + điện thoại).

## Rủi ro
1. 🔴 UI P0 (8 task) chỉ nằm trên máy Trường — mất máy/quên push là mất.
2. 🟡 Nhân dành nhiều thời gian viết đặc tả (BA-03, BA-06 > 600 dòng) trong khi BA-02/BA-04 (P0, AI cần) chưa bắt đầu.
3. 🟡 Nowcast rỗng (R-07) — không chặn G1 nhưng chặn FD-04 (P1).
4. ✅ Link online: https://vibecode-three-xi.vercel.app/ — production deploy `main` thành công (Vercel). Preview PR #3 build đỏ đúng lỗi R-01 bot đã chỉ.

Chi tiết review: `handoffs/REVIEW-INTEGRATION-2026-11-04.md`.
