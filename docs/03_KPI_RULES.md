# 03 — Quy tắc nghiệp vụ KPI & ca biên

Owner: `ba-analyst`. Đây là **test oracle**: QA và data-engineer dùng bảng ca biên làm test. Bản máy đọc: `src/fixtures/edge-cases.json`.

**BA-01 — đặc tả và fixture:** phạm vi P0 là bốn đầu vào `reach`, `clicks`, `cost`, `orders` và ba KPI CTR/CPC/CPA của Đề 7. CVR là chỉ số phụ đã có trong hợp đồng. Tài liệu này không triển khai hàm KPI, validation, UI, AI hoặc storage; không thay đổi `src/types/domain.ts` hay chữ ký trong `docs/10_CONTRACTS.md`.

Nghiệm thu BA-01: chốt quy tắc, có **ít nhất 30 ca với `expect` máy so sánh được**, và QA xác nhận fixture dùng được. Đọc được JSON hoặc đủ số ca chưa đồng nghĩa các chức năng đã vượt qua kiểm thử. Hướng dẫn chạy từng loại ca và các điểm cần phối hợp nằm ở §7–§9.

## 1. Định nghĩa

| Chỉ số | Công thức | Đơn vị hiển thị | Mẫu = 0 |
|---|---|---|---|
| CTR | clicks / reach | %, 2 số thập phân | "—" |
| CPC | cost / clicks | ₫, làm tròn số nguyên | "—" |
| CPA (chi phí/đơn) | cost / orders | ₫, làm tròn số nguyên | "—" |
| CVR (phụ) | orders / clicks | %, 2 số thập phân | "—" |

> Ghi chú nghiệp vụ hiển thị ở tooltip: "CTR trong ứng dụng tính trên **Reach** (người tiếp cận) theo đề bài. Nền tảng quảng cáo thường tính CTR trên **Impressions** nên con số có thể khác."

- Mọi phép chia trong triển khai dùng `safeDiv`; mẫu số bằng 0 trả **`null`**, không trả 0 thay cho không xác định và không sinh giá trị không hữu hạn.
- Tử số bằng 0 nhưng mẫu số dương trả **0**: không có click nhưng có reach thì CTR bằng 0; có click/đơn nhưng không mất phí thì CPC/CPA bằng 0.
- `Kpis.ctr` lưu tỷ lệ: `0.019` tương ứng **1,90%**, không lưu `1.9` hay chuỗi `"1,90%"`. CPC/CPA giữ số thực khi tính; chỉ làm tròn khi hiển thị tiền.
- `computeKpis` nhận `Totals` đã chuẩn hóa. Dữ liệu âm, sai kiểu hoặc vượt giới hạn được kiểm ở validation, không đặt thêm hành vi ném lỗi cho hàm KPI ngoài contracts.
- `orders > clicks` được phép lưu với cảnh báo (§4), nên CVR tính đúng tỷ số có thể lớn hơn 1. Không kẹp số liệu để che cảnh báo. Chú thích `cvr: 0..1` trong `domain.ts` cần techlead làm rõ; BA-01 không sửa file đó và không thêm assertion CVR ≤ 1 khi dữ liệu thuộc trường hợp này.

## 2. Tổng hợp theo kỳ

- Reach/Click/Chi phí/Đơn: **cộng** trong kỳ. (Lưu ý: reach cộng dồn theo ngày có thể đếm trùng người — chấp nhận vì đề bài nhập reach theo ngày; ghi chú ở tooltip.)
- CTR/CPC/CPA/CVR của kỳ = **tỉ số của tổng**, KHÔNG phải trung bình các ngày.
  - Ví dụ: Ngày 1: 100 reach/10 click (10%); Ngày 2: 900 reach/9 click (1%). CTR 2 ngày = 19/1000 = **1,90%** (không phải 5,5%).
