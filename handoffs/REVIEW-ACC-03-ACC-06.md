# REVIEW — ACC-03 + ACC-04 + ACC-05 + ACC-06 (PR #18) — Vòng 1 — **APPROVE**

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ không lỗi chặn |
| `npm run check` | ✅ lint + typecheck sạch; vitest 53 file, 3844 pass, 11 expected fail, 0 fail |
| `npm run build` | ✅ xanh, đủ route `/api/account/*`, `/api/auth/[...all]` (cảnh báo better-auth do build không có env — không chặn) |
| Ownership | ✅ chỉ `app/api/account/**`, `components/account/**`, `lib/server/**`, `lib/data/storage/userStorage*`, test, handoff, `drizzle/**` |
| Hợp đồng (§I) | ✅ `useAccount`, `AccountMenu`, `AuthDialog`, `ProfileDialog`; HTTP đúng docs/14 (409 CONFLICT, 413, 415, 204) |
| Không `any`/`ts-ignore`/`console.log`/`NEXT_PUBLIC` | ✅ (grep sạch) |
| Bảo mật | ✅ avatar: magic bytes, cấm SVG, ≤ 200 KB, `nosniff`, chỉ chủ xem (404 cho người khác); xoá tài khoản cần gõ "XOÁ"; server giải mã `state` trước khi lưu |
| Test ca lỗi/biên | ✅ A6 (xss, độ dài), A7 (SVG/giả mạo/quá lớn), A8 (người khác 404), A9 (409), A10 (state hỏng 400, >4 MB 413), R-01 (PUT đồng thời), A11 (cascade), `userStorage`, UI test, e2e `account.spec.ts` |
| Handoff + log AI | ✅ `handoffs/ACC-03..06.md` |

## Lỗi phải sửa
Không có.

## Lưu ý không chặn
- R-01 (Thấp) `src/app/api/account/data/route.ts:153`: `catch {}` khi insert nuốt mọi lỗi DB thành 409; nên chỉ bắt lỗi unique violation, lỗi khác trả 500.
- R-02 (Thấp) `src/app/api/account/avatar/route.ts:17`: rate limit avatar lưu bộ nhớ theo instance (giống auth) — chấp nhận ở quy mô đồ án.
- R-03 (Thấp) `avatar/route.ts`: POST/DELETE tăng `avatarVersion` không atomic; chỉ ảnh hưởng URL cache, bỏ qua được.
- `state.length` kiểm theo ký tự trước khi tính `bytes` (UTF-8); codec cột là ASCII nên sai lệch không đáng kể.
- `avatar/[userId]/route.ts` dùng mã `BAD_REQUEST`/`UNAUTHORIZED` với status 404 — nên thống nhất mã lỗi ở lần sau.

## Điểm tốt
- Optimistic locking `WHERE revision = baseRevision` có test đồng thời thật trên PGlite.
- Server không tin client: giải mã và đếm dòng từ `state`.
- Khách vẫn dùng đủ P0; thiếu cấu hình trả 503 `NOT_CONFIGURED`, build không cần DB.
