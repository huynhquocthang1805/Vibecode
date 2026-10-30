---
description: (pm-release) Checklist trước khi deploy production và nộp bài
---

Kiểm từng mục, ghi kết quả vào `docs/SUBMISSION_CHECKLIST.md`:
1. Gate G3 đã ký trong `handoffs/GATE-G3.md`.
2. `/check build` xanh trên `main`; CI xanh.
3. Deploy production; mở link ở cửa sổ ẩn danh (localStorage trống) → chạy smoke test 10 bước (PM-03).
4. `BASE_URL=<link> npm run test:e2e` xanh.
5. Không lộ key: `git log -p | grep -iE "api[_-]?key|AIza|sk-"` không có kết quả thật; bundle không chứa key.
6. README có link online, hướng dẫn chạy, ảnh chụp; `docs/11_AI_USAGE_LOG.md` đầy đủ; video + slide xong.
7. Tag `v1.0.0`, cập nhật `CHANGELOG.md`.