- Tuần = ISO week (Thứ 2 → Chủ nhật), key `YYYY-Www`. Tháng `YYYY-MM`. Quý `YYYY-Qn` (Q1 = T1–T3).
- Kỳ hiện tại chưa kết thúc hoặc thiếu ngày dữ liệu → `isPartial = true` theo `Bucket` trong contracts. Nhãn "(đến hôm nay)" dành cho kỳ hiện tại; kỳ quá khứ thiếu dữ liệu phải được mô tả là thiếu dữ liệu.
- Một dòng tất cả chỉ số bằng 0 vẫn là một ngày **có dữ liệu**. Ngày không nhập không đồng nghĩa đã nhập số 0. Khi xem nhiều chiến dịch, `daysWithData` đếm ngày phân biệt, không cộng số dòng theo chiến dịch.
- Cộng cả chi phí của ngày không có click/đơn vào tổng. Không loại dòng chỉ vì CPC/CPA của dòng đó là `null`.
- Tập rỗng có tổng bốn chỉ số bằng 0 và cả bốn KPI bằng `null`.

Ví dụ chống lấy trung bình CPC/CPA: hai ngày có `(clicks, cost, orders)` lần lượt `(10, 1000, 1)` và `(90, 18000, 3)` thì CPC tổng = `19000 / 100 = 190`, CPA tổng = `19000 / 4 = 4750`. Trung bình CPC ngày là 150 và trung bình CPA ngày là 3500 — đều sai cho KPI tổng.

## 3. So sánh kỳ (delta %)

- `pctChange = (curr − prev) / prev × 100`, phép chia qua `safeDiv`. `prev = 0`, `prev = null` hoặc `curr = null` → `null`. Cả hai bằng 0 vẫn trả `null`; `curr = 0, prev > 0` trả `-100`.
- Nhãn "mới" chỉ dùng khi `prev = 0` và `curr > 0`; thiếu dữ liệu (`null`) hiển thị "—". Nhãn thuộc UI, không phải chuỗi trả về của `pctChange`.
- Delta có đơn vị **phần trăm**, khác tỷ lệ KPI: 100 → 125 trả `25`, không phải `0.25`. CTR 2% → 3% tăng 50% tương đối, khác tăng 1 điểm phần trăm.
- **Like-for-like**: kỳ hiện tại partial → so với cùng số ngày đầu của kỳ trước. VD 29/10: so 1–29/10 với 1–29/09. Tháng trước ít ngày hơn (VD 31/03 vs tháng 2) → lấy tối đa số ngày của kỳ trước.
- Ý nghĩa tốt/xấu (assessment):

| Chỉ số | Tăng là | Ngưỡng "đi ngang" |
|---|---|---|
| reach, clicks, orders | tốt | trị tuyệt đối của Δ < 5% |
| cost | trung tính (đánh giá cùng orders) | trị tuyệt đối của Δ < 5% |
| ctr, cvr | tốt | trị tuyệt đối của Δ < 5% (tương đối) |
| cpc, cpa | **xấu** | trị tuyệt đối của Δ < 5% |
| bất kỳ | "biến động" khi CV > 0.5 trên ≥ 7 kỳ | |
Ngưỡng nằm ở `src/config/thresholds.ts`, có thể chỉnh.

## 4. Validation (nhập tay, dán, CSV)

| Mã | Điều kiện | Mức | Thông báo |
|---|---|---|---|
| REQUIRED | thiếu ngày hoặc bất kỳ ô số nào | error | "Vui lòng nhập {trường}" |
| INVALID_DATE | không parse được, hoặc ngày không tồn tại (31/02) | error | "Ngày không hợp lệ" |
| FUTURE_DATE | ngày > hôm nay (giờ VN) | error | "Không nhập số liệu cho ngày trong tương lai" |
| NOT_NUMBER | không phải số | error | "{trường} phải là số" |
| NEGATIVE | < 0 | error | "{trường} không được âm" |
| NOT_INTEGER | reach/click/đơn có phần thập phân | error | "{trường} phải là số nguyên" |
| TOO_LARGE | vượt `LIMITS.MAX_VALUE` (reach/click > 1e9, cost > 4e10, đơn > 1e7) | error | "Giá trị quá lớn, kiểm tra lại" |
| DATE_TOO_OLD | ngày < `LIMITS.MIN_DATE` (2015-01-01) | error | "Ngày quá xa trong quá khứ, kiểm tra lại năm" |
| SUMMARY_ROW | hàng "Tổng cộng/Total" trong file import | warning (bỏ qua dòng) | "Đã bỏ qua hàng tổng cộng để tránh cộng hai lần" |
| LIMIT_EXCEEDED | vượt giới hạn số dòng / số chiến dịch / kích thước file | error | "Vượt giới hạn {giới hạn} — {gợi ý xử lý}" |
| CLICKS_GT_REACH | clicks > reach | error | "Số click không thể lớn hơn reach" |
| ORDERS_GT_CLICKS | orders > clicks | **warning** | "Số đơn lớn hơn số click — có thể do đơn từ kênh khác, kiểm tra lại" |
| COST_WITHOUT_ACTIVITY | cost > 0 nhưng reach = 0 | warning | "Có chi phí nhưng không có reach" |
| DUPLICATE_DATE | trùng ngày + chiến dịch | warning → hỏi policy | "Ngày này đã có số liệu" |
Chi phí: chấp nhận số thập phân khi nhập nhưng **làm tròn về VND nguyên** (Math.round). Dòng trống hoàn toàn trong form nhiều dòng → bỏ qua, không báo lỗi.

