# Review QA-01 — Vòng 1 · **APPROVE**

PR #31 · `feat(QA-01): kiểm chứng fixtures và sáu bất biến KPI` · nhánh `feat/qa-engineer/QA-01`

## Bảng kiểm tra
| Hạng mục | Kết quả |
|---|---|
| PR guard | Không có lỗi chặn |
| Phạm vi file | 3 file: 2 test trong `tests/integration/**` (đúng quyền qa-engineer) + handoff; không đụng code nguồn |
| `npm run check` | lint + typecheck xanh; Vitest 73 files / 4153 tests passed, 0 fail |
| `npm run build` | Xanh |
| Hợp đồng | Dùng nguyên API public, không đổi chữ ký / `domain.ts` |
| Ca lỗi / ca biên | Runner chạy toàn bộ fixture `edge-cases.json` (validate, kpi, aggregate, series, pctChange, bucketKey) + thực thi riêng E21, E22, E27, E43; kind lạ bị báo lỗi |
| Property-based | 6 bất biến, `numRuns: 200`, seed cố định 20261106; có rỗng, mẫu số 0, nhiều campaign, giao năm |
| Không phụ thuộc giờ máy | `today` cố định trong mọi test |
| Handoff + log AI | Có |

## Lỗi phải sửa
Không có.

## Lưu ý không chặn
- Handoff ghi thời gian 2026-11-06 trong khi hôm nay là 2026-11-05 — PM chỉnh khi ghi log nếu cần.
- Tên `it` ở một số test dạng `'#1 · ...'` / `'E21 · ...'`; chấp nhận được vì mang mã ca, vẫn mô tả hành vi bằng tiếng Việt.
- Scenario cần UI/storage/provider chưa được nghiệm thu ở đây (handoff đã nêu rõ) — giao cho QA-02..07.
- Chưa đo coverage (handoff đã ghi trung thực).

## Điểm tốt
- Kỳ vọng lấy từ fixture của BA, không dựng đáp án từ output của implementation.
- Phân biệt đúng metadata codec (timestamp) với dữ liệu nghiệp vụ theo docs/13.
- Test #2 kiểm cả thêm delta ≡ rebuild và thêm rồi xoá trở về ban đầu; #6 phủ nowcast hôm nay partial.
