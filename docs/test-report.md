# Test report — Nhân · BA-07/08, QA-01 đến QA-08

Mốc 2026-11-06. Windows, Node 22.16.0, Chromium 156.0.8078.4, Playwright 1.64.1; iPhone12 là Chromium touch/viewport emulation, không phải iOS/WebKit thật. Ngày nghiệp vụ cố định 2026-11-06. Local production build c4816a7; deploy https://vibecode-three-xi.vercel.app chưa xác minh SHA. Test dùng AI stub.

## Kết quả

| Task | Kết quả đã xác minh |
|---|---|
| BA-08 | 9 tests generator/fixtures; stress 200k, sparse, 3 encoding CSV, E31–E50; PR30 |
| QA-01 | 85 tests fixture/invariant, 6 property × 200 lượt, seed 20261106; PR31 |
| QA-02 | Sau PR38: 8/8 pass, gồm storage getter bị chặn; PR32 |
| QA-03 | 13 pass + 1 expected failure BUG-QA03-01 (fallback 413); PR34 |
| QA-04 local | Sau owner sửa: 22 functional pass + 2 expected cross-tab, 12 cases × 2 projects; PR33 |
| QA-04 deploy | 22 functional pass + 2 expected cross-tab; AI intercept stub ở test runner |
| QA-05 | Năm mẫu median CPU/browser local/deploy; 3 ngân sách chưa đạt, xem perf-report.md; PR40 |
| QA-06 | Phiên thực 45 phút 41.65 giây; 141 hành động, 124 pass + 17 harness fail CRLF, 0 pageerror; smoke sau sửa 9/9 |
| QA-07 | API 4/4 pass; XSS 2/2 local + 2/2 deploy; 46 client chunks/222 source files không phát hiện canary giả hoặc public KEY variable; PR41 |

`npm run check` trên lượt bao gồm QA-07: **80 test files, 4214 pass + 1 expected fail, 0 unexpected fail**, lint 0 warning, TypeScript strict xanh. Build production xanh. Expected failure là yêu cầu sản phẩm chưa đạt. Playwright in 26 passed cho QA04+QA07 nhưng thực tế **24 functional pass + 2 expected fail** mỗi môi trường.

## E2E sau retest PR38

| Spec | Local desktop/iPhone | Deploy desktop/iPhone |
|---|---|---|
| happy-path: 7 ngày, KPI, chart, AI3, clipboard | Pass/Pass | Pass/Pass |
| validation: 4 ca lỗi/cảnh báo | Pass/Pass | Pass/Pass |
| persistence: reload, xóa, undo | Pass/Pass | Pass/Pass |
| import: 1000 dòng/10 lỗi và TSV | Pass/Pass | Pass/Pass |
| grain-forecast: tháng và quý | Pass/Pass | Pass/Pass |
| mobile 375px | Pass/Pass | Pass/Pass |
| crosstab | BUG-QA04-01/BUG-QA04-01 | BUG-QA04-01/BUG-QA04-01 |
| live: x60, KPI, nowcast cập nhật | Pass/Pass | Pass/Pass |
| security: XSS tên campaign sau reload | Pass/Pass | Pass/Pass |

## Coverage V8