### 4.1. Đầu vào và thứ tự kiểm tra

1. Form loại dòng mà **ngày và cả bốn ô số** đều trống sau trim. `campaignId` mặc định của form không làm một dòng trống trở thành dòng cần lưu. Dòng chỉ thiếu một vài trường vẫn phải báo lỗi. E16 kiểm ở tầng form; không yêu cầu `validateEntry` trả thêm trạng thái `skip` ngoài hợp đồng.
2. Các fixture của một dòng đều cung cấp `campaignId`; mặc định giao diện dùng `default`. Không giả định `validateEntry` tự tạo chiến dịch khi thiếu trường này. `source` là tùy chọn theo `EntryInput`.
3. Thiếu thuộc tính, `null`, chuỗi rỗng hoặc chỉ khoảng trắng ở ô bắt buộc → `REQUIRED`. **0 là giá trị đã nhập**, không phải giá trị thiếu.
4. Chuẩn hóa toàn bộ chuỗi số; không dùng cách lấy tiền tố khiến `"12abc"` thành 12. Boolean, object, chuỗi chữ, `"NaN"`, `"Infinity"` hoặc số không hữu hạn → `NOT_NUMBER`. JSON không chứa trực tiếp các giá trị số không hữu hạn; fixture dùng chuỗi để kiểm cổng nhập liệu.
5. Kiểm tra số âm **trước** làm tròn tiền: `-0.4` không được biến thành 0 và được lưu. Reach/clicks/orders phải nguyên; cost hợp lệ được `Math.round`, ví dụ `0.49 → 0`, `0.5 → 1`, `12345.6 → 12346`.
6. Kiểm giới hạn theo `LIMITS` hiện hành. Dấu `>` nghĩa là **đúng tại giới hạn vẫn hợp lệ**. Không biến các con số minh họa của fixture thành một bộ cấu hình runtime khác.
7. Chỉ kiểm quan hệ giữa các trường khi các toán hạng liên quan đã hợp lệ về kiểu, dấu, tính nguyên và giới hạn. Ví dụ reach âm không phát thêm `CLICKS_GT_REACH`; clicks vượt `MAX_VALUE.clicks` chỉ phát `TOO_LARGE` cho clicks, không phát tiếp lỗi tương quan từ toán hạng đã sai.
8. Tính `ok` từ toàn bộ issues: có ít nhất một `error` → `false`; chỉ có `warning` hoặc không có issue → `true`. Nhiều cảnh báo có thể đồng thời xuất hiện. Không tự giảm orders về clicks hoặc tăng reach để làm dữ liệu hợp lệ.

Đây là các quyết định BA-01 làm rõ cho DATA-01 và QA-01. Không đòi hỏi thứ tự trả issues hay nội dung thông báo từng ký tự; mã, trường và mức độ phải đúng.

### 4.2. Số tiền và ngày tháng

