# Review BA-07 — Glossary + tooltip + microcopy UI · PR #45

**Verdict: APPROVE** (Vòng 1)

## Bảng kiểm tra
| Hạng mục | Kết quả |
|---|---|
| PR guard | Không có lỗi chặn (4 file, đúng ownership ba-analyst) |
| `npm run check` | Xanh: lint 0 warning, typecheck OK, Vitest 83 file · 4239 pass · 0 fail (1 expected fail có sẵn) |
| `npm run build` | Xanh |
| Hợp đồng `domain.ts` / docs/10 | Không đổi; giữ `GLOSSARY`, `glossaryFor`, `UI_MICROCOPY` cũ; thêm `UI_COPY`, `DEGRADED_COPY`, `StateMessage` chỉ trong `config/` |
| Ownership | `src/config/**`, `handoffs/BA-07.md` — đúng |
| Test ca lỗi/ca biên | Có: mẫu số 0 → "—", CVR > 100%, reach không phải người duy nhất, dự báo không cam kết, giới hạn 2 câu, prototype key (`constructor`, `__proto__`), chuỗi rỗng, fallback ≠ AI, lỗi lưu → nhắc sao lưu |
| Handoff + log AI | Đủ |
| Nội dung nghiệp vụ | Khớp quy tắc KPI = tỉ số của tổng; không thêm ngưỡng tốt/xấu |

## Lỗi phải sửa
Không có.

## Lưu ý không chặn
- Test giới hạn "tối đa 2 câu" tách câu bằng `/[.!?]+/`; dễ sai nếu sau này có số thập phân hoặc "VD." trong tooltip. Cân nhắc dùng regex chặt hơn ở lần sửa sau.
- `UI_MICROCOPY` (glossary.ts) và `UI_COPY` (microcopy.ts) hơi chồng chéo nội dung; Trường nên chọn một nguồn khi nối UI rồi để PM dọn bản còn lại.
- `UI_COPY`/`DEGRADED_COPY` chưa được component nào dùng (đã nêu trong handoff). Việc nối vào UI và cập nhật docs/06 §2 thuộc Trường.
- Chính tả: "xóa" (microcopy.ts, bảng) và "xoá" (nơi khác) chưa thống nhất.

## Điểm tốt
- Sửa lỗi nghiệp vụ trong glossary cũ: CVR không còn bị mô tả là "tỉ lệ người mua" (sai khi đơn > click); reach cộng ngày không bị hiểu thành số người duy nhất.
- Công thức ghi rõ "Tổng ÷ Tổng" và ca mẫu số 0 hiển thị "—".
- Lời văn dự báo/bất thường không khẳng định nguyên nhân hay cam kết kết quả.
- Phân biệt rõ nhận xét dự phòng theo quy tắc với phản hồi AI; lỗi lưu tạm nhắc xuất sao lưu.
- Giữ tương thích API cũ, tra cứu glossary chặn khoá prototype.
