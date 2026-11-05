# REVIEW — AI-08 (buildReport + copyText) — PR #28

**Verdict: APPROVE** (Vòng 1)

## Bảng kiểm tra

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ Không lỗi chặn; 1 cảnh báo `clipboard.test.tsx` ngoài phạm vi — chấp nhận (test cạnh file nguồn `clipboard.ts` do forecast-engineer sở hữu, CLAUDE.md §4) |
| `npm run check` | ✅ lint + typecheck xanh; 69 file, **4050 test pass / 0 fail** |
| `npm run build` | ✅ xanh |
| Hợp đồng (docs/10 §G, domain.ts) | ✅ giữ nguyên chữ ký `buildReport(ReportInput): string`, `copyText(text): Promise<boolean>` |
| Không `any` / `ts-ignore` / `console.log` | ✅ (grep trên diff) |
| Pure / `safeDiv` / KPI = tỉ số của tổng | ✅ `computeKpis(totals)`; không đọc đồng hồ (dùng `generatedAt`) |
| Ngày theo giờ VN, helper `dates.ts` | ✅ `parseISODate`, `todayVN`, `Intl` với `Asia/Ho_Chi_Minh` |
| Test ca biên/lỗi | ✅ 38 test, 8 snapshot; E01/E03/E11/E19/E23/E28, fallback AI, ngày sai, kỳ so sánh lệch, thiếu nowcast tháng/quý, clipboard bị từ chối/không DOM, khôi phục focus |
| Không secret / không gọi AI từ client | ✅ |
| Handoff + log AI | ✅ `handoffs/AI-08.md` |

## Lỗi phải sửa

Không có.

## Lưu ý không chặn

- Lọc dòng nowcast trong `buildReport.ts:183` dựa vào chuỗi `{projOrders}`/`{projQOrders}` trong template — nếu BA đổi cấu trúc dòng, cần cập nhật cùng lúc (đã ghi trong handoff).
- Delta chỉ có khi khoảng báo cáo khớp kỳ so sánh cuối; báo cáo nhiều kỳ hiển thị `—` (hợp lý theo hợp đồng hiện tại).
- Chưa thử clipboard trên thiết bị thật — QA/FD-06 nghiệm thu khi chạy lại Gate G1.

## Điểm tốt

- Rút gọn mẫu ngắn giữ nguyên số liệu và đủ 3 gợi ý, không cắt đôi grapheme.
- Nội dung người dùng chứa cú pháp template vẫn là dữ liệu thuần (E28).
- `copyText` dọn phần tử tạm, khôi phục focus/vùng chọn, tương thích focus trap dialog.
