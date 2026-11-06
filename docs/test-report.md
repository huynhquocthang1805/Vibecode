# Test report — Nhân · 2026-11-06

## Môi trường và cách đọc
Windows, Node22, Chromium156, Playwright1.64.1; iPhone12 là viewport/touch emulation trên Chromium, không phải WebKit/iOS thật. Ngày nghiệp vụ cố định 2026-11-06.
Expected failure là yêu cầu đang **không đạt**, không phải lỗi đã sửa. Artifact test-results/** giữ local, không commit dữ liệu lớn/trace.

## Kết quả từng lớp
| Task | Kết quả xác minh |
|---|---|
| BA-08 | 9 tests generator/fixtures; stress200k, sparse và ba encoding CSV; PR30 đã merge |
| QA-01 | 85 tests fixture/invariant, 6 property × 200 lượt seed20261106; PR31 đã merge |
| QA-02 | 7 pass + 1 expected failure BUG-QA02-01; suite74files:4160pass+1expected; PR32 đã merge |
| QA-04 local | 18 functional pass + 6 expected failures, 12cases×2projects, build production AI stub |
| QA-04 deploy | 18 functional pass + 6 expected failures; https://vibecode-three-xi.vercel.app; AI intercept stub |
| QA-03/05/06/07 | Đang triển khai; chưa coi là đạt |

## E2E local
| Spec | Desktop | iPhone12 |
|---|---|---|
| happy-path | Pass | Pass |
| validation (4cases) | Pass | Pass |
| persistence | Pass | Pass |
| import (1000rows/10errors + TSV) | Pass | Pass |
| grain-forecast: month | Pass | Pass |
| grain-forecast: quarter | BUG-QA04-02 | BUG-QA04-02 |
| mobile375px | Pass | Pass |
| crosstab | BUG-QA04-01 | BUG-QA04-01 |
| live | BUG-QA04-03 | BUG-QA04-03 |

## Coverage và phạm vi
Chưa đo coverage V8; không báo đạt ≥85% chỉ từ số test. QA-08 stress/chaos ngoài đợt giao. Gemini thật/G1 manual không được chứng minh bằng test stub.

## Lỗi cần owner
Xem docs/bugs.md: localStorage SecurityError, thiếu wiring cross-tab, thiếu forecast cuối quý khi dữ liệu trễ, Live x60 trì hoãn snapshot. Không sửa nguồn ngoài quyền QA.
