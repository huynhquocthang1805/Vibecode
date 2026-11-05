# Review AI-09 — `scripts/eval-ai.ts` + fixtures ai-eval + `docs/ai-eval-report.md`

**Verdict (vòng 2, mới nhất): APPROVE** · Vòng 1: REQUEST_CHANGES

## Vòng 2

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ Không lỗi chặn; ⚠️ 8 fixture thuộc ba-analyst (đã chấp nhận ở vòng 1) |
| `npm run check` | ✅ lint + typecheck xanh; Vitest 64 file, 3987 pass / 0 fail |
| `npm run build` | ✅ thành công |
| R-01 báo cáo mock trung thực | ✅ `docs/ai-eval-report.md` có cảnh báo đầu trang; cột Đánh giá ghi `n/a (mock)` (`scripts/eval-ai.ts:625`); handoff ghi rõ chưa có kết quả LLM thật |
| R-02 test runner | ✅ `evalMetrics.ts` tách thuần; `eval.test.ts` 23 khối `it` (nhiều ca sinh thêm theo fixture), tổng 3987 test pass |
| R-03 `Math.random` | ✅ đã bỏ, độ trễ cố định (`scripts/eval-ai.ts:64`) |
| Hợp đồng / any / secret | ✅ không đổi |

### Lưu ý không chặn
- Báo cáo ghi Git Commit `4b0545e`, chưa khớp commit sửa; chạy lại khi có `AI_API_KEY`.
- Trước nghiệm thu cuối cần chạy `AI_API_KEY=… npm run eval:ai` một lần để có số liệu Gemini/OpenAI thật.
- `AiEvalFixture` vẫn khai báo ở `scripts/`; nên chuyển vào `src/lib/ai` sau.

---

## Vòng 1 — REQUEST_CHANGES

## Vòng 1

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ Không lỗi chặn; ⚠️ 8 fixture `src/fixtures/ai-eval/**` thuộc ba-analyst (chấp nhận, ghi ở lưu ý) |
| `npm run check` | ✅ lint + typecheck xanh; Vitest 64 file, 3969 pass / 0 fail |
| `npm run build` | ✅ thành công |
| Hợp đồng / `domain.ts` | ✅ không đổi chữ ký |
| Không `any` / `ts-ignore` / secret | ✅ key chỉ đọc `process.env.AI_API_KEY`, không `NEXT_PUBLIC_` |
| `console.*` | ✅ chỉ `console.error` trong script CLI |
| Handoff + log AI | ✅ `handoffs/AI-09.md` |
| Test có ca lỗi/ca biên | ❌ test chỉ kiểm fixture + `fallbackInsight`; runner không có test |
| Báo cáo phản ánh đúng chất lượng AI | ❌ xem R-01 |

## Lỗi phải sửa

**R-01 (Cao) — `scripts/eval-ai.ts:~100-135`, `docs/ai-eval-report.md`.**
Khi không có `AI_API_KEY`, runner dùng `EvalMockProvider` trả câu trả lời viết sẵn, chọn theo chuỗi trong prompt (`user.includes('Đúng 3 ngày')`, `c-3days`…). Vì vậy các chỉ tiêu "Initial Schema Pass 100%", "Raw Overall Accuracy 100%", "Banned-Phrase 100%" và "mustMention 100%" tự đúng và không đo chất lượng mô hình nào. Báo cáo lại ghi "✅ ĐẠT" so với mục tiêu của docs/05 §8. Đây là bằng chứng sai lệch khi bảo vệ.
Cách sửa:
- Báo cáo mock phải có cảnh báo ở đầu: "CHẠY OFFLINE VỚI MOCK — KHÔNG phải đánh giá LLM thật". Cột "Đánh giá" và mục tiêu chuẩn chỉ hiện ✅/❌ khi provider là gemini/openai; với mock hiện "n/a (mock)".
- Chạy `AI_API_KEY=… npm run eval:ai` thật và commit báo cáo từ lần chạy đó, hoặc ghi rõ trong handoff là chưa có kết quả thật.

**R-02 (Trung bình) — `src/lib/ai/eval.test.ts`.**
Test chỉ xác nhận fixture hợp lệ và `fallbackInsight` qua `enforceGuardrails`. Phần mới của task (runner) không có test: tính p50/p95, kiểm cụm cấm, `mustMention`, `exactly3Suggestions`, nhánh lỗi provider/schema fail → repair. Nhánh lỗi cũng chưa được thử: fixture hỏng, output thô sai schema, số lượng gợi ý ≠ 3, cụm cấm xuất hiện. Handoff nói "33 tests" cho eval nhưng đó là 4 test × 8 file cộng 1.
Cách sửa: tách các hàm chấm điểm (percentile, checkBanned, checkMustMention) thành module thuần, rồi test tối thiểu: percentile mảng rỗng/1 phần tử, output chứa cụm cấm → bị bắt, thiếu metric `mustMention` → bị bắt, 2 hoặc 4 gợi ý → guardrail xử lý đúng 3.

**R-03 (Thấp) — `scripts/eval-ai.ts:112`.**
`Math.random()` không seed làm độ trễ và báo cáo thay đổi mỗi lần chạy, trái quy tắc "dữ liệu ngẫu nhiên phải có seed". Dùng độ trễ cố định, hoặc PRNG có seed.

## Lưu ý không chặn
- Fixtures thuộc phạm vi ba-analyst (CLAUDE.md §4); BA-06 do techlead điền thay, nên chấp nhận lần này. Lần sau tạo PR/CR riêng hoặc nhờ Nhân.
- Báo cáo ghi `Git Commit 813b21b` và timestamp sinh tự động; sau khi sửa R-01 nên chạy lại để khớp commit.
- `src/lib/ai/eval.test.ts` import kiểu từ `scripts/` (type-only nên ổn, nhưng nên đặt `AiEvalFixture` trong `src/lib/ai`).

## Điểm tốt
- Đủ 8 kịch bản EV-01..08, kể cả ca biên (3 ngày, chi phí 0, 2 năm, prompt injection) và có kiểm tra giới hạn 32KB cho mỗi fixture.
- Runner hỗ trợ cả Gemini và OpenAI, có đo p50/p95 và so sánh Raw vs Final.
- Check và build xanh; không đụng file ngoài phạm vi ngoài fixtures.
