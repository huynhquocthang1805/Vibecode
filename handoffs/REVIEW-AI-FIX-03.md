# REVIEW — AI-FIX-03 (PR #48) · Verdict: **APPROVE**

Nhánh `feat/techlead/AI-FIX-03` · Người làm: Thắng (techlead làm thay ai-engineer).

## Bảng kiểm tra
| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ không có lỗi chặn |
| `npm run check` | ✅ lint + typecheck xanh; Vitest 86 file, 4260 pass / 0 fail (+6 expected fail đã biết) |
| `npm run build` | ✅ xanh |
| Hợp đồng (§E) | ✅ `InsightError` giữ nguyên (chỉ đổi nội dung `message`), chữ ký `LlmProvider` không đổi |
| Bảo mật | ✅ key chuyển từ query string sang header `x-goog-api-key`; log và message chỉ chứa mã/trạng thái/message của Google (cắt 200–300 ký tự), không chứa key hay prompt |
| Test ca lỗi / ca biên | ✅ +4 test: key không nằm trong URL, 429 → mã + gợi ý, bảng gợi ý 6 nhánh (400/403/404/503/thiếu key/lỗi lạ), body không phải JSON bị cắt 200 ký tự |
| Handoff + log AI | ✅ `handoffs/AI-FIX-03.md` |

## Lỗi phải sửa
Không có.

## Lưu ý không chặn
- `TASKS.md` không có dòng `AI-FIX-03` nên bot không đánh `[x]` được. PM nên thêm dòng này khi cập nhật docs.
- `providerHint` với 400 không phải key sai (vd INVALID_ARGUMENT do schema) chỉ trả ` (400)`. Nên thêm gợi ý "kiểm tra schema/payload" nếu gặp thực tế.
- `console.error` ghi `detail` nguyên văn từ Google. Hiện an toàn, nhưng nếu đổi provider thì cần kiểm tra lại là không lộ dữ liệu.
- Lỗi TIMEOUT (504) vẫn chưa có chẩn đoán gì thêm. Handoff đã ghi việc theo dõi sau deploy.

## Điểm tốt
- Sửa đúng nguyên nhân gốc: lỗi bị nuốt mất mã, nay vận hành viên đọc được ở Vercel Logs.
- Tách `providerHint` thành hàm thuần dễ test; người dùng vẫn nhận `fallback` như cũ.
- Handoff ghi rõ bối cảnh, phạm vi và việc cần làm sau khi merge.
