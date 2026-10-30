---
description: (qa-engineer) Đo hiệu năng dữ liệu lớn theo ngân sách ở docs/01 §5
---

1. `npm run perf` (100k dòng từ `generate(100_000)`), lặp 5 lần, lấy median.
2. So với ngân sách trong `docs/01_ARCHITECTURE.md §5`, đánh dấu đạt/không đạt.
3. Cập nhật `docs/perf-report.md` (ngày, máy, Node/trình duyệt, bảng số đo).
4. Mục không đạt → mở bug trong `docs/bugs.md` gán owner (data-engineer / forecast-engineer / frontend-dashboard) kèm số đo và gợi ý tối ưu.
