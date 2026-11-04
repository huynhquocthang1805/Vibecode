# Review PR #21 — BA-02 · BA-03 · BA-04 (techlead điền thay Nhân) — **APPROVE**

## Vòng 1
| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ không có lỗi chặn |
| `npm run check` | ✅ lint + typecheck sạch; Vitest 56 file, 3885 pass, 0 fail, 2 expected fail |
| `npm run build` | ✅ |
| Hợp đồng (`domain.ts`, docs/10 §F, §G) | ✅ `SYSTEM_PROMPT_VI`, `buildUserPrompt`, `FEW_SHOT`, `PROMPT_VERSION`, `TEMPLATES` giữ nguyên tên/chữ ký; `fillTemplate` là export thêm |
| Không `any` / `ts-ignore` / `console.log` / `new Date('YYYY-MM-DD')` | ✅ luật cuối tuần dùng `daysBetween` |
| Pure / không gọi AI từ client / secret | ✅ config + template thuần |
| Test ca lỗi/biên | ✅ `ruleSuggestions.test.ts` (11 ca: 0,5 · <14 ngày · grain tuần · cuối tuần 0 đơn · partial · không mutate thư viện · cụm cấm), `templates.test.ts`, 9 ca prompt chuyển `it.fails` → `it` |
| Handoff + log AI | ✅ BA-02, BA-03, BA-04 |
| Ownership | ✅ phần chạm `guardrails.ts`/`fallback.ts` (ai-engineer) chỉ nối config, có ghi trong handoff, hành vi cũ không đổi (test AI-04/05 xanh) |

## Lỗi phải sửa
Không có.

## Lưu ý không chặn
1. Hoàng Anh nên xem lại phần nối `guardrails.ts` / `fallback.ts` (handoff BA-02 đã nêu).
2. Prompt chưa chạy với provider thật — eval ở BA-06/AI-09; Nhân rà giọng văn và bổ sung cụm cấm từ output Gemini.
3. `buildReport` (AI-08) cần dùng `fillTemplate`/`REPORT_COPY` thay vì tự viết lại câu chữ.
4. `fillTemplate` không hỗ trợ khối lồng nhau (đã ghi trong comment đầu file).

## Điểm tốt
- Khắc phục blocker G1: main không còn gửi `"TODO(BA-03)"` làm system prompt.
- Luật gợi ý chuyển sang config, trả bản sao nên guardrail sửa thoải mái không làm bẩn thư viện.
- `fillTemplate` không bao giờ in `{x}`/`undefined` (thiếu → "—"), deterministic.
