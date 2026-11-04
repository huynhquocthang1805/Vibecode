# Review PR #22 — FI-02b · FI-03 · FI-04 · FI-06 · FI-07 — Vòng 1

**Verdict: REQUEST_CHANGES** (code đúng hướng, thiếu test cho các nhánh mới)

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ không có lỗi chặn |
| `npm run check` | ✅ lint + typecheck + 57 file test, 3890 pass, 2 expected fail (có sẵn) |
| `npm run build` | ✅ xanh |
| Ownership (chỉ `components/input/**`, `handoffs/`) | ✅ |
| Hợp đồng `domain.ts` / docs/10 | ✅ chỉ dùng API store sẵn có, không đổi chữ ký |
| Không `any`/`ts-ignore`/`console.log` | ✅ (1 `eslint-disable` có lý do cho virtualizer) |
| Ảo hoá bảng, test 100k dòng giới hạn DOM | ✅ |
| Lưu trữ năm cũ: tải → xác nhận → kiểm revision → xoá → hoàn tác | ✅ có test (cả ca revision đổi) |
| Test nhánh lỗi/ca biên của FI-06, FI-03 mới thêm | ❌ xem R-01, R-02 |
| Handoff + log AI | ✅ (5 file) |

## Lỗi phải sửa
- **R-01 (Trung bình)** — `src/components/input/EntryFields.tsx`: định dạng số khi gõ (FI-06, `1234` → `1.234`, giữ con trỏ) và Enter chuyển ô tiếp theo hoàn toàn không có test. Thêm test: gõ `1234567` → `1.234.567`; chuỗi không khớp (`12,5`, `-3`, `abc`) giữ nguyên để validator báo lỗi; số vượt `MAX_SAFE_INTEGER` không bị format; Enter ở ô cuối không chặn submit; Shift+Enter không chuyển ô.
- **R-02 (Trung bình)** — `src/components/input/ImportDialog.tsx`: các nhánh mới chưa được test: từ chối file không đuôi `.csv`, và xuất CSV lỗi chống công thức (ô bắt đầu `=`, `+`, `@`, `-` phải được thêm `'`; dấu `"` được escape). Test hiện chỉ kiểm nút "Tải danh sách lỗi CSV" có hiện. Thêm test cho hai ca này.
- **R-03 (Thấp)** — `ImportDialog.tsx`: regex chống công thức `^[=+@\-]` bỏ sót ô bắt đầu bằng Tab/CR (`\t=`, `\r=`). Mở rộng thành `^[=+@\-\t\r]`.
- **R-04 (Thấp)** — `src/components/input/DataManagerContent.tsx`: chọn bộ mẫu `campaign-2y` và cảnh báo dung lượng ≥70%/≥90% chưa có test. Thêm 1 test ngắn.

## Lưu ý không chặn
- Handoff tự nêu validate/`importBatch` còn chạy đồng bộ trên main thread → import 200k có thể vượt ngân sách; cần data-engineer cung cấp API worker (techlead chuyển vào `CHANGE_REQUESTS`). Không phải lỗi của PR này.
- FI-03/FI-07 có tiêu chí hiệu năng chưa đo; PM chỉ đánh hoàn tất khi đã có số đo.
- Regex format số không xử lý chuỗi sai nhóm (`1.2345`): giữ nguyên, validator bắt lỗi nên chấp nhận được.

## Điểm tốt
- Ảo hoá dùng `@tanstack/react-virtual` đúng stack, có spacer row, `aria-rowcount`, thẻ dọc trên 375px.
- Luồng lưu trữ an toàn: bắt buộc tải file + tick xác nhận + kiểm revision trước khi xoá, hoàn tác qua `undoLast`.
- Hoàn tác import có kiểm revision, thông báo lỗi dung lượng rõ ràng, tiếng Việt.

---

# Vòng 2 — sau commit c1b6bbc

**Verdict: APPROVE**

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ không có lỗi chặn (18 file, role frontend-input) |
| `npm run check` | ✅ lint + typecheck + 59 file test, 3909 pass, 2 expected fail (có sẵn) |
| `npm run build` | ✅ xanh |
| R-01 format số khi gõ / Enter | ✅ `EntryFields.test.tsx`: gõ liên tục, chuỗi lỗi (`12,5`, `-3`, `abc`, vượt safe int, `1.2345`) giữ nguyên, Enter/Shift+Enter |
| R-02 từ chối file không phải CSV, CSV lỗi chống công thức | ✅ tách `importErrorCsv.ts` + test (escape `"`, BOM, CRLF) |
| R-03 regex mở rộng `\t` `\r` | ✅ có test `\t=1`, `\r=1` |
| R-04 bộ mẫu `campaign-2y` + cảnh báo dung lượng 70%/90% | ✅ `InputAdvanced.test.tsx` |
| Ownership, hợp đồng, không `any`/`console.log` | ✅ |

## Lưu ý không chặn (giữ từ vòng 1)
- Validate/`importBatch` còn chạy trên main thread → import ~200k dòng có thể vượt ngân sách; cần API worker từ data-engineer (techlead chuyển vào `CHANGE_REQUESTS`).
- FI-03/FI-07 có tiêu chí hiệu năng chưa đo; QA bổ sung số đo ở perf-report.

## Điểm tốt
- Sửa đúng từng mục R-xx, test bám theo ca biên; logic CSV tách thành hàm thuần dễ test.