Đo bằng `npx vitest run --coverage --coverage.reporter=json-summary --coverage.reporter=text`, cùng 80 files/4214 pass + 1 expected. Config include src/lib/** và src/types/**. Trừ 4 statement/line của domain.ts khỏi aggregate:

| src/lib/ | Covered/total | % (làm tròn) |
|---|---:|---:|
| Lines | 3282/3619 | **90.69%** |
| Statements | 3534/3956 | 89.33% |
| Functions | 492/542 | 90.77% |
| Branches | 2131/2796 | 76.22% |

Mục tiêu ≥85% lines đạt; không khẳng định branches ≥85%. Domain group 90.31% lines, analytics 93.93%, guardrails 97.50%. Provider Gemini/OpenAI thấp (28%/12.5% lines) vì suite dùng stub; không phải bằng chứng chất lượng AI thật. JSON summary local: coverage/coverage-summary.json.

Repo chưa khai báo @vitest/coverage-v8. Lượt đo dùng package 5.0.5 cài tạm ngoài repo và junction vào node_modules, không đổi manifest/lock. Máy mới cần techlead thêm dev dependency cùng phiên bản Vitest trước chạy coverage; `npm run check` không cần plugin này.

## Phiên Marketer và bằng chứng

Phiên dài bắt đầu 11:19:56.788Z, kết thúc 12:05:38.439Z ngày 2026-11-06, elapsed 2741650.777 ms. Nhập tay 7 ngày, dán Excel, nhập sai rồi sửa, chuyển campaign, tháng/quý, Live x60, AI/copy và bản nháp gửi Zalo. 17 assertion fail đều do CRLF của Windows so với LF trong textarea; giữ kết quả gốc, không ghi thành pass sau sửa. Smoke 60 giây 9/9 xác minh lại đoạn sửa.

Không gửi Zalo hoặc thông điệp ra ngoài. AI stub; tự động thao tác theo vai Marketer. Không thay thế usability người thật. G1/manual evaluation với AI thật vẫn do techlead nghiệm thu.

Artifact phiên dài và JSON benchmark ban đầu đã bị Playwright dọn output chung; số liệu đã đọc vào log, mẫu benchmark lưu trong docs/perf-report.md. Trace/ảnh gốc 45 phút **không còn**. Script hiện ghi trace/JSON/ảnh vào `%TEMP%/vibecode-qa06/{session,smoke}` hoặc QA_ARTIFACT_DIR để tránh mất lần nữa. Artifact smoke mới không thay thế trace phiên dài. Retest local/deploy: test-results/qa06-retest-{local,deploy}/.

## Còn cần owner

Ở mốc QA-01–07: cross-tab còn thiếu wiring; đã đóng sau PR43/47 và retest QA-08 bên dưới. 413 fallback/spec mismatch và các ngân sách hiệu năng vẫn mở. Storage getter, forecast quý, Live nhỏ đã verified fixed. account.spec.ts thuộc Huy, không sửa trong lượt này.

## Chạy lại

```powershell
npm run check
$env:BASE_URL='http://localhost:3000' # production server AI stub đã chạy
npx playwright test happy-path.spec.ts validation.spec.ts persistence.spec.ts import.spec.ts grain-forecast.spec.ts mobile.spec.ts crosstab.spec.ts live.spec.ts security.spec.ts --workers=2 --output=test-results/qa06-retest-local
npx tsx tests/e2e/marketer-session.ts --smoke #60giây; bỏ --smoke để chạy45phút thật
$env:BASE_URL='https://vibecode-three-xi.vercel.app'
npx playwright test happy-path.spec.ts validation.spec.ts persistence.spec.ts import.spec.ts grain-forecast.spec.ts mobile.spec.ts crosstab.spec.ts live.spec.ts security.spec.ts --workers=2 --output=test-results/qa06-retest-deploy
Remove-Item Env:BASE_URL
```

## BA-07 và QA-08 — tiếp tục ngày 2026-11-08

BA-07 PR45 đã **APPROVE và merge** vào main (`b9439dd`): glossary/microcopy trong config, 13 glossary tests và 11 ruleSuggestions tests; không nối component ngoài sở hữu. Review/handoff nêu Trường nối UI_COPY/DEGRADED_COPY. `npm run check` của BA-07: 83 files, 4239 pass + 1 expected failure có sẵn.

QA-08 đồng bộ main `1d0c019` (PR47), build production xanh, local server cổng 3108, AI stub. Deploy `https://vibecode-three-xi.vercel.app` chưa xác minh SHA. Ngày nghiệp vụ cố định 06/11 cho browser, 07/11 cho property; Live dùng Date tiến đều, không cố định đứng yên. Worker/Comlink/lock doubles chỉ để tiêm lỗi; store, codec, rollup và engine là implementation thật.

`npm run check` ngày 08/11: **86 test files, 4256 pass +6 expected fail, 0 unexpected fail**, lint 0 warning và TypeScript strict xanh. Sáu expected gồm BUG-QA03-01 có sẵn và năm BUG-QA08-01–05. Riêng 3 file integration QA-08: **9 pass +5 expected fail** (14 tests), trong đó 4 property thực thi tổng 800 lượt.

| Phần QA-08 | Kết quả / bằng chứng |
|---|---|
| Bất biến #7–#10 | 4 property ×200 lượt, seed 20261107; add/update/remove/import/undo/remote, partition roundtrip, quota mỗi bước, safe integer |
| E40 | 199999 +2 khóa mới bị từ chối nguyên tử; không event/save, giữ entries/checksum/revision |
| E50 | Store checksum = worker engine = incremental = rebuild sau từng thao tác; series 4 grain khớp |
| Storage chaos | Missing/checksum mismatch giữ năm lành; JSON manifest hỏng có phục hồi. Missing manifest, missing numeric columns, stale concurrent writer còn BUG-QA08-01/02/03 |
| Worker chaos | Timeout restart giữ delta đạt; snapshot reject không retry và init rỗng/crash/fallback mất delta còn BUG-QA08-04/05 |
| E2E local 08/11 | **6 functional pass +2 expected E49 failure**, desktop/iPhone. Cross-tab thường và thiếu BroadcastChannel đều hội tụ và reader mới giữ dữ liệu |
| E2E deploy 08/11 | **6 functional pass +2 expected E49 failure**, cùng assertions local |
| E49 UI | Form không trắng, năm lành/KPI đúng; chưa có banner chứa năm bị mất (BUG-QA08-06). Marker chỉ bật sau các assertion giữ dữ liệu |
| Scale 50k/200k | 5 mẫu median, adapter mới reload đủ dòng và giá trị mới; nhiều budget chưa đạt, xem perf-report.md |
| E48/Live 10 phút | Cả hai mức quan sát >600000ms. 200k: reach tăng, 3 commit, max gap 511524ms, retained heap +209.29%. 50k: timeout lấy số cuối, chưa xác nhận heap ổn định. Exit1; **chưa đạt**, BUG-QA08-08. Hai contexts chạy đồng thời, cần retest độc lập sau sửa |

Playwright in `8 passed` mỗi môi trường vì tính cả `test.fail`; số functional pass thực tế là **6**, không ghi thành 8. Trace/error-context mới: `test-results/qa08-local-1108/` và `test-results/qa08-deploy-1108/`. Hai lượt ngày 07/11 cũng có 6+2 nhưng không thay bằng chứng sau cập nhật main.

Năm expected failures integration giữ yêu cầu mong muốn và mã bug; bỏ marker sau khi owner sửa. BUG-QA08-04 chỉ xác nhận RPC snapshot reject không tự retry, không khẳng định hook/UI trắng trang; techlead chốt policy xử lý lỗi RPC. Các lỗi còn lại có oracle phục hồi/dữ liệu cụ thể. E2E đặt `QA_VERIFY_FIXES=1` để retest banner E49 mà không marker.

Coverage 90.69% ở trên thuộc lượt QA-01–07, **không phải** coverage mới sau QA-08. Không đo lại coverage hay kiểm thử tài khoản ngoài scope. Nhân chỉ sửa tests/docs/config thuộc quyền; bug sản phẩm chuyển qua handoff và PR.

Lượt Live 08/11 giữ JSON/ảnh ngoài test-results, dưới `%TEMP%/vibecode-qa08/live-1108/`; có ảnh cuối 200k, không có ảnh/retained heap cuối 50k. Lượt 07/11 bị gián đoạn/disconnect không được dùng làm bằng chứng hoàn thành. Kết luận nghiệm thu QA-08: E40/E50 đạt; E49 thiếu cảnh báo và các nhánh phục hồi còn lỗi; E48/hiệu năng chưa đạt. Bộ kiểm thử và bằng chứng đã bàn giao để owner sửa, không tuyên bố sản phẩm đạt toàn bộ resilience.
