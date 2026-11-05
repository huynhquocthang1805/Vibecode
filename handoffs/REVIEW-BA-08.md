# Review BA-08 — E31–E50, stress và CSV thực tế · **APPROVE**

## Vòng 1

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ Không có lỗi chặn |
| Ownership | ✅ `scripts/gen-mock.ts`, `src/fixtures`, `docs/03` (ba-analyst); `tests/integration` (qa-engineer) — cùng một người giữ 2 role |
| `npm run check` | ✅ lint + typecheck xanh; 71 file / **4.068 test pass, 0 fail** |
| `npm run build` | ✅ build thành công |
| Hợp đồng `domain.ts` / chữ ký | ✅ Không đổi; chỉ thêm helper tooling Node |
| Không any / ts-ignore / console.log | ✅ |
| Test ca lỗi/ca biên | ✅ vượt `LIMITS`, emoji không mã hoá được CP1258, tuỳ chọn CLI sai, `today` quá sớm cho sparse, tái lập seed |
| Không commit file lớn | ✅ `src/fixtures/stress-*.json` và `test-results/` đã gitignore |
| Handoff + log AI | ✅ `handoffs/BA-08.md` |

## Lỗi phải sửa
Không có.

## Lưu ý không chặn
- E34–E50 mới là đặc tả; chưa chứng minh chức năng app đạt — handoff và docs/03 đã nói rõ. QA-02/04/08 và FC-10 phải nghiệm thu thật.
- Test 200k dòng chạy trong RAM (~vài giây), có thể chậm trên CI yếu; hiện timeout 30s là đủ.

## Điểm tốt
- Generator tái lập (seed + today cố định), không ghi file khi import module.
- Encoder CP1258 kiểm byte độc lập và báo lỗi thay vì thay bằng `?`.
- Fixture CSV Ads thực tế (chú thích, nhóm quảng cáo, hàng tổng) khớp tổng 600.000 ₫/6 đơn.
