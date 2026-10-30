---
description: (ba-analyst) Sinh lại dữ liệu giả lập và kiểm tra tính hợp lệ
argument-hint: [seed]
---

1. Seed = `$ARGUMENTS` (để trống thì dùng 42). Chạy `npm run gen:mock -- --seed <seed>`.
2. Kiểm tra mỗi file trong `src/fixtures/*.json` (trừ edge-cases, ai-eval): mọi dòng qua `validateEntry` không có error; clicks ≤ reach; orders ≤ clicks; ngày liên tục, không có ngày tương lai.
3. In thống kê: số dòng, khoảng ngày, CTR/CPC/CPA trung bình theo chiến dịch, tháng có đơn cao nhất.
4. Nếu vi phạm → sửa `scripts/gen-mock.ts`, chạy lại.
