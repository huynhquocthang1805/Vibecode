# Review QA-02 — Integration store↔storage↔worker · Verdict: APPROVE

## Vòng 1
| Hạng mục | Kết quả |
|---|---|
| PR guard | Không có lỗi chặn |
| `npm run check` | Xanh: lint + typecheck OK; 74 file, 4160 pass, 1 expected fail (BUG-QA02-01), 0 fail |
| `npm run build` | Xanh |
| Phạm vi file | Chỉ test + docs/bugs.md + handoff; không sửa code nguồn (đúng quy tắc tests.md) |
| Ca lỗi/ca biên | JSON hỏng, migrate v0, quota (E30), localStorage bị chặn, backup hỏng + undo, Worker ném lỗi → fallback |
| Handoff + log AI | Có |

### Lỗi phải sửa
Không có.

### Lưu ý không chặn
- BUG-QA02-01 (Trung bình, data-engineer): đã xác nhận `src/lib/data/store.ts:965` đọc `window.localStorage?.getItem(...)` ngoài try/catch nên `SecurityError` làm import store reject. Test dùng `it.fails` hợp lý; techlead tạo change request cho Huy, khi sửa thì bỏ `.fails`.
- Test fallback worker so với engine packed trong module riêng; không chạy Worker thật (đã ghi rõ trong handoff).

### Điểm tốt
- Test hydrate bằng `vi.resetModules()` kiểm chứng đúng vòng lưu → tải lại, so checksum.
- Dùng fake timers, ngày cố định; không sửa expected để che lỗi, bug được ghi nhận minh bạch.
