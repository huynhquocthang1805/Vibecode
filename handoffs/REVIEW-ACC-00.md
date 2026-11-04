# Review ACC-00 — Khung tài khoản & database (CR-005) · PR #15

## Vòng 1 — Verdict: ✅ APPROVE

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ Không có lỗi chặn (23 file, role techlead) |
| `npm run check` | ✅ lint + typecheck sạch · 48 file test, 3.820 pass · 11 expected-fail (đã có từ trước) · 0 fail |
| `npm run build` | ✅ xanh, đủ 6 route mới (ƒ dynamic), không cần DB lúc build |
| Hợp đồng `domain.ts` / `docs/10` | ✅ chỉ bổ sung (`UserProfile`, `ProfilePatch`, `CloudSnapshotMeta`, `AccountError`, `LIMITS_ACCOUNT`) + §I, không đổi kiểu hay chữ ký cũ |
| Ownership | ✅ techlead sở hữu mọi file đổi; stub ghi rõ owner Huy; `pr-guard.mjs` mở đúng đường dẫn ACC cho data-engineer |
| Change request | ✅ CR-005 ghi ở `handoffs/CHANGE_REQUESTS.md`, "duyệt có điều kiện" |
| Không `any` / `ts-ignore` / `console.log` | ✅ |
| Secret / AI từ client | ✅ `.env.example` chỉ có placeholder trống, không tiền tố `NEXT_PUBLIC_`; `accountConfig.ts` có `import 'server-only'` |
| Không làm hỏng P0 | ✅ `AccountMenu` trả `null`; thiếu env → 503 `NOT_CONFIGURED`, đủ env nhưng chưa làm → 501; không crash |
| Test ca lỗi/ca biên | ✅ `accountConfig.test.ts`: thiếu `DATABASE_URL` → 503, đủ env → 501 |
| Handoff + log AI | ✅ `handoffs/ACC-00.md` |
| `TASKS.md` | ✅ ACC-00 đã là `[x]` trong PR; không cần sửa thêm |

### Lỗi phải sửa
Không có.

### Lưu ý không chặn
1. `accountConfigured()` chỉ kiểm chuỗi có tồn tại. ACC-01/02 nên kiểm thêm độ dài tối thiểu của `BETTER_AUTH_SECRET` (≥ 32 ký tự).
2. `npm audit --omit=dev` có 4 lỗi moderate trong `drizzle-kit` (esbuild cũ, chỉ CLI dev). Handoff đã ghi nhận và chấp nhận.
3. Trước ACC-07 cần kiểm CSP `connect-src` và `img-src` cho avatar cùng origin. Nếu bật Google đăng nhập thì cần thêm domain Google.
4. `package-lock.json` đổi lớn (~5.000 dòng) do thêm thư viện. Nên rà lại khi Huy làm ACC-01.
5. Chưa có test cho 6 route stub. Có thể bỏ qua vì sẽ được thay ở ACC-02..04, nhưng ACC-06 phải phủ đủ A1–A11.

### Điểm tốt
- Hỏi chủ dự án trước khi đổi kiến trúc, rồi ghi CR-005 chính thức. Giữ nguyên tắc local-first và khách vẫn dùng đủ P0.
- `docs/14` có sẵn 12 ca nghiệm thu A1–A12 cho Huy.
- Stub 503/501 phân biệt rõ "chưa cấu hình" và "chưa làm". Build không phụ thuộc DB.
- Ranh giới ownership rõ, PR guard cập nhật cùng lúc.
