# DATA-HOTFIX-02 — Test hiệu năng codec phân vùng đỏ ngẫu nhiên trên CI

Người làm: Thắng (techlead) · sửa test của Huy (data-engineer) · 2026-11-04

## Triệu chứng
CI PR #19 (Trường) đỏ ở `src/lib/data/storage/partition.test.ts` "Hiệu năng: mã hoá 50.000 dòng":
`expected 215.78 to be less than 200`. Code không đổi — runner GitHub dùng chung, 1 lần đo đơn lẻ bị nhiễu.

## Sửa
- Làm nóng JIT 1 lần, đo 3 lần, lấy lần nhanh nhất `< 200ms` (ngân sách giữ nguyên).
- Tên test sửa cho đúng ngưỡng (trước ghi "< 30ms" nhưng kiểm 200ms).
- Không đổi code nguồn.

## Test
`npm run check`: 54 file, 3853 passed, 10 expected fail.

## Ghi chú PR #19 (Trường)
PR #19 chỉ đổi R-01 `it.fails` → `it`; thay đổi này đã vào `main` qua PR #12 (commit 1c77d9a) → PR #19 thừa, đóng.

## Log AI
- Claude (techlead): đọc log CI run 41842965925, tách 2 lỗi (R-01 thiếu code frontend khi chạy riêng · perf flaky), sửa test perf.
