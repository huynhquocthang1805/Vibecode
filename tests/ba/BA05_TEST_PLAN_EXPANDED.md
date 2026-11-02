# BA-05 · Ma trận kiểm thử mở rộng — Vibecode (bản bổ sung)

**Nguồn:** `BA05_Nhan_BLOCKED_DATA01_DATA02.zip` do thành viên Nhân cung cấp ngày 01/11/2026 và yêu cầu mở rộng test ngày 02/11/2026. **Không phải bản checkout GitHub mới nhất**: cần đối chiếu `TEAM.md`, `handoffs/` và phiên bản code đã merge của Huy trước khi mở PR. Bộ bổ sung này **không thay thế** 34 test cũ và **không kết luận PASS** nếu chưa chạy thật.

## 1. Quy mô

| Nhóm kiểm thử | Số ca riêng biệt (Vitest) |
| --- | ---: |
| Lịch sự kiện 2024–2026, đối chiếu lịch UTC độc lập | 1.096 |
| Sinh bộ demo 30 ngày, 384 seed khác nhau | 384 |
| Stress 220 kích thước dữ liệu | 220 |
| PRNG 128 seed | 128 |
| 120 mốc kết thúc dữ liệu lịch sử | 120 |
| Số dòng đầu vào không hợp lệ | 105 |
| Seed không hợp lệ | 75 |
| Options sai (days, campaignCount, profile) | 137 |
| Ngày sai hoặc >= ngày hiện tại của test | 51 |
| 347 đột biến dữ liệu / validation gate | 347 |
| Tỷ số KPI tổng: 150 oracle độc lập | 150 |
| Preset 730 ngày, narrative, leap day, tập rỗng | 7 |
| Property-based: 3 bài, mỗi bài 300 lượt (900 lượt bên trong) | 3 |
| **TỔNG automated mới** | **2.823** |

Ngoài ra có **785 kịch bản QA thủ công đề xuất** trong CSV, bao gồm nhập liệu, KPI/UI, biểu đồ, localStorage, AI, xuất báo cáo, responsive, an toàn dữ liệu, hiệu năng và E2E đa nền tảng. **Tổng số dòng test case trong CSV: 3.608**. Các lượt sinh dữ liệu nội bộ (900) **không cộng** vào 3.608 để tránh đếm trùng. Bộ test gốc 34 ca vẫn được giữ nguyên và sẽ chạy cùng suite nếu nằm trong repo.

## 2. Oracle, giới hạn và mức độ tin cậy

- Các ca calendar dùng `Date.UTC` làm oracle độc lập, không gọi `bucketKey`, `addDays` hoặc `daysBetween` để tính kỳ vọng. Lịch Tết 2024–2026 lấy từ constant của generator cung cấp; nếu nhóm đổi phạm vi lịch Tết phải cập nhật **cả dữ liệu sự kiện lẫn oracle** sau review.
- KPI tỷ lệ đối chiếu trên tổng `reach`, `clicks`, `cost`, `orders`, **không lấy trung bình tỷ lệ ngày**. Kiểm tra CTR = clicks/reach, CPC = cost/clicks, CPA = cost/orders, CVR = orders/clicks theo cách biểu diễn tỉ số (ví dụ CTR 0.1 là 10%).
- Ca invalid yêu cầu reject, **không thay hàm hoặc mock** `DATA-01/02`, không xóa test thất bại, không sửa expected để làm đẹp kết quả.
- Ca manual được gắn `NOT_RUN` và là **đề xuất QA**, không khẳng định giao diện hiện đã có đầy đủ các chức năng đó; mục `if supported` chỉ kiểm tra chức năng thực tế có trong scope.
- Có nguy cơ một số test phơi bày bug của generator, hợp đồng dữ liệu hoặc assumption ở bản mới. Phải phân loại lỗi theo **owner**; không tự sửa code của người khác.

## 3. Tệp bàn giao

- `tests/integration/gen-mock.expanded.test.ts` — 2.823 ca Vitest mở rộng (thêm mới, không chỉnh file test gốc).
- `tests/ba/BA05_TEST_MATRIX_3608.csv` — 3.608 test case, mỗi dòng ID, phạm vi, dữ liệu, expected, execution type, ưu tiên, trạng thái.
- `tests/ba/BA05_TEST_PLAN_EXPANDED.md` — kế hoạch này.

## 4. Thực thi trên Windows PowerShell tại root repo

```powershell
# Chỉ khi đã có DATA-01/02 thật trong branch đang chạy
npm.cmd run test -- tests/integration/gen-mock.expanded.test.ts

# Test gốc + test mở rộng + lint/typecheck
npm.cmd run check

# Kiểm tra chỉ thay đổi file trong quyền sở hữu
 git branch --show-current
 git status --short
 git diff --check
```

Không tạo branch mới chỉ để chép thư mục; chép **các file đúng vị trí** từ ZIP vào root repo, không tạo `Vibecode/BA05/tests` lồng nhau.

## 5. Tiêu chí nghiệm thu

1. Xác nhận DATA-01/02 đã có trên commit đang test, không chỉ ở nhánh của Huy.
2. Dữ liệu mẫu `demo-30d.json` (30 dòng) và `campaign-2y.json` (2.190 dòng) hợp lệ, khớp generator hiện tại và fixture test gốc.
3. `npm.cmd run check` hoàn tất với exit code 0; lưu log, commit SHA, số PASS/FAIL, Node/npm versions.
4. Đối chiếu review ở `handoffs/`, ưu tiên sửa lỗi ở file Nhân sở hữu; nhận xét cần sửa contracts/logic của Huy thì tạo change request.
5. Cập nhật `handoffs/BA-05.md` theo template gốc, kèm số liệu thực tế của suite mở rộng. **Chỉ Thắng review/merge**.

**Trạng thái khi phát hành bộ này: `NOT_RUN` trên latest repo.** Kiểm tra cú pháp TypeScript và cấu trúc CSV chỉ là kiểm tra tĩnh, không thay thế Vitest runtime.
