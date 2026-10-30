---
name: kpi-metrics
description: Quy tắc tính và hiển thị chỉ số quảng cáo (CTR, CPC, CPA, CVR, reach, chi phí, đơn hàng) trong dự án Dashboard KPI — dùng khi viết hoặc review bất kỳ code nào tính, tổng hợp, so sánh hay định dạng KPI.
---

# KPI Metrics — quy tắc bắt buộc

Nguồn sự thật: `docs/03_KPI_RULES.md`. Tóm tắt để áp dụng ngay:

## Công thức
- CTR = clicks / reach · CPC = cost / clicks · CPA = cost / orders · CVR = orders / clicks
- Mọi phép chia dùng `safeDiv` → `null` khi mẫu = 0. Không bao giờ trả `NaN`/`Infinity`/`0` thay cho "không xác định".

## Tổng hợp
- Cộng 4 chỉ số gốc trước, rồi mới chia. **KHÔNG** lấy trung bình các tỉ số.
```ts
// ĐÚNG
const t = sumTotals(entries); const kpis = computeKpis(t);
// SAI — trung bình CTR theo ngày
const ctr = entries.reduce((s, e) => s + e.clicks / e.reach, 0) / entries.length;
```
- Tuần ISO (T2–CN), quý Q1 = T1–T3. Kỳ chưa hết → `isPartial`.
- So sánh kỳ partial → like-for-like (cùng số ngày đầu kỳ trước).

## Ý nghĩa tốt/xấu
Lấy từ `config/metricMeta.ts` (`higherIsBetter`). CPC/CPA tăng = xấu. Chi phí: trung tính.

## Định dạng (vi-VN)
`fmtInt` 125.400 · `fmtVnd` 18.500.000 ₫ · `fmtVndShort` 18,5tr · `fmtPct` 2,56% · `fmtDelta` ▲ 12,3%. null → "—".

## Checklist khi review
- [ ] Có ca mẫu = 0 trong test?
- [ ] Tổng hợp bằng tỉ số của tổng?
- [ ] Ngày dùng helper `dates.ts` (giờ VN), không `new Date('YYYY-MM-DD')`?
- [ ] Tiền là số nguyên VND?
