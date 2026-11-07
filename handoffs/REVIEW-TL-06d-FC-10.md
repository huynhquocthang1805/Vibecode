# REVIEW TL-06d + FC-10 — PR #43 — **APPROVE**

## Vòng 1
| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ Không có lỗi chặn |
| `npm run check` | ✅ lint + typecheck sạch; Vitest 82 file, 4226 pass, 1 expected fail, 0 fail |
| `npm run build` | ✅ xanh |
| Hợp đồng / chữ ký (`domain.ts`, docs/10) | ✅ không đổi chữ ký; `forecastMetric` giữ nguyên |
| Không `any`/`ts-ignore`/`console.log` | ✅ |
| Logic pure | ✅ `robust.ts` pure, nằm trong `lib/analytics` |
| Ca lỗi / ca biên | ✅ ×100 outlier, MAD=0, <3 điểm, toàn 0, hằng số, gap = 28 vs > 28, đoạn sau gap <7 → naive, đầu vào hỏng vẫn RangeError, tab nhận có lưu (`remotePersist.test.ts`) |
| UI | ✅ thông điệp stale có ngày, có test |
| Ownership | ✅ techlead làm thay Thắng 2 (FC-10), nêu rõ trong handoff; cần review chéo |
| Handoff + log AI | ✅ `handoffs/FC-10.md`, `handoffs/TL-06d.md` |

### Lỗi phải sửa
Không có.

### Lưu ý không chặn
- `ROBUST_CONFIG` nằm trong `robust.ts`; nên chuyển sang `config/thresholds.ts` (đã ghi trong handoff).
- `forecastMetric` gọi `prepareDaily` hai lần; chi phí nhỏ, có thể gộp sau.
- Huy review `schedulePersist` trong `applyRemoteDelta`; Nhân retest BUG-QA04-01 trên deploy.
- Không chạy lại E2E Playwright; dựa vào số liệu trong handoff (crosstab 10/10).

### Điểm tốt
- Phát hiện race thứ hai (tab nhận không lưu), sửa kèm test hồi quy.
- Kiểm đầu vào trước robust nên vẫn từ chối dữ liệu hỏng.
- Dữ liệu gốc không đổi, anomaly vẫn thấy giá trị thật.
