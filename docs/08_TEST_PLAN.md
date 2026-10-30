# 08 — Kế hoạch kiểm thử

Owner: `qa-engineer`. Unit test do owner module viết (cạnh file nguồn); QA viết integration, property-based, E2E, perf và kiểm soát độ phủ.

## 1. Tầng test & công cụ
| Tầng | Công cụ | Vị trí | Mục tiêu |
|---|---|---|---|
| Unit | Vitest | `src/**/*.test.ts` | lib/domain, lib/analytics, lib/ai/guardrails ≥ 90% lines |
| Property-based | fast-check | `tests/integration/properties.test.ts` | Bất biến KPI & rollup |
| Integration | Vitest + jsdom | `tests/integration/**` | store ↔ storage ↔ worker; API route với provider giả |
| Component | Testing Library | `src/components/**/*.test.tsx` | Form validation, trạng thái AI card |
| E2E | Playwright (Chromium + iPhone 12 viewport) | `tests/e2e/**` | Luồng người dùng thật |
| Perf | Vitest bench / script | `tests/perf/**` | Ngân sách ở docs/01 §5 |
| AI eval | `scripts/eval-ai.ts` | `docs/ai-eval-report.md` | Chất lượng & kiểm soát đầu ra |

## 2. Bất biến (property-based)
1. Σ(bucket tháng).cost = Σ(bucket ngày).cost = Σ(entries).cost với mọi tập entries ngẫu nhiên.
2. `applyDelta(buildRollups(A), {added:B, removed:[]})` ≡ `buildRollups(A ∪ B)`; thêm rồi xoá → về trạng thái ban đầu.
3. clicks ≤ reach ⇒ 0 ≤ CTR ≤ 1; không bao giờ NaN/Infinity trong Kpis.
4. `decodeState(encodeState(s))` ≡ s (roundtrip codec).
5. Dự báo: mọi điểm ≥ 0, lo95 ≤ lo80 ≤ mean ≤ hi80 ≤ hi95.
6. Nowcast.projected.mean ≥ actualToDate cho mọi chỉ số.

## 3. Ma trận lỗi & ổn định
| Nhóm | Kịch bản | Kỳ vọng |
|---|---|---|
| Input | 30 ca biên docs/03 §5 | đúng như bảng |
| Storage | JSON hỏng, sai version, quota đầy, localStorage bị chặn (Safari private) | không crash; fallback memory + cảnh báo |
| Worker | Worker không khởi tạo được | chạy main thread, vẫn đúng kết quả |
| AI | provider trả text không phải JSON / 2 gợi ý / 4 gợi ý / số sai / hướng sai / timeout / 429 / không có key | guardrail đúng docs/05 §6; UI luôn có nội dung |
| AI | prompt injection trong tên chiến dịch | output vẫn đúng schema, không làm theo chỉ dẫn |
| Realtime | 2 tab cùng nhập | 2 tab hội tụ cùng dữ liệu, không lặp vô hạn |
| Live | chạy x60 trong 2 phút | không rò rỉ bộ nhớ (heap ổn định), UI ≥ 50fps |
| Clipboard | Clipboard API bị từ chối | fallback select text + hướng dẫn |
| Mobile | 375×667 | không tràn ngang, nút ≥ 44px, form dùng được |

## 4. E2E bắt buộc (Playwright)
1. `happy-path.spec.ts`: trang trống → nhập 7 dòng → thấy KPI đúng → biểu đồ có 7 điểm → bấm AI (provider stub qua env `AI_PROVIDER=stub` chỉ trong test) → 3 gợi ý → xuất báo cáo → clipboard chứa "BÁO CÁO".
2. `validation.spec.ts`: click > reach bị chặn; số âm bị chặn; ngày tương lai bị chặn; cảnh báo orders > clicks vẫn lưu.
3. `persistence.spec.ts`: nhập → reload → dữ liệu còn; xoá → hoàn tác.
4. `import.spec.ts`: CSV 1.000 dòng có 10 dòng lỗi → báo cáo đúng; dán TSV từ Excel.
5. `grain-forecast.spec.ts`: nạp `campaign-2y` → chuyển Tháng/Quý → có nowcast cuối tháng/quý.
6. `mobile.spec.ts`: toàn bộ happy path ở viewport iPhone 12.
7. `crosstab.spec.ts`: 2 page cùng context → nhập ở tab A thấy ở tab B.
8. `live.spec.ts`: bật live x60 → KPI hôm nay tăng → có ít nhất 1 cập nhật nowcast.
Chạy cả trên bản deploy (`BASE_URL=https://...`) trước khi nộp.

## 5. Kiểm tra bảo mật nhanh
- `grep -r "$AI_API_KEY" .next/static` → không có kết quả.
- Không có biến `NEXT_PUBLIC_*KEY*`.
- Nhập `<img src=x onerror=alert(1)>` làm tên chiến dịch → không thực thi.

## 6. Báo cáo
`docs/test-report.md` (kết quả + độ phủ) · `docs/perf-report.md` (bảng số đo trên máy dev + Vercel) · `docs/bugs.md` (bug tìm được khi đóng vai Marketer: bước tái hiện, mức độ, owner, trạng thái).
