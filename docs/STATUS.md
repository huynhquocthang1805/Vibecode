# STATUS — 2026-11-05

Owner: pm-release (Thắng + Claude). Mục tiêu: **Gate G1 — 5 tính năng P0 chạy xuyên suốt** → còn đúng **1 việc: AI-08**.

## Sức khoẻ `main` (8845ec2 + TL-06b)
| Kiểm tra | Kết quả |
|---|---|
| lint · typecheck | ✅ |
| Vitest | ✅ 67 file · 4.012 test · **0 lỗi đã biết** (`it.fails` R-01..R-07, BA-03 đều đã sửa) |
| Build | ✅ (log `BetterAuthError` khi thiếu secret — vô hại, ACC-FIX-01) |
| E2E desktop + iPhone 12 | ✅ 20/20 · còn 1 `test.fail`: **F5 xuất báo cáo (AI-08)** |
| Bundle đầu (script modern, gzip-9) | 256.139 B (trước TL-06b 276.754 B) · brotli Vercel 217 KiB · ngân sách 250.000 B |
| Stub còn lại | `buildReport`, `copyText` (AI-08) |
| AI thật | prompt BA-03 v1.2 + few-shot đã vào route (TL-06b) · **chưa chạy eval với Gemini thật** (AI-10) |

## Tiến độ
| | Tổng | Xong `[x]` | Đang làm `[~]` | Chưa bắt đầu |
|---|---|---|---|---|
| **P0** (gồm P0*) | 51 | **33 (65%)** | 5 | 13 |
| P1 | 39 | 28 | 1 | 10 |
| P2 | 6 | 6 | — | — |

P0 chưa xong chủ yếu là việc cuối kỳ: QA-01/04/06/07 (Nhân), PM-02..07 + TL-08 (Thắng), AI-08 (Thắng 2), AI-10 (Hoàng Anh).

## Theo người
| Người | Đã merge (mới từ 04/11) | Việc tiếp theo (ưu tiên) |
|---|---|---|
| Thắng 2 · Claude tk 2 | — | 🔴 **AI-08 `buildReport` + `copyText`** — chặn G1; mẫu + `fillTemplate` đã sẵn (`handoffs/BA-04.md`) → FC-10 |
| Hoàng Anh · Gemini | AI-FIX-01, AI-09, FC-07, FC-08 | **AI-10** eval Gemini thật (cần key từ Thắng) |
| Trường · ChatGPT | FD-02/05 (R-01), FD-04/07/08/09, FI-02b/03/04/06/07 | FD-06 nối AI-08 khi có · FD-10 còn ~6 KB |
| Huy · Gemini | DATA-08..11, ACC-01..06, DATA-HOTFIX-01 (techlead) | **ACC-FIX-01** (auth khởi tạo lười) |
| Nhân · ChatGPT | BA-03 (code), BA-06 (đặc tả); BA-02/04 do techlead điền thay | **QA-01 (P0)** → QA-03 → QA-04/06/07 sau G1 · rà câu chữ BA-02/04 |
| Thắng + Claude | DATA-HOTFIX-01/02, BA-02/03/04, TL-06b | Đặt `AI_API_KEY`, `AI_MODEL` trên Vercel · **chấm G1 lần 3** khi AI-08 merge · ACC-07 · PM-02 README |

## Thứ tự tới G1
1. **TL-06b** (PR mở) — AI thật nhận đủ prompt.
2. **AI-08** (Thắng 2) → bỏ `test.fail` ở E2E F5 → FD-06 hết `[~]`.
3. Thắng mở https://vibecode-three-xi.vercel.app/ trên điện thoại: nhập 3 ngày → Phân tích (Gemini thật) → Xuất báo cáo → Sao chép → dán Zalo → techlead ký G1.

## Rủi ro
1. 🔴 AI-08 chưa có nhánh/PR nào — là việc chặn G1 duy nhất. Nếu tới hết 05/11 chưa có: techlead làm thay (như BA-02/04).
2. 🟡 Nhân giữ 9 task chưa bắt đầu (QA-01..08, BA-07/08) — quá tải; đề xuất chuyển QA-03 (test API/guardrails) cho Hoàng Anh, QA-02 cho Huy.
3. 🟡 Chưa có bằng chứng AI **thật** (eval mock 100% không chứng minh được Gemini) — rubric chấm AI thật (docs/05).
4. 🟢 Bundle gần đạt: còn ~6 KB gzip; người dùng thật nhận brotli 217 KiB.

Chi tiết: `handoffs/GATE-G1.md` (lần 2), `handoffs/TL-06b.md`.
