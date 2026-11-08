# REVIEW QA-08 — Stress & chaos (PR #46) — **APPROVE**

## Vòng 1

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ Không lỗi chặn; 1 cảnh báo `docs/qa08-chaos-plan.md` (xem lưu ý) |
| `npm run check` | ✅ lint 0 warning · typecheck xanh · 86 files, **4256 pass + 6 expected fail** (0 fail) |
| `npm run build` | ✅ xanh |
| Ownership | ✅ Chỉ `tests/**`, `docs/08,bugs,test-report,perf-report`, handoff; không đụng source/contract/TASKS/log AI |
| Hợp đồng `domain.ts`/docs/10 | ✅ Không đổi chữ ký, không thêm API ứng dụng |
| `any` / ts-ignore / console.log / secret | ✅ Không có; không đọc `.env` |
| Ca lỗi/ca biên | ✅ Quota 3 partition + manifest, partition thiếu/hỏng, manifest mất/hỏng, stale writer, worker timeout/throw/crash, E40 từ chối import vượt `LIMITS`, safe integer ở cận |
| Handoff + log AI | ✅ `handoffs/QA-08.md` đủ, có dòng log AI |

### Lỗi phải sửa
Không có.

### Lưu ý không chặn
1. Có 5 `it.fails` (BUG-QA08-02/04/05, case `deleted`, …) + `test.fail` E49 (BUG-QA08-06) là bug sản phẩm còn mở của Huy/Trường, đã ghi `docs/bugs.md` và có marker `QA_VERIFY_FIXES`. Khi owner sửa phải bỏ `it.fails` — nếu không CI sẽ đỏ (expected fail thành pass). Nên gắn mã R-xx/BUG vào TASKS khi giao việc.
2. `docs/qa08-chaos-plan.md` là file draft cũ ngoài phạm vi; nội dung đã gộp vào docs/08 → PM xoá hoặc nhập ở lượt sau.
3. Nghiệm thu hiệu năng CHƯA đạt (E48 Live ×60 10 phút: chỉ 3 commit, max gap 511 s, heap 81→251 MB; BUG-QA08-08). Đây là bằng chứng trung thực, không phải pass hiệu năng — cần task sửa cho data/frontend trước Gate G3.
4. Worker/Web Lock là doubles; Chromium ≠ Safari/iOS thật; deploy chưa xác minh SHA.

### Điểm tốt
- Báo cáo trung thực: không cộng expected failure vào số đạt, ghi rõ lượt Live bị gián đoạn.
- Property 4×200 lượt có seed cố định, dùng store thật, kiểm checksum và rebuild 4 grain.
- Phát hiện false pass (globals dùng chung, `hydrated`) và tự sửa; đã rebase theo main bằng merge, không force push.
