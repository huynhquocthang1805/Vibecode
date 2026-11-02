# Handoff — FD-01-MVP · Frontend MVP KPI Mini

- **Role:** frontend-dashboard + frontend-input
- **Người:** Minh Trường · ChatGPT (Astral/Codex)
- **Nhánh:** `feat/frontend-dashboard/FD-01-MVP`
- **Ngày:** 2026-11-02 (Asia/Ho_Chi_Minh)
- **Contracts:** đã đọc `domain.ts` v1, giữ nguyên props tối thiểu và chữ ký module.
- **Phạm vi đã xác nhận:** người dùng chọn **chỉ làm component trong phạm vi frontend**. Không sửa trang ghép, module dữ liệu/AI, config gốc, TASKS hoặc nhật ký chung.

## Đã làm

- Giao diện Bento off-white/Electric Blue, sidebar, header blur, khoảng trắng thoáng, hover nhẹ, sáng/tối, responsive và reduced motion. Giữ font tiếng Việt đã có.
- FD-01/02/03: shell, 7 thẻ KPI, công thức/tooltip, sparkline, delta theo chiều tốt/xấu, ECharts khối lượng và tỷ lệ tải động. Bộ lọc chiến dịch/khoảng ngày/grain nối đúng settings của store.
- FI-01: form nhiều dòng, thêm 1/7 ngày, nhân bản/xoá nháp, validation inline/aria, chặn trước hydrate, giới hạn theo LIMITS, xác nhận trùng ngày trước khi ghi batch; ghi đè/cộng dồn/bỏ qua.
- FI-02: bảng phân trang 25 dòng, lọc ngày, sắp xếp ngày, chọn nhiều, sửa bằng dialog, xoá và hoàn tác. Dùng computeKpis/format có sẵn.
- FI-05: dữ liệu mẫu có xác nhận thay thế, xuất/nhập backup, dung lượng, tạo chiến dịch, xoá hết phải gõ XOÁ.
- Giao diện tiêu thụ contract cho AI, dự báo, cảnh báo, báo cáo và CSV/Excel. Module chưa có kết quả → trạng thái chờ/lỗi cụ thể, không bịa kết quả.
- Bản xem trước thiết kế tách biệt: snapshot JSON cố định từ fixture BA-05, chỉ hiển thị khi bật **Xem giao diện mẫu**; không thay dữ liệu thật, không gọi AI, không xuất báo cáo minh hoạ thành báo cáo thật.
- ErrorBoundary từng khu và thông báo lỗi toàn cục có giới hạn tần suất. Lỗi khu nhập được giữ trong khu nhập.

## File thay đổi

- `src/components/dashboard/**` và test cạnh component.
- `src/components/input/**` và test cạnh component.
- `docs/06_UI_SPEC.md` §9.
- `handoffs/FD-01-MVP.md`, thư mục bằng chứng `handoffs/FD-01-MVP/`.
- Không thêm thư viện. Không đổi file thuộc owner khác hoặc hợp đồng dữ liệu.

## API / component công khai

Giữ nguyên toàn bộ tên/props tối thiểu trong docs/10 §H:

```tsx
<DashboardShell controls kpis chart forecast insight anomalies data />
<KpiCards snapshot />
<TrendChart snapshot showForecast />
<KpiRatioChart snapshot />
<AiInsightCard snapshot />
<ExportReportButton snapshot insight />
<ForecastPanel nowcasts forecasts />
<AnomalyFeed anomalies />
<GrainSwitcher />
<LiveModeToggle />
<EntryForm onSubmitted? />
<EntryTable />
<DataManager />
<CsvImportDialog />
<PasteImportDialog />
```

Bổ sung nội bộ: DateRangeControl, ReviewContext/ChartAppearanceContext, CampaignChart/EChartCanvas, EntryFields, ImportDialog. PasteImportDialog nhận thêm props tuỳ chọn `initialText`, `initiallyOpen`, `onClose`; cách gọi cũ vẫn chạy.

## Kiểm thử

| Bước | Kết quả |
|---|---|
| `npm run check` | PASS: lint, typecheck, 19 file / 3.646 test |
| Test frontend mới | 31 test: nhập hợp lệ/lỗi/cảnh báo, ngày tương lai, trùng ngày, huỷ batch, cộng dồn vượt trần, sửa/xoá/hoàn tác, xác nhận xoá, KPI null/CPA tăng, báo cáo lỗi, khoảng ngày đảo ngược |
| `npm run build` | PASS: production build thành công |
| Chrome production | 15 kiểm tra PASS, không pageerror/hydration mismatch |
| Responsive | Không tràn ngang ở 375, 768, 1280, 1440px; đã xem ảnh sáng/tối, desktop/mobile/tablet |
| Lưu thực tế | Nhập → bảng → sửa sai bị chặn → xoá/hoàn tác → reload giữ dữ liệu → xuất backup → xoá có xác nhận → nhập backup khôi phục |

Bằng chứng: `check.log`, `build.log`, `browser-checks.json`, `screens/*.png` trong thư mục cùng tên task. Script `verify.mjs` chạy với Chrome có sẵn; có thể đặt `FRONTEND_REVIEW_BROWSER` và `FRONTEND_REVIEW_URL`.

