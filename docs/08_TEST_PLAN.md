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
7–10. Bất biến chống lệch rollup, codec phân vùng, ghi 2 pha, số nguyên an toàn: `docs/13_SCALE_RESILIENCE.md` §11 (QA-08).

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

### Tái lập QA-04 (PowerShell)
```powershell
npm run check
npm run test:e2e -- happy-path.spec.ts validation.spec.ts persistence.spec.ts import.spec.ts grain-forecast.spec.ts mobile.spec.ts crosstab.spec.ts live.spec.ts --workers=2 --output=test-results/qa04-local
$env:BASE_URL = 'https://vibecode-three-xi.vercel.app'
npm run test:e2e -- happy-path.spec.ts validation.spec.ts persistence.spec.ts import.spec.ts grain-forecast.spec.ts mobile.spec.ts crosstab.spec.ts live.spec.ts --workers=2 --output=test-results/qa04-deploy
Remove-Item Env:BASE_URL
```
Local dùng route thật với AI stub. Deploy chỉ intercept AI ở test runner; guest data trong context mới. QA_VERIFY_FIXES=1 để chạy nguyên kỳ vọng lỗi cross-tab BUG-QA04-01; marker của BUG-QA04-02/03 đã được owner bỏ trong PR38. Không coi expected failures là functional pass. Test IDs dùng khi có, control còn lại dùng accessible roles/labels. Nếu npm trên PowerShell nuốt cờ CLI, dùng `npx playwright test ... --workers=2 --output=...` trực tiếp.

Retest 07/11 sau PR43: cross-tab đã bỏ marker và pass local/deploy. `QA_VERIFY_FIXES=1` hiện áp dụng cho cảnh báo mất partition QA-08, không còn cần cho cross-tab.

### Tái lập QA-07 (PowerShell)
```powershell
npx vitest run tests/integration/security-api.test.ts
$env:AI_PROVIDER='stub'
$env:ALLOW_STUB='1'
$env:AI_API_KEY='QA_PUBLIC_BUNDLE_CANARY_20261106' # giá trị giả, không phải credential
npm run build
npx tsx tests/integration/security-bundle.ts
# Chạy npm run start trong terminal riêng với AI_PROVIDER=stub/ALLOW_STUB=1.
$env:BASE_URL='http://localhost:3000'
npx playwright test security.spec.ts --workers=2
$env:BASE_URL='https://vibecode-three-xi.vercel.app'
npx playwright test security.spec.ts --workers=2
Remove-Item Env:BASE_URL
Remove-Item Env:AI_API_KEY
```
Route test không gửi burst vào deploy/provider. Bundle scan chỉ đọc src/, next.config.ts và .next/static JS; dùng canary giả thay cho đọc/in secret. Không mở .env*. XSS dùng guest browser context mới và kiểm tra literal name sau reload.

## 7. QA-08 — stress và chaos

Phụ thuộc DATA-10/DATA-11/BA-08 đã có trên main; dùng implementation thật. Chỉ giả lập memory adapter để tách property store khỏi lịch ghi, Worker/Comlink để tiêm lỗi, Web Lock để ép thứ tự writer. Kế hoạch draft cũ `docs/qa08-chaos-plan.md` được thay bằng ma trận và bằng chứng ở đây/handoff QA-08.

| Yêu cầu | Test / phương pháp | Oracle |
|---|---|---|
| #7, E50 | `qa08-resilience.test.ts`: 200 chuỗi seed 20261107, đủ add/update/remove/import/undo/remote mỗi chuỗi | Sau từng thao tác: checksum store = engine worker = incremental = rebuild; series cả 4 grain khớp |
| #8 | 200 property trên partition codec thật, 3 năm/6 campaign/nhiều source/rỗng | Business fields, rows và sums roundtrip; bỏ timestamps đúng contract |
| #9 | 200 property quota tại từng vị trí ghi 3 partition + manifest, kèm trường hợp không lỗi | Adapter mới reload chính xác trước hoặc sau, không trạng thái lai |
| #10 | 200 property giá trị sát LIMITS, 4 grain và chứng minh giới hạn tổng 200k | Mọi tổng là safe integer và bằng tổng thô |
| E40 | `qa08-chaos.test.ts`: 199999 dòng + import 2 khóa mới | Không delta/save, entries/checksum/revision không đổi |
| E49 | Missing/checksum/malformed-column partition, missing/malformed manifest; E2E reload | Năm lành còn, cảnh báo người dùng, không throw; lỗi chi tiết trong bugs.md |
| Worker | `qa08-worker.test.ts`: timeout, snapshot throw, init rỗng rồi thêm/crash/fallback | Retry và giữ checksum, không giả định các worker dùng chung globals |
| Hai writer | Adapter giữ snapshot cũ trong Web Lock; E2E hai tab đồng thời với/không BroadcastChannel | Reload đọc được cả hai dòng đã commit |
| E48 | `qa08-live.ts`: Live ×60, 10 phút thực mỗi mức 50k/200k | Reach tăng, commit không cách >2000ms, retained heap trước/sau GC, pageerrors và sampling timeouts được ghi |
| docs/13 §9 | `qa08-scale.ts`: 5 mẫu median ở 50k/200k | Startup, update, storage CPU/wall/durability, cached snapshot, CSV, Long Task, storage bytes |

```powershell
npm run check
npx --no-install vitest run tests/integration/qa08-resilience.test.ts tests/integration/qa08-chaos.test.ts tests/integration/qa08-worker.test.ts
$env:BASE_URL='http://localhost:3000' # production server đã chạy
npx --no-install playwright test qa08-chaos.spec.ts crosstab.spec.ts --workers=2 --output=test-results/qa08-chaos-local
$env:BASE_URL='https://vibecode-three-xi.vercel.app'
npx --no-install playwright test qa08-chaos.spec.ts crosstab.spec.ts --workers=2 --output=test-results/qa08-chaos-deploy
$env:BASE_URL='http://localhost:3000'
# Chạy từng benchmark; không chạy scale cùng Live hoặc suite khác.
npx --no-install tsx tests/perf/qa08-live.ts # --smoke chỉ 20 giây, không thay nghiệm thu 10 phút
npx --no-install tsx tests/perf/qa08-scale.ts
Remove-Item Env:BASE_URL
```

Benchmark mặc định ghi `%TEMP%/vibecode-qa08/live` và `/scale`; đặt `QA_ARTIFACT_DIR` để giữ từng lượt riêng. Live cần Date tiến đều (`setSystemTime`), không dùng fixed Date vì làm sai maxWait. Thời gian chờ là đồng hồ Node thật, có timeout lấy mẫu và JSON tiến độ khi renderer bận. Số đo budget không biến thành CI gate phụ thuộc máy; báo đạt/chưa đạt trong perf-report. `it.fails`/`test.fail` là bug còn mở, không được cộng thành functional pass. Không sửa source sản phẩm ngoài quyền QA.
