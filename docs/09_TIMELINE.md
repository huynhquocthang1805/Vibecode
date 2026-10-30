# 09 — Timeline, phụ thuộc & cổng chất lượng

Owner: `pm-release`. Giả định 5 ngày làm việc (D1–D5). Ít thời gian hơn → nén theo tỉ lệ, **cắt P2 trước, rồi P1**. Không bao giờ cắt P0, test validation, deploy.

## Sóng (wave) chạy agent
Đội 5 người — Thắng + Claude (techlead, pm-release) · Huy, Gemini (data, forecast) · Hoàng Anh, Gemini (ai) · Trường, ChatGPT (frontend-dashboard, frontend-input) · Nhân, ChatGPT (ba, qa). Lịch theo từng người: `TEAM.md` §5.

| Wave | Agent chạy song song | Người | Điều kiện bắt đầu |
|---|---|---|---|
| W0 | techlead (TL-01..04) ∥ ba-analyst (BA-01, BA-05) | Thắng ∥ Nhân | ngay |
| W1 | data-engineer → forecast-engineer (FC-01) ∥ ai-engineer ∥ frontend-dashboard + frontend-input ∥ ba-analyst (BA-02..04) | Huy ∥ Hoàng Anh ∥ Trường ∥ Nhân | TL-03 xong (có stub + contracts) |
| W2 | qa-engineer (bắt đầu viết test từ contracts + edge-cases) | Nhân | BA-01, TL-02 xong — có thể chạy cùng W1 |
| W3 | techlead tích hợp → Gate G1 | Thắng + Claude (cả đội sửa bug) | P0 của W1 xong |
| W4 | P1 (big data, tháng/quý, forecast, nowcast) | cả đội | G1 qua |
| W5 | P2 + hardening + pm-release | cả đội | G2 qua |

## Lịch đề xuất
| Ngày | Mốc | Nội dung |
|---|---|---|
| D1 sáng | Khởi tạo | TL-01..04; BA-01, BA-05 (mock data demo-30d trước) |
| D1 chiều – D2 | P0 song song | DATA-01..04, FC-01, AI-01..07, FI-01/02/05, FD-01..03/05/06, BA-02..04 |
| D2 tối | **Gate G1 – MVP** | 5 tính năng chạy end-to-end trên bản deploy preview, AI thật trả 3 gợi ý |
| D3 | P1 | DATA-05..07, FC-02..06, FI-03/04/06, FD-04, AI-08..09, QA-01..03 |
| D3 tối | **Gate G2 – Data & Forecast** | 50k dòng mượt, Tháng/Quý + nowcast đúng, backtest có số |
| D4 sáng | P2 | DATA-08/09, FC-07/08, FD-07/08 |
| D4 chiều | Hardening | QA-04..07, sửa bug, mobile, perf |
| D4 tối | **Gate G3 – Feature freeze** | Chỉ sửa bug sau mốc này |
| D5 | Release | PM-02..07: deploy prod, README, AI log, video, slide, Q&A phản biện |

## Đồ thị phụ thuộc chính
```
TL-02 contracts ─┬─► DATA-01/02 ─► DATA-03/04 ─► FI-01/02 ─────────────┐
                 ├─► FC-01 trend ─► AI-07 payload ─► AI-02 route ─► FD-05│
                 ├─► FD-01/02/03 (dùng fixtures BA-05) ───────────────────┤─► TL-06 tích hợp ─► G1
BA-01 rules ─────┼─► QA-01 tests                                          │
BA-03 prompt ────┴─► AI-03/04 ────────────────────────────────────────────┘
DATA-05 rollup ─► DATA-06 worker ─► FC-03..06 forecast/nowcast ─► FD-04 ─► G2
DATA-08 realtime ─► FC-07 anomaly ─► FD-07 live UI ─► G3
```

## Cổng chất lượng (techlead ký)
**G1 – MVP**: [ ] nhập nhiều dòng + validation + reload còn dữ liệu · [ ] biểu đồ reach/chi phí/đơn · [ ] CTR/CPC/CPA đúng ca E01–E19 · [ ] AI thật trả đúng 3 gợi ý, có fallback · [ ] copy báo cáo · [ ] CI xanh · [ ] link Vercel preview.
**G2 – Data & Forecast**: [ ] Ngày/Tuần/Tháng/Quý đúng (property test) · [ ] worker + incremental · [ ] import CSV 50k · [ ] dự báo + khoảng tin cậy + backtest · [ ] nowcast tháng/quý · [ ] perf đạt ngân sách · [ ] 200k dòng không crash, không mất dữ liệu; chaos test (quota, partition hỏng, worker chết) xanh — docs/13.
**G3 – Freeze**: [ ] live mode + bất thường · [ ] 8 E2E xanh trên deploy · [ ] mobile 375px · [ ] không lỗi console.
