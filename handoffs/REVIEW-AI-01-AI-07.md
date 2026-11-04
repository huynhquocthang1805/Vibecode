# Review — AI-01..AI-07 (Hoàng Anh) — techlead · 2026-11-03

Nhánh `feat/ai-engineer/AI-01-AI-07` → **REQUEST_CHANGES** (1 lỗi chặn: `npm run build` đỏ).

## Vòng 1
| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ không có lỗi chặn (25 file, role ai-engineer) |
| `npm run check` | ✅ lint + typecheck xanh; vitest 21 file, 3651 pass, 8 expected fail (`it.fails` BA-03 có sẵn), 0 fail |
| `npm run build` | ❌ **lỗi**: `src/app/api/insights/route.ts:10` — `Route segment config "runtime" is not compatible with nextConfig.cacheComponents` |
| Phạm vi/ownership | ✅ chỉ sửa `src/lib/ai/**`, `src/app/api/insights/**`, handoffs |
| Hợp đồng (docs/10 §E) | ✅ schema, route, provider, guardrails, fallback, hook, buildInsightRequest; `forecastConfidence` (CR-004) đã có |
| Bảo mật | ✅ key chỉ qua `process.env.AI_API_KEY` ở server, không `NEXT_PUBLIC_`; stub bị chặn ở production trừ `ALLOW_STUB=1`; không `any`/`console` |
| Route | ✅ body 32KB (header + đo thực), Zod trước, rate limit, cache LRU, ngân sách 20s/retry ≥5s, mọi lỗi kèm `fallback` |
| Test ca lỗi/biên | ✅ có test route, guardrails, schemas, fallback, buildRequest, useInsights, provider |
| Handoff | ✅ AI-01..AI-07 đều có |

## Lỗi phải sửa
1. **R-01 (Cao)** — `src/app/api/insights/route.ts:10`: xoá dòng `export const runtime = 'nodejs';` (Next 16 + Cache Components không cho phép; Node là runtime mặc định). Chạy lại `npm run build` phải xanh; build đỏ thì Vercel deploy hỏng.
2. **R-02 (Trung bình)** — `route.ts`: `rateLimitMap` không bao giờ dọn → phình bộ nhớ theo số IP (vi phạm tinh thần docs/13 chống phình). Thêm dọn các bucket hết hạn (hoặc giới hạn kích thước map như cache). Thêm 1 test cho việc dọn/giới hạn.
3. **R-03 (Thấp)** — `provider/index.ts:27`: `default` âm thầm trả Gemini khi `AI_PROVIDER` sai chính tả; nên ném lỗi rõ (route đã bắt thành `PROVIDER_ERROR` + fallback) và có test.

## Lưu ý không chặn
- Rate limit bucket đặt lại sau cửa sổ cố định, dựa `x-forwarded-for` (chấp nhận được cho P0; trên Vercel cân nhắc `x-real-ip`).
- Task chỉ đánh `[x]` khi APPROVE; `TASKS.md` giữ nguyên.

## Điểm tốt
- Phủ test rộng, route xử lý đủ nhánh lỗi và luôn có fallback; guardrails/`forecastConfidence` theo đúng quyết định BA-03.
- Handoff chia theo từng task, rõ ràng.

## Vòng 2 — techlead · 2026-11-04

**Verdict: APPROVE** (R-01..R-03 đã sửa; PR guard không lỗi).

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ không có lỗi chặn (28 file, role ai-engineer) |
| `npm run check` | ✅ lint + typecheck xanh; vitest 35 file, 3746 pass, 9 expected fail (`it.fails` có sẵn), 0 fail |
| `npm run build` | ✅ xanh; `/api/insights` là route động (ƒ) |
| R-01 | ✅ đã bỏ `export const runtime`; build qua |
| R-02 | ✅ `rateLimit.ts` giới hạn `maxEntries` (LRU) + `cleanup` bucket hết hạn; test `rateLimit.test.ts:21,40` |
| R-03 | ✅ `getProvider` ném lỗi rõ khi tên sai; route bắt thành `PROVIDER_ERROR` + fallback; test `provider.test.ts:51` |
| Bảo mật/quy ước | ✅ không `any`/`console`/`ts-ignore`/`NEXT_PUBLIC_`; key chỉ ở server |
| Handoff | ✅ AI-01..AI-07 đủ |

### Lưu ý không chặn
- Trên Vercel cân nhắc dùng `x-real-ip` thay `x-forwarded-for` cho rate limit.

### Điểm tốt
- Sửa đủ cả 3 lỗi kèm test; phủ test rộng, route luôn trả fallback khi lỗi.
