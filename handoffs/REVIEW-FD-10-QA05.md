# Review FD-10-QA05 — PR #44 `perf(FD-10): giảm độ trễ biểu đồ và xử lý CSV nền`

## Vòng 1 — verdict: **REQUEST_CHANGES**

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ Không có lỗi chặn (14 file, role frontend-dashboard, task FD-10) |
| Ownership | ✅ Chỉ sửa `components/dashboard/**`, `components/input/**`, handoff, ảnh `docs/screens` |
| `npm run check` | ✅ lint + typecheck sạch; Vitest 82 file, 4.229 passed, 1 expected fail |
| `npm run build` | ✅ Build đạt, đủ route |
| Hợp đồng / chữ ký | ✅ Props `CampaignChart`, `EChartCanvas`, `ImportDialog` giữ nguyên; không đổi `domain.ts` |
| Không `any` / `ts-ignore` / `console.log` / secret | ✅ |
| `safeDiv`, không NaN | ✅ `AnomalyFeed.deviation` dùng `safeDiv` + `fmtInt` |
| Tính nặng ngoài main thread | ✅ Đọc CSV và validate chạy trong Web Worker, chỉ gửi 20 dòng xem trước |
| ECharts lazy | ✅ Vẫn `dynamic(..., { ssr: false })`; dispose instance và listener khi đổi renderer/unmount |
| Test ca lỗi/ca biên | ❌ Module mới `csvImportSession.ts` không có test riêng (R-01) |
| Handoff + log AI | ✅ `handoffs/FD-10-QA05.md` |
| Ngưỡng hiệu năng QA-05 | ⚠️ Cả 3 ngưỡng còn mở (xem lưu ý) |

### Lỗi phải sửa

1. **R-01 (Trung bình) — `src/components/input/csvImportSession.ts` thiếu test cho nhánh lỗi.**
   File mới này chứa toàn bộ logic vòng đời worker: huỷ, lỗi worker, phiên đã dispose. `ImportDialog` chỉ được test qua bản mock của nó (`vi.mock('./csvImportSession')`), nên các nhánh sau chưa được chạy:
   - `signal` đã abort trước khi gọi `read`/`prepare` → reject `ABORTED`.
   - Sự kiện `error` / `messageerror` của worker → `dispose()` rồi reject với thông báo tiếng Việt.
   - Gọi `read`/`prepare` sau `dispose()` → reject "Phiên đọc CSV đã kết thúc".
   - `abort` giữa chừng → `worker.terminate()` được gọi, `releaseProxy` chỉ chạy một lần (`dispose` idempotent).

   Cách sửa: thêm `csvImportSession.test.ts` cạnh file nguồn, stub `Worker` (`addEventListener`, `terminate`, `postMessage`) và mock `comlink.wrap`. Thêm một test ở `InputAdvanced.test.tsx` cho đường lỗi: `session.read` reject → hiện thông báo "Không đọc được bảng…", không có dữ liệu bị ghi.

2. **R-02 (Thấp) — Test cho `csvImport.worker.ts` / `importPreparation.ts`.**
   `prepareImport` mới chỉ được gọi gián tiếp trong test huỷ. Thêm một test nhỏ cho `prepareImport`: cột ánh xạ thiếu, dòng sai ngày/số âm vào `report`, và `source` đúng (`csv` / `paste`).

### Lưu ý không chặn

- Handoff tự ghi cả 3 ngưỡng QA-05 còn mở: Quý→Ngày 611 ms (< 500), Long Task 130 ms (< 50), bundle 259.116 B gzip (< 256.000). Bundle tăng 210 B so với base. PR cải thiện so với mốc gốc (844 → 611 ms, 172 → 130 ms) nhưng chưa đạt. Thắng quyết định chấp nhận hay không; `TASKS.md` FD-10 giữ `[~]`.
- Việc `entryInputSchema` khởi tạo ở cấp module (BUG-QA05-03) đã chuyển cho Huy qua CR, đúng ownership.
- Handoff ghi "Giữ Draft". Nếu PR đã Ready thì nên thống nhất lại với Trường.
- Trong `CampaignChart`, `visibleSeries` chỉ dùng chuỗi `daily` khi `data === snapshot`. Điều kiện này có test (đổi campaign thì quay lại chuỗi Quý). Giữ nguyên.

### Điểm tốt

- Tách `importPreparation` thuần và dùng lại giữa worker với đường dự phòng (không có Worker / dán Excel).
- Huỷ import an toàn: `AbortController`, dispose worker, test kết quả đến muộn không ghi store.
- Khởi tạo ECharts một lần cho mỗi renderer, `setOption` với `replaceMerge`, `ResizeObserver` chỉ resize khi kích thước đổi.
- Chuỗi dự báo gửi cặp `[ngày, giá trị]` thay vì đệm `null` cho toàn bộ lịch sử. Có test cập nhật.
- Số đo trước/sau minh bạch, công bố cả phần không đạt, kèm ảnh 1440/375.
