---
paths:
  - "src/lib/ai/**"
  - "src/app/api/**"
  - "scripts/eval-ai.ts"
---

# Quy tắc AI & API (owner: ai-engineer; prompts: ba-analyst)
- API key chỉ đọc qua `process.env.AI_API_KEY` trong code server. Cấm `NEXT_PUBLIC_` cho bất kỳ biến AI nào. Không log key, không log prompt đầy đủ ở production.
- Route: validate Zod trước mọi thứ; giới hạn body 32KB; rate limit; timeout; mọi lỗi trả `InsightError` kèm `fallback`.
- Output AI luôn đi qua `enforceGuardrails` trước khi trả về client — không có ngoại lệ.
- `suggestions` phải đúng 3 phần tử ở response cuối cùng.
- Provider `stub` chỉ hoạt động khi `AI_PROVIDER=stub` và không phải production (trừ `ALLOW_STUB=1`).
- Nội dung prompt nằm trong `src/lib/ai/prompts/` (BA sở hữu). Đổi prompt → tăng `PROMPT_VERSION` + chạy `npm run eval:ai`.
- Xem skill `llm-structured-output`.
