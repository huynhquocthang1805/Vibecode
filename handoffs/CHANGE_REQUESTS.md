# Change Requests

Agent cần đổi file KHÔNG thuộc quyền sở hữu của mình (đặc biệt `src/types/domain.ts`) ghi yêu cầu vào handoff + PR của task; **techlead (Thắng + Claude) chép vào đây** trên `main`, xử lý, đánh dấu `[x]` + quyết định. Thành viên không sửa file này trên nhánh task (tránh xung đột).

Mẫu (bỏ thụt đầu dòng khi dùng):

    - [ ] **CR-000** · từ `<role>` · file `<path>` · <mô tả thay đổi> · lý do: <…> · ảnh hưởng: <roles> · Quyết định: _(techlead)_

---

- [x] **CR-001** · từ `techlead` · `src/types/domain.ts`, `docs/10`, `docs/02 §2`, `docs/03 §4` · thêm `LIMITS`, mã `DATE_TOO_OLD`/`SUMMARY_ROW`/`LIMIT_EXCEEDED`, `ImportReport` có tổng đếm + `aborted`, `Checksum`/`dataSpan`/`forecastStatus` trong snapshot, sự kiện `system/health`, store có `checksum`/`health`/`storage`/`undoLast`; storage không lưu `id`, cost tối đa 4e10 · lý do: chống phình dữ liệu, tràn số 2^53, đói ghi khi live, quota (docs/13) · ảnh hưởng: data-engineer, forecast-engineer, ai-engineer, frontend-*, ba-analyst, qa-engineer · Quyết định: **duyệt**, làm trước khi đóng băng TL-02, `CONTRACT_VERSION` giữ 1.
- [x] **CR-002** · từ `ba-analyst` (BA-01 §1, §9) · `src/types/domain.ts` · chú thích `cvr: 0..1` mâu thuẫn với quy tắc `orders > clicks` chỉ là warning · ảnh hưởng: data-engineer, qa-engineer, frontend-dashboard · Quyết định: **duyệt** — chỉ sửa chú thích (CVR có thể > 1 khi có cảnh báo ORDERS_GT_CLICKS; không kẹp số). Kiểu không đổi.
- [x] **CR-003** · từ `ba-analyst` (BA-01 §7.3, E21) · `docs/10` §B `comparePeriods` · so sánh like-for-like kỳ tháng/quý partial cần dữ liệu **ngày**, `Series` theo grain không đủ để cắt 29 ngày đầu · ảnh hưởng: data-engineer (DATA-05/06), qa-engineer · Quyết định: **duyệt** — thêm tham số tuỳ chọn `daily?: Series` (bổ sung, không phá chữ ký cũ): `comparePeriods(series, today, daily?)`. Kỳ hiện tại partial và grain ≠ day → bắt buộc dùng `daily` để cắt cùng số ngày; không có `daily` → `likeForLike = false`. Worker luôn truyền `snapshot.daily`.