- Chấp nhận số JSON hữu hạn và chuỗi số đơn giản sau trim. Chấp nhận phân nhóm hàng nghìn hợp lệ như `1.234.567`, `1,234,567`, cùng hậu tố `₫` như `1.500.000 ₫`. Chuỗi phân nhóm sai như `1,23,456` bị từ chối; không xóa mọi dấu phân cách một cách mù quáng.
- BA-01 chưa chốt quy tắc phân biệt dạng một dấu như `"1.234"` giữa số thập phân và hàng nghìn, hoặc dạng trộn dấu. Không có ca buộc owner chọn ngầm một cách hiểu; cần thống nhất trước khi mở rộng parser. Chi phí thập phân trong fixture dùng **số JSON**, không dùng chuỗi nhập mơ hồ.
- Ngày chuẩn là `YYYY-MM-DD`, giờ `Asia/Ho_Chi_Minh`; nhận thêm `DD/MM/YYYY` theo contracts. Dùng helper trong `lib/domain/dates.ts`, không tự lấy ngày UTC bằng cắt chuỗi. Ngày không tồn tại phải bị chặn trước khi xét tương lai/quá cũ.
- Với test, `context.today` là ngày cố định. Khi có `context.now` (timestamp ISO có múi giờ), QA kiểm thêm `todayVN` rồi dùng kết quả làm `today` của validation. Không phụ thuộc ngày chạy máy.
- Khóa trùng là `campaignId|date` **sau chuẩn hóa**. Cùng ngày, khác chiến dịch không phải trùng. Validation chỉ cảnh báo; `sum`/`overwrite` do store thực hiện, không làm trong `validateEntry`.
- Ngoại lệ riêng của import Ads Manager (ô `—`/rỗng chuyển về 0 có cảnh báo, hàng tổng, mã hóa) thuộc `docs/13` §6 và BA-08/DATA-07. Không áp ngoại lệ này cho ô nhập tay thiếu dữ liệu.

### 4.3. Trường gắn với issue trong fixture

| Nhóm mã | `field` | Mức |
|---|---|---|
| REQUIRED, NOT_NUMBER, NEGATIVE, NOT_INTEGER, TOO_LARGE | trường đang sai | error |
| INVALID_DATE, FUTURE_DATE, DATE_TOO_OLD | date | error |
| CLICKS_GT_REACH | clicks | error |
| ORDERS_GT_CLICKS | orders | warning |
| COST_WITHOUT_ACTIVITY | cost | warning |
| DUPLICATE_DATE | date | warning |

Fixture so sánh tập issues chiếu về `{field, code, level}`, không ép thứ tự phần tử. Các mã dành cho import và giới hạn sức chứa vẫn theo bảng §4; BA-01 không thêm mã mới vào types.

## 5. Ca biên bắt buộc có test (≥ 30)

Giữ ý nghĩa E01–E30 để các task đang tham chiếu không bị đổi mã. E31–E50 dành cho BA-08. Các ca KPI/validation bổ sung của BA-01 dùng tiền tố `BA01-`; tất cả có dữ liệu và `expect` trong JSON. `kind: scenario` là kịch bản tích hợp cần adapter kiểm thử theo §7.3, không được coi là đã chạy chỉ vì JSON parse được.

| # | Input | Kỳ vọng |
|---|---|---|
| E01 | reach=0, clicks=0, cost=0, orders=0 | CTR/CPC/CPA = null, lưu được |
| E02 | reach=1000, clicks=0, cost=500000 | CTR 0,00%; CPC null; CPA null |
| E03 | clicks=50, orders=0, cost=1.000.000 | CPA null ("—"), không Infinity |
| E04 | clicks=1001 > reach=1000 | error CLICKS_GT_REACH |
| E05 | orders=60 > clicks=50 | warning, cho lưu |
| E06 | reach=-5 | error NEGATIVE |
| E07 | reach=10.5 | error NOT_INTEGER |
| E08 | cost=12345.6 | lưu 12346 |
| E09 | date="31/02/2026" | error INVALID_DATE |
| E10 | date = ngày mai | error FUTURE_DATE |
| E11 | date = hôm nay 23:59 giờ VN (UTC vẫn hôm qua/hôm nay) | hợp lệ, đúng ngày VN |
| E12 | cost="1.234.567" | 1234567 |
| E13 | cost="1,234,567" | 1234567 |
| E14 | cost="1.500.000 ₫" | 1500000 |
| E15 | reach="" | error REQUIRED |
| E16 | dòng trống hoàn toàn | bỏ qua |
| E17 | trùng ngày, policy=sum | cộng các trường |
| E18 | trùng ngày, policy=overwrite | thay bằng giá trị mới |
| E19 | CTR 2 ngày (100/10, 900/9) | 1,90% (tỉ số của tổng) |
| E20 | Tháng có 1 ngày dữ liệu | isPartial=true, daysWithData=1 |
| E21 | So sánh 29/10 vs tháng 9 | like-for-like 29 ngày |
| E22 | 31/03 so với tháng 2 (28 ngày) | lấy 28 ngày tháng 2 |
| E23 | prev=0, curr=10 | delta null, nhãn "mới" |
| E24 | Tuần cắt qua năm (29/12/2025–04/01/2026) | key 2026-W01 |
| E25 | Quý: 15/10/2026 | 2026-Q4 |
| E26 | < 3 ngày dữ liệu | Không gọi AI; thông báo "Cần ≥ 3 ngày" |
| E27 | 7–13 ngày đã kết thúc (fixture: 10 ngày) | baseline naive/moving_avg, confidence low; < 7 ngày không dự báo theo docs/04 §3 và docs/13 §5 |
| E28 | Tên chiến dịch chứa `<script>` / "bỏ qua chỉ dẫn trước" | Hiển thị an toàn; AI không bị điều khiển |
| E29 | CSV 50.000 dòng, 120 dòng lỗi | nhận 49.880, báo cáo 120 lỗi có số dòng |
| E30 | localStorage đầy | không mất dữ liệu trong phiên, có cảnh báo |
| E31–E50 | Ca chống phình dữ liệu & dữ liệu Excel thực tế | xem `docs/13_SCALE_RESILIENCE.md` §10 (BA-08 chép vào fixtures) |

