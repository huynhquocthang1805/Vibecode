# 06 — Đặc tả giao diện

Owner: `frontend-dashboard` (layout tổng, dashboard) · `frontend-input` (khu nhập liệu). Mobile-first, kiểm tra ở 375px, 768px, 1280px.

## 1. Bố cục (desktop ≥ 1024px)
```
┌ Header ───────────────────────────────────────────────────────────────────────┐
│ Logo "KPI Mini"  [Chiến dịch ▾]  [Khoảng ngày ▾]  (Ngày|Tuần|Tháng|Quý)  ● Live │
├───────────────────────────────────────────────────────────────────────────────┤
│ KPI cards: Reach │ Click │ Chi phí │ Đơn hàng │ CTR │ CPC │ CPA                 │
│  (giá trị lớn, ▲▼ % so với kỳ trước like-for-like, sparkline, tooltip công thức)│
├──────────────────────────────────────────────┬────────────────────────────────┤
│ TrendChart: cột Reach + đường Chi phí (trục 2)│ ForecastPanel                  │
│   + đường Đơn hàng; vùng dự báo nét đứt + dải │  Dự kiến cuối tháng 11: 412 đơn │
│   khoảng tin cậy; dấu ⚠ bất thường; dataZoom  │  (370–450) · chi phí ~78tr      │
│ Tabs: [Khối lượng] [Hiệu quả CTR/CPC/CPA]     │  Dự kiến cuối Q4: ...           │
│                                              │  Mô hình HW · sai số 12% (Cao)  │
├──────────────────────────────────────────────┼────────────────────────────────┤
│ AiInsightCard                                 │ AnomalyFeed (realtime)          │
│  Headline · chips từng chỉ số · 3 gợi ý      │  ⚠ 14:32 CPC cao bất thường     │
│  [Phân tích lại]   [📋 Xuất báo cáo]          │                                │
├──────────────────────────────────────────────┴────────────────────────────────┤
│ Tabs: [➕ Nhập số liệu] [📄 Bảng dữ liệu (n dòng)] [⬆ Import CSV/Dán Excel] [⚙ Dữ liệu] │
└───────────────────────────────────────────────────────────────────────────────┘
```
Mobile (< 640px): một cột; KPI cards cuộn ngang (snap) 2 thẻ/màn; biểu đồ cao 260px; nút "➕ Nhập" nổi (FAB) mở sheet nhập liệu; nút Xuất báo cáo dính đáy khi có insight.

## 2. Trạng thái bắt buộc
| Khu | Rỗng | Đang tải | Lỗi |
|---|---|---|---|
| Dashboard | Hướng dẫn 3 bước + nút "Dùng dữ liệu mẫu" | Skeleton thẻ & biểu đồ | Banner + "Tải lại" |
| Biểu đồ | "Chưa có số liệu" | Skeleton | — |
| Dự báo | "Cần ≥ 7 ngày để dự báo" | spinner nhỏ | "Không dự báo được" |
| AI | "Cần ≥ 3 ngày" / nút "Phân tích bằng AI" | Skeleton 3 gợi ý + "AI đang đọc số liệu…" (≤ 15s) | Thẻ dự phòng + "Thử lại" |
| Bảng | "Chưa có dòng nào" | — | — |

## 3. Form nhập nhiều dòng (frontend-input)
- Bảng có hàng: Ngày (date picker, mặc định hôm nay, dòng mới = ngày kế tiếp) · Reach · Click · Chi phí (₫) · Đơn · [⧉ nhân bản] [🗑].
- `inputMode="numeric"`, tự format nghìn khi blur (`12.000`), Enter → ô kế tiếp / dòng mới, Ctrl+V dán khối từ Excel → tự tách nhiều dòng.
- Lỗi hiển thị ngay dưới ô (đỏ = error, vàng = warning) bằng message tiếng Việt từ `validateEntry`. Nút "Lưu n dòng" disabled khi còn error; hiển thị "2 dòng có cảnh báo".
- Trùng ngày → dialog: Ghi đè / Cộng dồn / Bỏ qua (+ "áp dụng cho tất cả").
- Lưu xong: toast "Đã lưu 5 dòng" + biểu đồ cập nhật tức thì (realtime).
- Mobile: mỗi dòng là 1 thẻ dọc.

## 4. Bảng dữ liệu
Ảo hoá (100k dòng mượt), sort theo cột, lọc khoảng ngày/chiến dịch, sửa inline (validate), xoá nhiều dòng + Hoàn tác (toast 5s), cột KPI tính sẵn.

