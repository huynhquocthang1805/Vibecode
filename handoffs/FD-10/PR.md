## Task
- **ID:** FD-02, FD-05, FD-10 · **Role:** frontend-dashboard + frontend-input
- **Người:** Minh Trường · ChatGPT (Astral)
- **Handoff:** `handoffs/FD-02.md`, `handoffs/FD-05.md`, `handoffs/FD-10.md`

## Đã làm
- R-01: giá trị chính ở 7 KPI khớp `comparison.current` và delta; totals có nhãn riêng. Ví dụ 3 ngày: số chính 6 đơn, tổng phụ 28 đơn.
- Phần FD-05 của R-02: chỉ truyền snapshot đủ dữ liệu thật vào useInsights; chưa sửa hook dùng chung.
- R-05: tên chiến dịch thay tên cá nhân.
- FD-10/R-06: fixture/dialog/tab/kết quả AI tải khi cần; modular ECharts, Canvas >1000 điểm, sửa resize mobile. Modern initial scripts giảm 266188 → 249843 B gzip. Tổng script gồm nomodule: 289470 B; không tuyên bố đạt 250KB khi tính cả legacy polyfill.

## Kiểm thử
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] Frontend: 39/39 test
- [x] UI production: 375/768/1440px, 1095 ngày Canvas, dark/resize, dialog, fixture lazy, KPI thật
- [x] G1: 14 passed, **gồm 4 expected-failure có sẵn** cho E26 và F5, chưa đóng 2 mục này
- [ ] `npm run check`: 3790 passed, 10 expected fail, 1 failed vì QA R-01 unexpected-pass (`it.fails`)

## Tự kiểm
- [x] Chỉ frontend, docs/06 và handoff; giữ ownership cả frontend-dashboard + frontend-input
- [x] Không đổi contracts/dependency/cấu hình hoặc tài liệu PM bị cấm
- [x] Không any/ts-ignore/console.log/secret
- [x] Base `origin/main` mới nhất khi làm: 39ae556

## Cần người khác làm / change request
- Nhân/techlead: đổi duy nhất `it.fails` thành `it` của QA **R-01**, giữ assertions và R-02/R-03. Trường chưa được cho phép sửa file QA; để Draft tới khi check xanh.
- Hoàng Anh: AI-FIX-01 guard ở hook/refresh, request dedup, effect key (R-02..04).
- Thắng 2: AI-08 buildReport/copyText, FD-06 còn chờ.
- Techlead: chốt phép đo budget modern so với tổng script gồm nomodule; số liệu đầy đủ trong FD-10.md.

## Ghi chú dùng AI
| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-04 | frontend-dashboard + frontend-input | FD-02 / FD-05 / FD-10 | Sửa số KPI, guard AI caller, lazy UI, Canvas và resize; kiểm bằng test/browser | fix/perf | Ghi rõ QA unexpected-pass, AI/report dependencies, legacy bundle | Chi tiết ở 3 handoff |
