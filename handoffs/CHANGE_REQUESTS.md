# Change Requests

Agent cần đổi file KHÔNG thuộc quyền sở hữu của mình (đặc biệt `src/types/domain.ts`) ghi yêu cầu vào handoff + PR của task; **techlead (Thắng + Claude) chép vào đây** trên `main`, xử lý, đánh dấu `[x]` + quyết định. Thành viên không sửa file này trên nhánh task (tránh xung đột).

Mẫu (bỏ thụt đầu dòng khi dùng):

    - [ ] **CR-000** · từ `<role>` · file `<path>` · <mô tả thay đổi> · lý do: <…> · ảnh hưởng: <roles> · Quyết định: _(techlead)_

---

- [x] **CR-001** · từ `techlead` · `src/types/domain.ts`, `docs/10`, `docs/02 §2`, `docs/03 §4` · thêm `LIMITS`, mã `DATE_TOO_OLD`/`SUMMARY_ROW`/`LIMIT_EXCEEDED`, `ImportReport` có tổng đếm + `aborted`, `Checksum`/`dataSpan`/`forecastStatus` trong snapshot, sự kiện `system/health`, store có `checksum`/`health`/`storage`/`undoLast`; storage không lưu `id`, cost tối đa 4e10 · lý do: chống phình dữ liệu, tràn số 2^53, đói ghi khi live, quota (docs/13) · ảnh hưởng: data-engineer, forecast-engineer, ai-engineer, frontend-*, ba-analyst, qa-engineer · Quyết định: **duyệt**, làm trước khi đóng băng TL-02, `CONTRACT_VERSION` giữ 1.
