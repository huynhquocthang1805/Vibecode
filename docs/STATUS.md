# STATUS — 2026-11-08

Owner: pm-release (Thắng + Claude). Giai đoạn: **hoàn thiện & nộp bài** — P0/P1/P2 tính năng đã xong, còn bằng chứng AI thật, video/slide, gate cuối.

> **Mới:** DB + tài khoản chạy trên Vercel (ACC-07 ✅). AI: key đã gắn nhưng Gemini trả **429 RESOURCE_EXHAUSTED** (hết hạn mức key/model) — AI-FIX-03 (#48) làm lộ mã lỗi này; người dùng vẫn nhận bản dự phòng. BUG-QA04-01 Closed sau retest trên deploy. PM-02/04/06/07 xong, PM-05 có kịch bản + dàn ý slide.

## Sức khoẻ `main`
| Kiểm tra | Kết quả |
|---|---|
| lint · typecheck | ✅ |
| Vitest | ✅ 86 file · 4.260 test · 6 `it.fails` = lỗi đã biết: BUG-QA03-01 + BUG-QA08-01/02/04/05 (QA-08 mới, chờ DATA-FIX-05) |
| Build | ✅ (tự migrate Neon khi có `DATABASE_URL`) |
| E2E local (desktop + iPhone 12) | ✅ 46/46 |
| E2E trên deploy | ✅ 50/52 — 2 ca A1 lỗi do môi trường chạy test (ENOTFOUND), xem `handoffs/PM-WRAP.md` |
| AI thật trên deploy | 🔴 429 hết hạn mức → fallback rule-based |
| Database trên deploy | ✅ `/api/account/profile` 401 khi chưa đăng nhập; đăng nhập sai → `INVALID_EMAIL_OR_PASSWORD` (đã tra DB) |

## Tiến độ (`TASKS.md`)
| | Tổng | Xong `[x]` | Đang làm `[~]` | Chưa |
|---|---|---|---|---|
| **P0** (gồm P0*) | 53 | **46** | 5 | 2 |
| P1 | 52 | 46 | 1 | 5 |
| P2 | 6 | 6 | — | — |

P0 còn mở: **AI-10** (eval Gemini thật), **TL-06** (G1 — thử tay trên điện thoại với AI thật), **TL-08** (Gate G3), PM-03 (smoke cuối sau khi AI chạy), PM-05 (video + slide), PM-01/TL-05 (duy trì).

## Theo người
| Người | Việc còn lại |
|---|---|
| Thắng | 🔴 Sửa quota Gemini (mục Rủi ro 1) · thử G1 trên điện thoại · quay video + slide (`docs/12`) |
| Hoàng Anh · Gemini | **AI-10** chạy `npm run eval:ai` với Gemini thật khi hết 429 · **AI-FIX-02** (413 kèm fallback — BUG-QA03-01) |
| Huy · Gemini | 🔴 **DATA-FIX-05** 6 lỗi major QA-08 (khôi phục khi storage hỏng, 2 adapter ghi đè, worker restart) · DATA-PERF-01 · DATA-FIX-04 nhãn lỗi tiếng Việt |
| Trường · ChatGPT | **FD-10** bundle vượt ngân sách ~1,4–2,2 KB (QA05-03: 257.414 B local / 258.189 B deploy so với 256.000 B) |
| Nhân · ChatGPT | Retest sau AI-10; QA05-01/02 nếu kịp |
| Thắng 2 · Claude tk 2 | — (AI-08, FC-10 xong) |
| Thắng + Claude | TL-07 (Gate G2), TL-08 (Gate G3), smoke cuối, cập nhật STATUS ngày nộp |

## Rủi ro
1. 🔴 **AI thật chưa trả lời** — rubric chấm mock tối đa 4/15. Gemini trả 429 với `AI_MODEL` hiện tại. Cách gỡ (Thắng): Vercel → Logs → tìm `[insights] gemini lỗi` để xem model/hạn mức bị chặn → đổi `AI_MODEL` sang model còn hạn mức miễn phí (vd `gemini-2.5-flash-lite`) hoặc bật billing cho key → Redeploy.
2. 🟡 Lần gọi đầu từng mất > 15 s rồi 504 — model "flash-latest" có thể là bản suy nghĩ dài; model nhẹ hơn cũng gỡ luôn rủi ro này.
3. 🟡 Video/slide chưa có — kịch bản và dàn ý sẵn ở `docs/12`.
4. 🟡 QA-08 mở **7 lỗi major** (BUG-QA08-01..06, 08) ở tầng lưu trữ/worker — đều là ca hỏng hiếm (xoá/sửa tay localStorage, worker crash liên tiếp, Live 200k > 10 phút); luồng thường vẫn ổn (e2e xanh). Ưu tiên 01/02/06 (mất dữ liệu khi storage hỏng) trước ngày nộp.
5. 🟢 Hiệu năng chưa đạt vài ngưỡng (QA05-01..03, QA08-07) — ghi trung thực trong `docs/bugs.md`.
