# Review FC-07 + FC-08 — PR #26 (`feat/ai-engineer/FC-07-FC-08`) — Vòng 1

**Verdict: APPROVE**

| Hạng mục | Kết quả |
|---|---|
| PR guard | Không có lỗi chặn |
| `npm run check` | lint + typecheck xanh; Vitest 66 file / 4008 test pass, 0 fail |
| `npm run build` | Xanh |
| Phạm vi file | Chỉ sửa `anomaly.ts`, `pacing.ts`, test tương ứng và handoff (đúng quyền sở hữu ai-engineer) |
| Hợp đồng (docs/10 §D) | `detectAnomalies`, `detectLiveAnomaly`, `computePacing` giữ nguyên chữ ký; kiểu `Anomaly`/`AnomalyConfig`/`Nowcast.pacing` đúng `domain.ts` |
| Đúng docs/04 §5 | Robust z `(y−median)/(1.4826·MAD)`, cửa sổ 14 ngày trước ngày xét, tách theo thứ khi ≥ 8 tuần, MAD=0 bỏ qua, ngưỡng warn/critical, bỏ ngày partial/không dữ liệu |
| Ngưỡng | Lấy từ `cfg` (có default khớp `ANOMALY_CONFIG`), không hard-code riêng |
| Ca biên / lỗi | Test: dữ liệu rỗng/không hợp lệ, chuỗi hằng, spike/drop, warning/critical, CTR/CPC/CPA, không trùng, theo thứ, partial; pacing: target 0, âm, NaN/Infinity, mean âm, không mutate, daily rate |
| Chia an toàn | Dùng `safeDiv`; không sinh NaN/Infinity |
| Handoff | Có `handoffs/FC-07.md`, `handoffs/FC-08.md` |

## Lỗi phải sửa
Không có.

## Lưu ý không chặn
- N-1 (Thấp): `computePacing` ném `RangeError` khi target âm/không hữu hạn hoặc `projected.mean` không hợp lệ. Khi nối vào `nowcast`/worker, caller phải bắt lỗi (hoặc kiểm tra target bằng Zod trước) để không làm hỏng cả snapshot.
- N-2 (Thấp): `detectLiveAnomaly` suy ra "hôm nay" từ bucket cuối của `history` (partial → chính nó, ngược lại +1 ngày). Nếu caller truyền lịch sử có khoảng trống, thứ trong tuần có thể lệch. Nên cho truyền `today` rõ ràng khi nối ở FD/DATA (cần CR vì đổi chữ ký).
- N-3 (Thấp): Logic cửa sổ/robust z lặp ở hai hàm; có thể tách helper dùng chung sau.
- N-4 (Thấp): `computeRequiredDailyRate` là hàm export thêm ngoài hợp đồng; chấp nhận được, nên ghi vào docs/10 qua CR.

## Điểm tốt
- Pure function, không đọc đồng hồ, không `any`.
- Bộ test rộng, bám sát spec; kiểm tra cả nhánh lỗi và biên.
- Live anomaly ưu tiên critical rồi theo |z|, kết quả xác định.