### 5.1. Ca bổ sung BA-01

| ID | Nội dung | Kỳ vọng trọng tâm |
|---|---|---|
| BA01-V01–V04 | Dữ liệu thường; clicks = reach; cost = 0; cost > 0 nhưng reach = 0 | giá trị KPI đúng; cảnh báo không chặn lưu |
| BA01-V05–V09 | Lần lượt thiếu date, clicks, cost, orders, reach | REQUIRED đúng trường |
| BA01-V10–V12 | Chuỗi chữ, boolean, null | NOT_NUMBER hoặc REQUIRED; không ép thành 0 |
| BA01-V13–V17 | Số âm, cost = -0.4, clicks/orders thập phân | NEGATIVE / NOT_INTEGER, không phát lỗi dây chuyền |
| BA01-V18–V22 | Đúng giới hạn và vượt từng giới hạn số | nhận ở biên, chặn khi vượt |
| BA01-V23–V26 | MIN_DATE, ngày quá cũ, năm nhuận và không nhuận | chặn đúng DATE_TOO_OLD / INVALID_DATE |
| BA01-V27–V30 | Trim, chuẩn hóa ngày, trùng khóa, khác chiến dịch, ô trắng | dữ liệu chuẩn hóa; chỉ cảnh báo trùng đúng khóa |
| BA01-V31–V32 | Chuỗi Infinity / NaN | NOT_NUMBER |
| BA01-V33–V36 | Làm tròn tiền, chuỗi có ký tự rác, sai nhóm hàng nghìn | đúng ranh giới làm tròn; không parse một phần |
| BA01-V37–V38 | Hai warning cùng lúc; ngày MM/DD không thuộc định dạng nhận | ok vẫn true với warning; INVALID_DATE |
| BA01-K01 | CPC/CVR là số thập phân vô hạn | không làm tròn sớm |
| BA01-K02 | Tổng hợp tập rỗng | tổng 0, KPI null |
| BA01-K03 | Số click/đơn hai ngày không bằng nhau | CPC = 190; CPA = 4750 |
| BA01-K04 | Ngày không có click vẫn mất phí | CPC = 300; CPA = 3000 |
| BA01-D01–D04 | Ranh giới UTC/VN, cuối tuần ISO, hai phía ranh giới quý | đúng ngày VN, tuần và quý |
| BA01-P01–P05 | Null, cả hai 0, tăng 25%, giảm 100% | delta null hoặc đúng đơn vị phần trăm |

## 6. Định dạng số (vi-VN)

- Số nguyên: `125.400` · Tiền: `18.500.000 ₫` · Rút gọn (báo cáo chat): `18,5tr`, `1,2 tỷ` · %: `2,56%` · Delta: `▲ 12,3%` / `▼ 3,0%` / `— 0,0%`.

