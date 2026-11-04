# Review — BA-03 (Nhân · ChatGPT) — techlead · 2026-11-03

Nhánh `feat/Nhan/ba-analyst/BA-03` (1 commit, chỉ `docs/BA-03.md` + handoff) → **APPROVE phần đặc tả + merge**. Task **BA-03 chưa xong** (code prompt chưa có) → giữ `[~]`.

## Kiểm tra
| Hạng mục | Kết quả |
|---|---|
| Phạm vi | ✅ chỉ tài liệu + handoff; không đổi types/contracts/code |
| Đúng nguồn | ✅ khớp docs/05 §4–6, docs/03, contracts, `InsightRequest`/`InsightResponse`; tự phát hiện đúng 2 lệch tài liệu (eval ở §8 chứ không phải §7; file `system.vi.ts` vs `index.ts`) |
| Few-shot §7.3 | ✅ JSON parse được, đúng 6 trường nội dung, 3 gợi ý high→medium→low, mọi trường trong giới hạn độ dài docs/05 §5, không có trường do server gắn |
| Test nghiệm thu chạy được | ✅ techlead tạo `tests/integration/ba03-prompt.review.test.ts` (9 test, chuyển AC-01..03, FR-02/03/10/11 thành code). Hiện 1 pass + 8 `it.fails` (chờ code). **Đã kiểm khả thi:** một bản cài đặt theo đúng §7.1–7.3 của Nhân làm xanh 9/9 → spec nhất quán, test không đòi điều ngoài spec |
| Trung thực | ✅ handoff ghi rõ phần nào chưa làm/chưa chạy, không tự đánh `[x]` |

## Góp ý nội dung (sửa khi viết code)
1. **System prompt §7.1 quy tắc 4** chỉ ghi "cụm thuộc danh sách cấm được duyệt" — model **không nhìn thấy** danh sách đó. Giữ ví dụ cụ thể như docs/05 §4 ("tối ưu chiến dịch", "cải thiện nội dung" mà không nói làm gì). Test AC-01 đã kiểm điểm này.
2. Quy tắc 6: thêm lại vế "hoặc `forecastConfidence = low`" — trường này có từ CR-004 (dưới).
3. Escape `& < >` trong mọi chuỗi người dùng nhập (đúng §7.2) — test FR-10 kiểm chuỗi `</data>`, `<script>`, xuống dòng trong tên chiến dịch và context.
4. Đừng mở rộng đặc tả thêm — **phần còn lại là viết code**: nội dung §7 đã đủ để chép vào `system.vi.ts`.

## Quyết định cho RISK-01..06
| Rủi ro | Quyết định techlead |
|---|---|
| RISK-01 confidence | **CR-004 duyệt:** thêm `InsightRequest.forecastConfidence?` (thấp nhất của orders/cost). AI-07 điền, AI-01 thêm vào Zod schema. |
| RISK-02 raw hay final | Đo **raw** (trước guardrail) cho "≥ 90% overall đúng" và "0 cụm cấm" — vì guardrail sửa overall nên final luôn 100%, đo final là vô nghĩa. Đo **final** cho "100% đúng 3 gợi ý" và schema hợp lệ. Báo cáo cả hai. 8 kịch bản × 1 lượt ⇒ phải 8/8. |
| RISK-03 cụm cấm | BA-02 là nguồn duy nhất (`config/bannedPhrases.ts`). So khớp P0: chuẩn hoá chữ thường + bỏ dấu, tìm chuỗi con trong `title` + `action`. "Chung chung khi đứng một mình": cấm khi `action` < 40 ký tự hoặc không chứa số/chỉ số nào. |
| RISK-04 timeout | Tổng ngân sách server **20s**: lần gọi đầu tối đa 15s; repair retry chỉ khi còn ≥ 5s, nếu không → fallback ngay. Client timeout 22s. Hoàng Anh ghi vào AI-02/03. |
| RISK-05 overall flat khi CPA xấu dần | Prompt **giữ nguyên** overall của code (đúng BR-02). Sửa quy tắc ở BA-02 (Nhân) + FC-01 (Huy): thêm điều kiện slope. |
| RISK-06 vị trí file | Nội dung ở `src/lib/ai/prompts/system.vi.ts`, `index.ts` re-export 4 tên theo docs/10 §F. |

## Thứ tự tiếp theo cho Nhân (đường găng AI)
**BA-03 code** (`system.vi.ts` + gỡ `it.fails` trong test review) → BA-02 (`thresholds`, `bannedPhrases`, `ruleSuggestions` — AI-04/05 cần) → BA-04 (mẫu báo cáo — AI-08 cần) → QA-01. BA-06 (8 fixture eval) để sau G1.

---

# Vòng 2 — PR #13 `docs(BA-03): update implementation status and handoff` — techlead · 2026-11-04

**Verdict: APPROVE** (sửa E2E + cập nhật tài liệu). **BA-03 vẫn `[~]`**: code prompt chưa tích hợp vào main nên KHÔNG đổi `[x]` trong TASKS.md (đổi sẽ sai sự thật; chính tài liệu của PR ghi `implemented=false`).

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ không có lỗi chặn (3 file: `docs/BA-03.md`, `handoffs/BA-03.md`, `tests/e2e/g1-smoke.spec.ts`) |
| `npm run check` | ✅ lint + typecheck xanh; Vitest 53 file pass, 3844 pass + 11 expected fail, 0 fail |
| `npm run build` | ✅ build production thành công |
| Phạm vi / ownership | ✅ không đổi types, contracts, code nguồn; `tests/e2e` thuộc qa-engineer, Nhân giữ cả 2 role |
| Test E2E F1+F3 | ✅ chờ 350 ms (> debounce 300 ms) trước reload; giữ assertion cũ, thêm kiểm lại CTR/CPC/CPA sau reload |
| Trung thực trạng thái | ✅ `implemented=false` ghi rõ là metadata tài liệu, không phải flag runtime; không coi `it.fails` xanh là đã đạt |
| Handoff | ✅ có; ghi rõ E2E chưa chạy trên CI, provider thật/eval chưa chạy |
| E2E | ⚠️ techlead không chạy Playwright trong review này; dựa vào CI và số liệu trong handoff |

## Lỗi phải sửa
Không có.

## Lưu ý không chặn
1. `docs/BA-03.md` ghi "base `ece753b`" trong khi main đã đi tiếp — chỉ là nhãn tham chiếu, cập nhật khi tích hợp code.
2. Comment test "Theo review PR #13" nên đổi thành mô tả kỹ thuật (debounce persist 300 ms) để khỏi lỗi thời.
3. `waitForTimeout(350)` không thay được bằng chứng reload tức thì của DATA-HOTFIX-01; nếu cần, thêm ca riêng.
4. Việc còn lại của BA-03: mở PR cho nhánh `BA-03-code` (`system.vi.ts` + gỡ 8 `it.fails`), sau đó mới `[x]`.

## Điểm tốt
- Không nới lỏng assertion để làm xanh test; còn tăng độ chặt sau reload.
- Tài liệu phân biệt rõ main với nhánh riêng, không tuyên bố quá mức.
