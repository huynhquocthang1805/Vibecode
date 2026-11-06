# Review QA-03 — Test API AI + guardrails với provider giả (PR #34) — **APPROVE**

## Vòng 1
| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ Không có lỗi chặn (3 file, đúng ownership qa-engineer) |
| `npm run check` | ✅ lint + typecheck sạch; Vitest 75 file, 4173 pass + 2 expected fail (BUG-QA02-01, BUG-QA03-01) |
| `npm run build` | ✅ Build production thành công |
| Hợp đồng / `domain.ts` | ✅ Không đổi chữ ký, không sửa source của owner khác (chỉ thêm test, bugs.md, handoff) |
| `any` / `ts-ignore` / `console.log` | ✅ Không có |
| Ca lỗi / ca biên | ✅ JSON hỏng, 2/4 gợi ý, changePct sai, direction/overall sai, timeout 15s, provider 429 + retry, phục hồi ở retry, thiếu key, injection, <3 ngày (422), schema sai (400), 413 |
| Không gọi provider thật / không đọc env file | ✅ Provider mock, env stub bằng `vi.stubEnv` |
| Handoff + log AI | ✅ `handoffs/QA-03.md` |

## Lỗi phải sửa
Không có.

## Lưu ý không chặn
- BUG-QA03-01 (413 không có fallback): docs/05 §1 tự mâu thuẫn — bảng ghi 413 "không xảy ra vì client nén" (không fallback), còn dòng cuối nói "mọi 4xx/5xx trừ 400 đều kèm fallback". `it.fails` giữ assertion nguyên bản là hợp lệ; nên chốt theo hướng sửa spec (ngoại lệ 413 như 400) vì không có request hợp lệ để tạo fallback. Owner: ai-engineer + techlead.
- `docs/bugs.md`: dòng "QA-04: regression dùng test.fail…" nằm trong mục "Phạm vi xác minh" nhưng bị đẩy xuống dưới mục BUG-QA03-01 → hiểu nhầm là thuộc bug 413. Nên đưa lại về mục "Phạm vi xác minh". Ngoài ra bug chưa nằm trong bảng bug như các BUG-QA02/04.
- Nhiều chỗ thiếu khoảng trắng ("HTTP413", "cófallback", "JSON1MB") trong bugs.md và handoff — nên sửa cho dễ đọc.
- Test timeout chỉ giả `Date`, không chạy timeout thật của provider; đã ghi rõ trong handoff.
- Injection test chỉ kiểm chứng escape prompt và guardrail với output sai cố ý, không chứng minh LLM thật miễn nhiễm (handoff đã nói rõ).

## Điểm tốt
- Chạy route handler thật, chỉ thay provider; reset module cache/rate limiter từng test, ngày cố định nên ổn định.
- Phân biệt đúng 429 của provider (502 + fallback) với rate limiter nội bộ.
- Không nới kỳ vọng 413 để làm test xanh; báo cáo trung thực expected failure không phải pass chức năng.