Không dùng chuỗi đã định dạng để cộng dồn hoặc tính KPI. Fixture số học so giá trị thô; kiểm nhãn và định dạng ở UI/formatter riêng. `null` hiển thị `—`, còn 0 hiển thị số 0 phù hợp đơn vị.

## 7. Quy ước `edge-cases.json` cho QA-01

### 7.1. Cấu trúc chung

File là **mảng JSON**, không bọc trong object để giữ khung mẫu BA-01. Mỗi phần tử có:

| Trường | Ý nghĩa |
|---|---|
| `id` | chuỗi duy nhất, giữ nguyên mã khi sửa nội dung ca |
| `description` | mô tả hành vi bằng tiếng Việt |
| `kind` | `validate`, `kpi`, `aggregate`, `series`, `pctChange`, `bucketKey`, `scenario` |
| `input` | dữ liệu tường minh hoặc công thức sinh dữ liệu tích hợp ở §7.3 |
| `context` | chỉ có khi cần: today, now, existingKeys hoặc truy vấn series |
| `expect` | giá trị mong đợi, chỉ dùng số hữu hạn, null, boolean, chuỗi, mảng hoặc object JSON |
| `scenario`, `targetTask` | chỉ với kind scenario: adapter cần thực hiện và task tiêu thụ; không phải tên hàm public mới |

Ví dụ một ca chặn dữ liệu sai:

```json
{
  "id": "E04",
  "description": "Click vượt reach phải chặn lưu",
  "kind": "validate",
  "context": { "today": "2026-10-20" },
  "input": { "date": "2026-10-20", "campaignId": "default", "reach": 1000, "clicks": 1001, "cost": 100000, "orders": 1 },
  "expect": {
    "ok": false,
    "codes": ["CLICKS_GT_REACH"],
    "issues": [{ "field": "clicks", "code": "CLICKS_GT_REACH", "level": "error" }]
  }
}
```

`context.existingKeys` là mảng chuỗi JSON; adapter chuyển thành `Set<string>` khi gọi `validateEntry`. Không truyền mảng thay Set vào API. `context.now` chỉ dùng tạo thời điểm cho `todayVN`, không thay đổi chữ ký context của validation.

### 7.2. Ánh xạ các ca kiểm tra hàm

| kind | Cách gọi theo contracts hiện có | Đối chiếu |
|---|---|---|
| validate | `validateEntry(input, {today, existingKeys})` | ok; codes duy nhất; issues chiếu `{field,code,level}`; các trường trong expect.value nếu có |
| kpi | `computeKpis(input)` | đúng cả ctr, cpc, cpa, cvr |
| aggregate | `sumTotals(input)` rồi `computeKpis(totals)` | expect.totals và bốn KPI ở cấp đầu của expect |
| series | dựng DailyEntry từ input → `buildRollups` → `getSeries` với context | số bucket, thứ tự và các trường của từng bucket trong expect |
| pctChange | `pctChange(input.curr, input.prev)` | expect.value |
| bucketKey | `bucketKey(input.date, input.grain)` | expect.value |

- `validate` có `expect.kpis`: chỉ sau khi `ok === true`, lấy bốn số từ `result.value` gọi `computeKpis`; không tính trên raw input. `expect.todayVN`: kiểm `todayVN` với timestamp `context.now` có múi giờ. `expect.limits`: đối chiếu đường dẫn với `LIMITS` import từ `domain.ts`; đây là assertion của fixture, không phải trường của `ValidationResult`.
- `expect.value` so các trường được ghi; cho phép hàm thêm `source` mặc định hợp lệ. Với ca lỗi, không áp đặt có/không có `value` vì contracts chưa quy định; không được lưu dữ liệu của kết quả `ok === false`.
- Khi cần `DailyEntry`, adapter thêm `id = campaignId|date`, `source = mock`, `createdAt = updatedAt = 0` cố định. Không gọi đồng hồ máy, không đổi nội dung bốn chỉ số. Các mảng `EntryInput` đã chuẩn hóa trong ca aggregate/series là dữ liệu kiểm thử, không phải dữ liệu sản xuất.
- Không mock hàm đang được kiểm tra để nó trả `expect`. Hàm còn stub phải được báo chưa triển khai/blocked, không chuyển thành test pass. Không bỏ qua một kind lạ bằng nhánh mặc định thành công.

