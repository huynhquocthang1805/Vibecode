# Gate G1 — MVP · techlead · 2026-11-04 (lần chấm 1)

**Kết luận: CHƯA ĐẠT** — 5/7 tiêu chí xong, còn 3 việc chặn (cuối file). Chấm lại khi 3 việc đó merge.
Bằng chứng tự động: `tests/e2e/g1-smoke.spec.ts` (Playwright, desktop + iPhone 12) — chạy trong CI ở mọi PR.

## Checklist (docs/09_TIMELINE.md)
| # | Tiêu chí G1 | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | Nhập nhiều dòng + validation + reload còn dữ liệu | ✅ | E2E "F1 + F3", "F1: validation" — xanh desktop + iPhone 12 |
| 2 | Biểu đồ reach / chi phí / đơn | ✅ | E2E "F2" |
| 3 | CTR / CPC / CPA đúng (ca E01–E19) | ✅ số đúng · ⚠️ hiển thị | 71/71 ca fixture BA-01; E2E: CTR 2,19% · CPC 5.441 ₫ · CPA 132.143 ₫ khớp tính tay. Thẻ KPI ghép tổng kỳ với delta 1 kỳ (R-01 FD-02) — không sai số nhưng dễ hiểu nhầm |
| 4 | AI **thật** trả đúng 3 gợi ý, có fallback | ❌ | Fallback ✅ (3 gợi ý, nhãn "Dự phòng"); stub ✅ (E2E "F4"). **AI thật chưa được**: prompt trên `main` vẫn là stub (`SYSTEM_PROMPT_VI = 'TODO(BA-03)…'`) → Gemini nhận system prompt "TODO" + JSON thô. Cần merge BA-03-code. Trang trống gọi AI → 400 (E26, R-02) |
| 5 | Copy báo cáo | ❌ | Dialog + nút có; nội dung báo "chưa sẵn sàng" — **AI-08** chưa làm (E2E "F5" đánh `test.fail`) |
| 6 | CI xanh | ✅ | lint · typecheck · 3.779 test · build · PR guard |
| 7 | Link Vercel | ✅ | https://vibecode-three-xi.vercel.app/ — Vercel báo "Deployment has completed" cho `main` (môi trường cloud của techlead không mở trực tiếp được vercel.app — cần người thật thử trên điện thoại) |

## 3 việc chặn G1 (thứ tự merge)
1. **BA-03-code** (Nhân) — nhánh đã có, 9/9 test nghiệm thu xanh → mở PR + merge. Không có nó AI thật vô nghĩa.
2. **AI-FIX-01** (Hoàng Anh) — không gọi AI khi < 3 ngày (E26), gộp request trùng. Bỏ `test.fail` ở E2E "E26".
3. **AI-08** (Thắng 2) — `buildReport` + `copyText` theo `TEMPLATES` (BA-04 của Nhân — chưa có thì dùng mẫu docs/07). Bỏ `test.fail` ở E2E "F5".

Sau đó: Thắng mở link Vercel trên điện thoại, nhập 3 ngày, bấm Phân tích (Gemini thật), Xuất báo cáo → Sao chép → dán Zalo. Đạt → techlead ký G1.

## Không chặn G1 (làm song song)
FD-02 R-01 (giá trị ↔ delta) · FD-10 bundle 297 KB > 250 KB · BA-02 (bannedPhrases/ruleSuggestions) · DATA-04b.

---

# Gate G1 — lần chấm 2 · techlead · 2026-11-05

**Kết luận: CHƯA ĐẠT — 6/7**, chỉ còn **AI-08**. Main 8845ec2 + TL-06b.

| # | Tiêu chí | Lần 1 | Lần 2 | Bằng chứng |
|---|---|---|---|---|
| 1 | Nhập nhiều dòng + validation + reload | ✅ | ✅ | E2E F1+F3 — lỗi mất dữ liệu khi reload sửa ở DATA-HOTFIX-01 (#16) |
| 2 | Biểu đồ | ✅ | ✅ | E2E F2 |
| 3 | CTR/CPC/CPA đúng | ✅ ⚠️ | ✅ | R-01 (giá trị ↔ delta) sửa ở #12 |
| 4 | AI thật 3 gợi ý + fallback | ❌ | ✅ code · ⏳ thử thật | BA-03 vào main (#21), E26 sửa (#24), few-shot + nhãn model (TL-06b). Cần Thắng thử Gemini thật trên Vercel + AI-10 eval thật |
| 5 | Copy báo cáo | ❌ | ❌ | **AI-08** chưa có (`buildReport`/`copyText` stub) — E2E F5 `test.fail` |
| 6 | CI xanh | ✅ | ✅ | 4.012 test, 0 `it.fails`, E2E 20/20 |
| 7 | Link Vercel | ✅ | ✅ | https://vibecode-three-xi.vercel.app/ |

Ký G1 khi: AI-08 merge → bỏ `test.fail` F5 → Thắng thử trên điện thoại (Gemini thật, copy dán Zalo).
