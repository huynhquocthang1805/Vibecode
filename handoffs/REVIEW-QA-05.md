# Review QA-05 — Benchmark hiệu năng (PR #40) — **APPROVE**

## Vòng 1

| Hạng mục | Kết quả |
|---|---|
| PR guard | Không có lỗi chặn |
| `npm run check` | Xanh: lint 0 warning, typecheck OK, Vitest 79 file, 4210 pass + 1 expected fail, 0 fail |
| `npm run build` | Xanh |
| Phạm vi file | Đúng quyền qa-engineer: `tests/perf/*`, `docs/perf-report.md`, `handoffs/QA-05.md`. Không đụng code nguồn, `domain.ts` hay hợp đồng |
| Có assertion nghiệp vụ | Có: rollup đủ 100k dòng, snapshot đủ 4 forecast + 2 nowcast, decode đủ 50k dòng, tổng reach KPI khớp fixture, số dòng hiển thị khớp |
| Nhánh lỗi / ca biên | Script ném lỗi khi không có script tag, số đo không hợp lệ hoặc số mẫu ≠ 5. Ca biên "CSV 50k gộp còn 500 khóa" được ghi rõ |
| Trung thực số liệu | Tốt: 3 mục chưa đạt (chart, Long Task, gzip JS) ghi "Chưa đạt", không coi là pass |
| Handoff + log AI | Có |

### Lỗi phải sửa
Không có.

### Lưu ý không chặn
1. `npm run perf` vẫn là `vitest bench`; hai script mới chạy bằng `npx tsx`. Nên nối vào `package.json` (techlead) nếu muốn có lệnh chuẩn.
2. Handoff có lỗi chính tả thiếu khoảng trắng ("Long Task93/92", "JS257414", "90ngày"). PM sửa khi tổng hợp.
3. Số đo đo trên Windows, 1 máy. `snapshot` 144,96 ms sát ngưỡng 150 ms, nên không dùng làm CI gate (báo cáo đã nói rõ).
4. Deploy không xác minh được SHA, nên số deploy chỉ mang tính tham khảo.
5. Ba mục chưa đạt cần tạo bug/task cho owner: chart quý → ngày 580/534 ms (ngân sách 500), Long Task khi import 93/92 ms (ngân sách 50), gzip JS đầu 257,4 KB (ngân sách 256 KB, vượt rất ít).
6. Bắt buộc ghi lại: CSV 50k chỉ chứng minh thông lượng đọc/validate đầu vào, chưa chứng minh commit 50k khóa khác nhau.

### Điểm tốt
- Một lượt warm-up không tính, lấy median 5 mẫu, có seed cố định.
- Mẫu thô, môi trường và giới hạn đo được công bố đầy đủ.
- Ghi lại cả lỗi AI mắc phải (range mặc định 90 ngày) và cách phát hiện.
- Không gửi tải sang API/provider AI (dùng `stubAi`).
