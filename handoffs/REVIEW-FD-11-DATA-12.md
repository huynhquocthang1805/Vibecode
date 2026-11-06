# REVIEW FD-11 + DATA-12 — PR #39 — **APPROVE**

## Vòng 1

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ không có lỗi chặn (18 file) |
| `npm run check` | ✅ lint + typecheck sạch; vitest 79 file, 4206 pass, 2 expected fail |
| `npm run build` | ✅ xanh; `/` vẫn static, API route dynamic |
| Hợp đồng `domain.ts` / chữ ký docs/10 | ✅ không đổi kiểu; `DashboardPage` chỉ thêm prop tuỳ chọn `accountsEnabled` |
| Không `any`/`ts-ignore`/`console.log`, không secret | ✅ (grep file mới) |
| Logic thuần ở `lib/` | ✅ `scenarios.ts` sinh có seed, không `new Date('YYYY-MM-DD')`, không `Math.random` |
| Dữ liệu đi qua validate | ✅ "Dùng ngay" qua `importBatch`; test validate từng dòng |
| Ca lỗi / ca biên | ✅ file lỗi 20 dòng, 50k dòng, CSV khớp tiêu đề, `expected = 0` không chia (deviation trả null), cửa sổ dự báo, guardrail `88,5%` |
| Không gọi AI từ client; ECharts lazy | ✅ không đổi |
| P0 không hỏng, khách vẫn dùng localStorage | ✅ ẩn AccountMenu khi server chưa bật (đúng docs/14 §1.2) |
| UI rỗng/mobile | ✅ dải "Bắt đầu nhanh" khi trống, thanh công cụ 2 hàng, nút ≥ 44px (theo handoff, có test DashboardShell) |
| Handoff + log AI | ✅ `handoffs/FD-11-DATA-12.md` |

## Lỗi phải sửa
Không có.

## Lưu ý không chặn
1. Ownership: PR do techlead sửa file của frontend-dashboard / frontend-input / ai-engineer (`guardrails.ts`) theo yêu cầu chủ dự án. Handoff đã giao Trường review giao diện, Hoàng Anh review câu cảnh báo guardrail — nên làm sau merge.
2. `page.tsx` prerender lúc build → đổi `DATABASE_URL`/`BETTER_AUTH_SECRET` trên Vercel phải Redeploy (đã ghi chú trong code).
3. `AnomalyFeed.tsx`: thụt lề khối fragment `<>…</>` lệch so với quy ước (lint không bắt) — nên chạy prettier ở lần sửa sau.
4. `DATA-FIX-04` (tên trường tiếng Anh trong lỗi nhập liệu) được thêm vào TASKS cho Huy — đúng hướng.
5. Số liệu E2E 44/44 trong handoff là do tác giả tự chạy, reviewer chưa chạy lại Playwright.

## Điểm tốt
- Soi UI bằng ảnh thật (desktop/mobile, sáng/tối), liệt kê rõ vấn đề → cách sửa.
- Log kiểm định AI được viết lại thành câu người đọc hiểu, bỏ số thô.
- Bộ 8 tình huống test có "Kỳ vọng" và test khẳng định đúng câu chuyện dữ liệu; có cả tải CSV để thử luồng Import.
- Hết lỗi 503 console cho khách.