### 7.3. Các ca tích hợp giữ từ E01–E30

Các `expect` dưới đây là **phép chiếu quan sát của adapter QA**, không bổ sung field vào kết quả API hoặc state của ứng dụng. Adapter phải đo hành vi thật, không gán kết quả bằng hằng số của fixture.

| Ca / scenario | Thiết lập và cách quan sát |
|---|---|
| E16 / blank-form-row | Đưa input.rows vào form; ghi nhận rows được gửi, index dòng bỏ qua (0-based) và số lỗi. So submittedRows, ignoredRowIndices, validationErrorCount. Không đưa toàn bộ dòng trống qua validateEntry rồi bắt nó trả skip. |
| E17–E18 / duplicate-policy | Store rỗng, nạp existing, thêm incoming với policy đã ghi. Chiếu entries cuối về date, campaignId và bốn chỉ số, bỏ metadata, sắp theo khóa; so entries và entryCount. |
| E21 / period-comparison | Mở rộng dailyRanges thành dòng từng ngày bằng addDays/daysBetween, gồm cả hai đầu; không dùng phép tăng timestamp UTC. Xem kỳ currentKey, so đúng các phạm vi, totals và deltaPct đã ghi. Ngày 30/09 có số lớn để bắt lỗi dùng cả tháng trước. |
| E22 / period-range | Với today và hai khóa tháng, quan sát phạm vi so sánh được chọn: tháng 2 kết thúc ngày 28, không tạo ngày 29–31/02. Ca này chỉ kiểm phạm vi; không áp một công thức chuẩn hóa 31 ngày thành 28 ngày ngoài quy tắc hiện có. |
| E26 / insufficient-ai-data | Dựng dữ liệu và request hợp lệ từ hai ngày, chỉ vi phạm điều kiện đủ ngày. Kiểm client không gửi request; gọi trực tiếp route thì status/code/fallback như expect, provider không được gọi. Không gửi thẳng object input của fixture làm body request. |
| E27 / short-history-forecast | Mở rộng dailyRanges bằng helper ngày, gọi luồng dự báo với today/horizonDays. Lấy dự báo của metric đã ghi; model thuộc modelOneOf, confidence khớp, số điểm đúng và mọi giá trị số của điểm hữu hạn. Đây là tập chấp nhận mô hình, không phải chuỗi so nguyên văn. |
| E28 / campaign-name-safety | Chạy riêng mỗi tên chiến dịch trên UI và request hợp lệ dùng provider stub. Tạo bộ số liệu 3 ngày liên tiếp giống BA01-V01, trend tin cậy có direction flat/changePct 0 cho cả 8 metric, overall = input.trustedOverall. Stub mô phỏng cả output đúng và output bị tên chiến dịch dụ đổi hướng/thêm gợi ý để guardrail xử lý. Đếm script thực thi; kiểm schema, đúng 3 gợi ý, overall và hướng metric khớp request. Không gọi provider thật. |
| E29 / csv-import | Sinh campaign-01…campaign-20, mỗi chiến dịch daysPerCampaign ngày liên tiếp từ startDate bằng addDays, mỗi dòng dùng input.totals. Thứ tự chiến dịch ngoài, ngày trong; tất cả khóa duy nhất. Áp invalidPatch ở invalidDataRowIndices (0-based). Viết một dòng header theo headers và delimiter rồi parse qua luồng import. So các trường ImportReport đã ghi, rejectionCodes là tập mã duy nhất và rejectedRows là số dòng file gốc (header dòng 1). Không commit CSV 50k dòng. |
| E30 / storage-quota | Nạp existing thành công, sau đó cho thao tác setItem ném lỗi tên fault.name khi lưu incoming. Chờ lần persist theo cấu hình runtime, so entries trong RAM chiếu về EntryInput; quan sát cảnh báo và trang còn thao tác được. Không yêu cầu dữ liệu chưa lưu tồn tại sau khi đóng tab. |