Lưu ý môi trường Windows: 4 test BA-05 ban đầu lỗi vì Git checkout JSON thành CRLF trong khi test đối chiếu nguyên byte LF. Đã khôi phục đúng byte từ blob Git của hai fixture, không tạo diff nội dung hay đưa fixture vào commit. Techlead nên chốt `.gitattributes` để CI/Windows nhất quán.

## Cách dùng cho người nhận

```powershell
git switch feat/frontend-dashboard/FD-01-MVP
npm ci
npm run dev
```

Mở http://localhost:3000. Chọn **Xem giao diện mẫu** để review thẻ/biểu đồ; thử nút mặt trăng để xem dark mode. Khu nhập liệu/bảng/dữ liệu hoạt động với store thật và lưu trên trình duyệt. Có thể dùng dữ liệu mẫu trong tab Dữ liệu sau khi xác nhận thay thế.

Kiểm tra production bằng trình duyệt:

```powershell
npm run build
npm run start -- --port 3002
# Cửa sổ khác:
node handoffs/FD-01-MVP/verify.mjs
```

## Hạn chế / nợ kỹ thuật

- Đây là **MVP frontend để review**, chưa phải MVP P0 tích hợp end-to-end: useAnalytics/useInsights và các module DATA/AI liên quan còn stub trên main.
- KPI/biểu đồ số liệu thật đợi DATA-05/06; AI thật đợi AI-01..07; xuất text/copy đợi AI-08 + BA-04; CSV/dán Excel đợi DATA-07; dự báo đợi FC-02..06. Component hiển thị sẵn theo contract.
- Bản xem trước chỉ có grain Ngày; các lựa chọn khác tắt rõ ràng. Khi xem dữ liệu thật, bộ lọc ghi settings nhưng dashboard còn chờ snapshot.
- Live mode hiển thị chế độ thủ công; không bật simulator hoặc ngụ ý realtime đang hoạt động.
- FI-02b/FD-09/P1 dữ liệu lớn chưa hoàn tất: bảng phân trang, sort/filter trên main thread; chưa đo ngân sách 50k/200k dòng hoặc Lighthouse.
- Bản nhập CSV/Excel mới có giao diện preview/mapping/policy/progress/report; chưa kiểm luồng parse thành công vì module phụ thuộc còn stub. Chưa có file lỗi CSV đầy đủ hoặc luồng lưu trữ năm cũ.
- importBackup hiện chỉ nhập entries, giữ campaigns/settings cũ theo hành vi store. Roundtrip đã kiểm với chiến dịch default. Khôi phục tên/màu nhiều chiến dịch và settings cần owner dữ liệu hoàn thiện.
- loadMock của store còn sinh dữ liệu demo riêng, chưa dùng fixture BA-05 mới; dữ liệu xem trước thiết kế và dữ liệu mẫu của store được ghi nhãn riêng.
- Theme sáng/tối lưu trong state của phiên trang, chưa lưu thành thiết lập người dùng.

## Cần người khác làm

1. **Techlead (TL-06):** nối snapshot thật vào slot hiện có sau DATA-05/06, nhận trạng thái loading/error của hook, bỏ nhãn “store tạm” trong controls ghép trang. Không cần đổi props component của nhánh này.
2. **Huy:** DATA-05/06/07, DATA-04b fixture; hoàn thiện importBackup cho campaigns/settings và validate toàn bộ backup/capacity nguyên tử. Giữ hợp đồng hiện có.
3. **Hoàng Anh + Nhân:** AI-01..08, BA-04. AI card/report button đã tiêu thụ hook và buildReport/copyText đúng contract.
4. **Techlead:** thêm `.gitattributes` với fixture JSON LF hoặc thống nhất test byte trên Windows. Đây là vấn đề checkout có sẵn, không thuộc UI.
5. **Thắng:** review nhánh và merge; chỉ techlead được merge vào main. Nội dung PR chuẩn bị tại `handoffs/FD-01-MVP/PR.md`.

## Ghi chú dùng AI

- Prompt chính: Senior Frontend Developer + UI/UX, Apple/Stripe, Bento, off-white/dark, Electric Blue, Tailwind và MVP trên nhánh riêng.
- Người dùng xác nhận chỉ sửa component frontend khi được hỏi về quyền sửa phần ghép trang.
- AI sai và cách phát hiện: bản đầu đọc ngày trong prerender → Next báo lỗi; đã bọc form bằng Suspense. Banner storage khác server/client → browser phát hiện hydration mismatch; đã đợi hydrate trước khi hiển thị. Validation toàn dòng khi blur làm nút Lưu đổi vị trí trong lúc click → kiểm thử Chrome phát hiện; đã kiểm ô vừa rời và xoá lỗi của ô khi chỉnh. Test UI ban đầu dùng option `exact` của Testing Library sai kiểu → typecheck phát hiện và sửa.
- Chưa có đánh giá thẩm mỹ từ người dùng; không ghi là người dùng đã duyệt.

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-02 | frontend-dashboard + frontend-input | FD-01-MVP | Bento responsive sáng/tối, KPI/ECharts, form/bảng/backup, trạng thái phụ thuộc, test và ảnh review | Tạo code + kiểm thử + tự phản biện | Browser tìm ra prerender/hydration và blur làm mất click; đã sửa. Người dùng chưa review. | src/components/dashboard/**; src/components/input/**; docs/06_UI_SPEC.md |
