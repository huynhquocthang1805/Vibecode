# QA-08 — Stress / chaos / chống mất dữ liệu

**Trạng thái: TEST ĐƯỢC SOẠN, CHƯA CHẠY trên `origin/main` hiện tại.** Đánh giá sau khi chạy `npm run check` và kiểm thủ công end-to-end.

## Những bất biến tự động
| Bất biến docs/13 §11 | Bằng chứng | Trạng thái |
|---|---|---|
| #7 incremental applyDelta ≡ rebuild | 200 chuỗi add/update/remove, so bucket totals | Chưa chạy |
| #8 codec nhiều năm/chiến dịch | 200 property runs roundtrip | Chưa chạy; phần partition metadata cần test riêng |
| #9 QuotaExceededError | 6 vị trí setItem, đọc lại phải là before/after | Chưa chạy; cần mở rộng cho mọi bước partition 2-phase |
| #10 tổng số nguyên an toàn | 100 bộ với giá trị lớn, so tổng từ entry | Chưa chạy |

## Chaos / E40, E48–E50 bắt buộc
| Kịch bản | Thao tác có chủ ý | Kỳ vọng | Evidence cần có |
|---|---|---|---|
| E40 | Đã có 199.999 dòng, import thêm 2 dòng | Bị chặn toàn bộ; dữ liệu và revision giữ nguyên | Before/after checksum, storage |
| E48 | Live x60 trong **10 phút** | Có ghi storage ít nhất mỗi `PERSIST_MAX_WAIT_MS` = 2000ms, heap sau ổn định | Performance trace + số lần ghi mỗi 2s |
| E49 | Có 2 partition năm đã commit, xoá 1 key partition, reload | Các năm nguyên vẹn vẫn nạp, năm mất có cảnh báo | LocalStorage keys (ẩn dữ liệu thật), UI banner |
| E50 | 2 tab đồng thời add/update/remove/import/undo | Store checksum = worker checksum = rebuild; không mất dữ liệu commit | Trace + snapshots, revision |
| Worker crash | Worker throw trong `snapshot` / không khởi tạo | Restart ≤2 rồi fallback main thread; UI vẫn hoạt động | `system/health`, screenshots |
| Manifest hỏng | Trực tiếp xóa hoặc corrupt manifest rồi reload | Rebuild từ partition, không làm trắng trang | Storage trước/sau + UI |
| BroadcastChannel không có | Override bằng `undefined` trước khởi tạo | Fallback `storage` event | Test 2 tab hoặc trace |
| 200k | Import/khởi động với 200.000 dòng (≤ LIMITS.MAX_ROWS_TOTAL) | Hoạt động có cảnh báo, theo ngân sách docs/13 §9 | `docs/perf-report.md` + video |

**Nợ kỹ thuật có chủ đích:** Bài tự động hiện chưa giả lập được worker crash, hai tab, E40 UI và 10 phút live x60. Không tick QA-08 hoàn thành khi chưa có evidence cho E40, E48–E50. Bug phát hiện phải đưa vào `docs/bugs.md`, giao owner; không sửa code ngoài phạm vi QA.
