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

## 8. Khả năng truy cập
Label cho mọi input, tương phản ≥ 4.5:1, không chỉ dùng màu để biểu thị tăng/giảm (kèm ▲▼), focus ring rõ, thao tác bàn phím đầy đủ cho form.