## 5. Biểu đồ (ECharts)
- Màu cố định theo chỉ số (định nghĩa 1 lần ở `components/dashboard/chartTheme.ts`): reach, cost, orders, ctr, cpc, cpa. Hỗ trợ dark mode.
- Thực tế: nét liền; dự báo: nét đứt cùng màu + dải 80% mờ; ngày hôm nay: markLine "Hôm nay".
- `sampling: 'lttb'` khi > 1000 điểm; `dataZoom` (inside + slider) khi > 90 điểm; tooltip hiển thị đầy đủ số định dạng vi-VN.
- Grain Tuần/Tháng/Quý: cột theo kỳ, kỳ partial tô sọc/nhạt + nhãn "(đến hôm nay)".

## 6. Xuất báo cáo
Nút → Dialog xem trước text (font mono), chọn "Ngắn (Zalo/Messenger)" / "Đầy đủ (Email)", [📋 Sao chép] → toast "Đã sao chép — dán vào Zalo/Email" (lỗi → toast "Không sao chép được, hãy bôi đen và Ctrl+C" + tự select text), [⬇ Tải .txt].

## 7. Live mode
Toggle "● Live" (đỏ nhấp nháy khi bật) + tốc độ x1/x10/x60. Thẻ KPI nhấp sáng nhẹ khi giá trị đổi; số đếm tăng dần (animate). Bất thường → toast vàng/đỏ + mục mới ở AnomalyFeed.

## 7b. Dữ liệu lớn & khi có lỗi
ErrorBoundary từng khu, khoảng mặc định 90 ngày, giữ dữ liệu cũ khi đang tính, tiến độ + Huỷ, đồng hồ dung lượng, lưu trữ năm cũ, banner chế độ suy giảm, chặn phình ở form: `docs/13_SCALE_RESILIENCE.md` §7.

## 8. Khả năng truy cập
Label cho mọi input, tương phản ≥ 4.5:1, không chỉ dùng màu để biểu thị tăng/giảm (kèm ▲▼), focus ring rõ, thao tác bàn phím đầy đủ cho form.

## 9. Bản frontend MVP của Minh Trường — FD-01-MVP (02/11/2026)

- Thiết kế được triển khai trong `src/components/dashboard/dashboard.css`: nền off-white `#f6f7f9`, bề mặt trắng, Electric Blue `#355df5`, chế độ tối với nền `#11151e`. Dùng font Be Vietnam Pro có sẵn để giữ dấu tiếng Việt rõ nét; không thêm dependency hoặc đổi cấu hình gốc.
- Desktop: sidebar 222px, header mờ nhẹ, 4 thẻ số liệu chính + 3 thẻ tỷ lệ, Bento với biểu đồ/AI ở cột lớn và dự báo/cảnh báo ở cột phụ. Tablet thu gọn sidebar, mobile bỏ sidebar, thẻ KPI cuộn ngang và nút nhập nổi. Khoảng cách nội dung tối thiểu 20px trên mobile.
- Bộ chọn chiến dịch, khoảng ngày và grain ghi vào settings qua store. Ở bản hiện tại, `useAnalytics` vẫn trả `null`; thay đổi bộ lọc chưa tạo snapshot cho dashboard. Khu nhập/bảng/sao lưu dùng store thật.
- Nút **Xem giao diện mẫu** bật snapshot minh hoạ tĩnh, không ghi vào store, không gọi AI và không tạo báo cáo thật. Banner giải thích rõ số liệu minh hoạ; đóng chế độ này để quay về dữ liệu thật. Thay đổi form không cập nhật thẻ minh hoạ.
- Delta trên thẻ được ghi rõ **kỳ gần nhất / kỳ trước** vì `snapshot.trend.comparison` so sánh các bucket, trong khi số lớn trên thẻ là tổng của khoảng đang chọn. Không trình bày delta này thành tăng trưởng của toàn khoảng.
- Form dùng validation/domain helper có sẵn, kiểm tra ô vừa rời và kiểm toàn bộ khi lưu. Xung đột ngày được xác nhận trước khi ghi bất kỳ dòng nào. Giới hạn form/lưu trữ/cộng dồn lấy từ `LIMITS` và `validateEntry`.
- Bảng MVP phân trang 25 dòng, có lọc ngày, sắp xếp ngày, sửa trong dialog, chọn/xoá nhiều dòng và hoàn tác. Đây chưa phải bản ảo hoá FI-02b.
- Biểu đồ dùng ECharts tải động, lấy mẫu LTTB, dataZoom khi hơn 90 kỳ, tắt animation khi giảm chuyển động hoặc hơn 2.000 kỳ. Ba metric khối lượng dùng ba trục đơn vị riêng; CTR/CPC/CPA dùng hai trục. Màu tập trung ở `chartTheme.ts`.
- AI, nhập CSV/dán Excel, dự báo và báo cáo có giao diện chờ/lỗi rõ ràng khi module phụ thuộc còn stub. Không hiển thị nội dung AI hoặc kết quả dự báo giả.
- Bằng chứng review và hướng dẫn kỹ thuật: `handoffs/FD-01-MVP.md`, `handoffs/FD-01-MVP/screens/`, `handoffs/FD-01-MVP/browser-checks.json`.
