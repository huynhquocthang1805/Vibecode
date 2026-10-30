# 07 — Mẫu báo cáo tóm tắt (text)

Owner: `ba-analyst` (nội dung) · `ai-engineer` (`buildReport`). Text thuần, dán được vào Zalo/Messenger/Email, không phụ thuộc markdown.

## Mẫu NGẮN (chat) — ≤ 900 ký tự
```
📊 BÁO CÁO QUẢNG CÁO — {campaignName}
Kỳ: {from} – {to} ({grainLabel}{partialNote})

• Reach: {reach} ({reachDelta})
• Click: {clicks} ({clicksDelta}) · CTR {ctr}
• Chi phí: {costShort} ({costDelta}) · CPC {cpc}
• Đơn hàng: {orders} ({ordersDelta}) · CPA {cpa}

📈 {aiHeadline}
🔮 Dự kiến cuối {monthLabel}: ~{projOrders} đơn, chi phí ~{projCostShort}

✅ Đề xuất:
1. {s1.title}
2. {s2.title}
3. {s3.title}
```

## Mẫu ĐẦY ĐỦ (email)
```
BÁO CÁO HIỆU QUẢ QUẢNG CÁO
Chiến dịch: {campaignName}
Kỳ báo cáo: {from} – {to} ({grainLabel}{partialNote}) · So sánh với: {prevFrom} – {prevTo}

1. TỔNG QUAN
   Reach ............ {reach}   ({reachDelta})
   Click ............ {clicks}   ({clicksDelta})
   Chi phí .......... {cost}   ({costDelta})
   Đơn hàng ......... {orders}   ({ordersDelta})

2. CHỈ SỐ HIỆU QUẢ
   CTR (click/reach) ......... {ctr}   ({ctrDelta})
   CPC (chi phí/click) ....... {cpc}   ({cpcDelta})
   CPA (chi phí/đơn hàng) .... {cpa}   ({cpaDelta})

3. NHẬN XÉT XU HƯỚNG
   {aiHeadline}
   - {metricComment...}

4. DỰ BÁO
   Cuối {monthLabel}: ~{projOrders} đơn ({projOrdersLo}–{projOrdersHi}), chi phí ~{projCost}, CPA dự kiến {projCpa}
   Cuối {quarterLabel}: ~{projQOrders} đơn, chi phí ~{projQCost}
   (Mô hình {modelLabel}, độ tin cậy {confidenceLabel})

5. ĐỀ XUẤT HÀNH ĐỘNG
   1) {s1.title} — {s1.action} (Kỳ vọng: {s1.expectedImpact})
   2) {s2.title} — {s2.action} (Kỳ vọng: {s2.expectedImpact})
   3) {s3.title} — {s3.action} (Kỳ vọng: {s3.expectedImpact})

{alertsSection}
—
Tạo bởi KPI Mini Dashboard lúc {HH:mm dd/MM/yyyy}. {aiSourceNote}
```

## Quy tắc
- Delta: `▲ 12,3%` / `▼ 3,0%` / `mới` / `—`. CPC/CPA tăng vẫn dùng ▲ (người đọc tự hiểu từ ngữ cảnh) nhưng phần nhận xét phải nói rõ tốt/xấu.
- Chưa có insight AI → bỏ mục 3 & 5, thêm dòng "(Chưa chạy phân tích AI)".
- Insight là fallback → `aiSourceNote` = "Nhận xét tự động theo quy tắc (AI không khả dụng)."; AI thật → "Nhận xét do AI ({model}) tạo, đã đối chiếu với số liệu."
- Không có dự báo (< 7 ngày) → bỏ mục 4.
- `alertsSection`: tối đa 3 bất thường critical/warning trong kỳ: "⚠ 27/10: CPC cao bất thường (9.800 ₫ so với ~5.900 ₫)".
- Không xuống dòng thừa ở cuối; test snapshot cho cả 2 mẫu × (có/không AI, có/không dự báo).
