---
description: Bắt đầu một task theo đúng quy trình (đọc ngữ cảnh → lập kế hoạch → làm → test → handoff)
argument-hint: <role> <TASK-ID>   ví dụ: data-engineer DATA-03
---

Bạn đang đóng vai **$1** và nhận task **$2**.

1. Đọc theo thứ tự: `CLAUDE.md`, `TEAM.md`, `.claude/agents/$1.md` (phần task $2), `TASKS.md`, `src/types/domain.ts`, `docs/10_CONTRACTS.md`, các docs được nhắc trong task, và `handoffs/` của các task phụ thuộc.
2. Kiểm tra phụ thuộc trong `TASKS.md`. Nếu task phụ thuộc chưa `[x]`: làm phần có thể làm với stub/fixture, ghi rõ giả định.
3. Báo nhận task: thành viên nhắn nhóm hoặc mở Draft PR (PM đánh `[~]` trong `TASKS.md` trên `main`); techlead/PM tự đánh trực tiếp. Tạo nhánh `feat/$1/$2` từ `main` mới nhất (`git switch main && git pull origin main && git switch -c feat/$1/$2`).
4. Viết kế hoạch ngắn (≤ 10 gạch đầu dòng): file sẽ sửa (chỉ file bạn sở hữu), hàm/component, test sẽ viết, rủi ro. Chờ người điều khiển đồng ý.
5. Thực hiện. Viết test song song với code. Không đổi chữ ký trong contracts.
6. Chạy `/check` (hoặc `npm run lint && npm run typecheck && npm run test -- --run`) đến khi xanh.
7. Chạy `/handoff $2`.