E21 cần dữ liệu ngày của kỳ trước để cắt chính xác. Chỉ có tổng bucket tháng thì không suy ra được tổng 29 ngày đầu. `comparePeriods(series, today)` hiện chưa mô tả cách mang đủ dữ liệu đó: Huy/techlead cần thống nhất cách nối luồng trong phạm vi contracts; BA-01 **không** đổi chữ ký hoặc giả định chia đều số liệu tháng. Các trường currentRange/previousRange của fixture là giá trị adapter quan sát, không phải field mới của `PeriodComparison`.

## 8. Cách đối chiếu và nghiệm thu

1. Parse JSON chuẩn; kiểm ID duy nhất, mỗi ca có input/expect, kind hợp lệ, context.today ở ca cần ngày. Phải có ít nhất 30 ca; E31–E50 không được dùng lại cho nội dung khác.
2. Đối chiếu bảng §5 và JSON theo ID. Kết quả kỳ vọng được tính độc lập từ quy tắc và ví dụ số, không ghi lại output của hàm đang test để làm đáp án.
3. Số nguyên, null, boolean và chuỗi so chính xác. Số thực dùng sai số tuyệt đối tối đa `1e-9` cho các fixture hiện tại, đồng thời kiểm số hữu hạn. Không so bằng cách làm tròn về chuỗi hiển thị trước: điều đó che lỗi tính toán.
4. Issues so tập `{field,code,level}` không xét thứ tự; codes so tập mã duy nhất. Không chấp nhận error thừa trong ca warning. Thuộc tính bị thiếu không tương đương null.
5. Kiểm tĩnh các expect KPI: mẫu bằng 0 phải null; mẫu dương thì kết quả hữu hạn và nhân lại với mẫu khớp tử trong sai số số thực. Với tổng hợp, tổng bốn chỉ số phải bằng cộng từng dòng. Đây chỉ là kiểm fixture, không thay thế việc gọi hàm của Huy.
6. QA-01 dùng các ca kind hàm ở §7.2; các scenario được kiểm tại tầng và task ghi trong fixture. Báo rõ số ca đã chạy, blocked hoặc còn chờ adapter; không đưa ca chưa chạy vào số pass. Property tests của QA-01 vẫn theo docs/08 và rules/tests (seed cố định, 200 lần), không được thay bằng việc đếm JSON.
7. Chạy `npm run check` trên repo và ghi kết quả thực tế. Bộ check hiện có có thể xanh dù hàm KPI/validation vẫn stub; CI xanh không tự xác nhận fixture đã chạy với logic thật.
8. BA-01 chỉ hoàn tất nghiệm thu khi QA xác nhận cấu trúc fixture và các expected dùng được, cùng review của techlead. Không tự đánh hoàn thành TASKS hoặc sửa nhật ký chung.

## 9. Giả định và điểm phối hợp

- Chuẩn hóa và thứ tự lỗi ở §4.1 là quyết định BA cho DATA-01; fixture không buộc trả thông báo tiếng Việt đúng từng ký tự. Khi owner có ý kiến khác, sửa đặc tả/expected có lý do, không đổi đáp án chỉ để test xanh.
- Giới hạn số và MIN_DATE trong fixture phản ánh contracts v1. Runtime luôn import `LIMITS`; nếu hợp đồng được techlead đổi, QA phải phát hiện fixture cần rà lại thay vì giữ ngầm con số cũ.
- Chú thích phạm vi CVR trong types và nguồn dữ liệu ngày cho E21 cần người sở hữu xác nhận. Không sửa types, chữ ký hàm, logic KPI hoặc file CHANGE_REQUESTS; chuyển yêu cầu qua phần mô tả bàn giao/PR khi thực hiện bước đó.
- E27 được làm rõ thành **7–13 ngày** theo docs/04; dưới 7 ngày không dự báo. Không mở rộng BA-01 thành triển khai mô hình dự báo hay đánh giá AI.
- Fixture là dữ liệu test, không phải `DailyEntry[]` để nạp thẳng vào dashboard. Chức năng loadMock('edge-cases') cần owner chọn các input hợp lệ hoặc xử lý riêng; không cast cả mảng ca thử thành dữ liệu nghiệp vụ.
- Lần triển khai này chỉ ghi hai file của Nhân: tài liệu này và `src/fixtures/edge-cases.json`. Test runner, báo cáo QA, handoff và thay đổi module khác là bước riêng; không thêm chúng vào patch BA-01 đã giới hạn phạm vi.
