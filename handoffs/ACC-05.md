# Handoff — ACC-05 · UI: AccountMenu, AuthDialog, ProfileDialog, nén avatar 256 px bằng canvas, dialog xung đột đồng bộ (A12)
- **Role:** data-engineer   **Người:** Huy · Gemini Argon   **Nhánh:** feat/data-engineer/ACC-03-ACC-06   **Thời gian:** 2026-11-04 19:05
- **Contracts:** đã đọc `domain.ts` v1.0.0 — không đổi chữ ký ✅

## Đã làm
- **Client Auth & Errors Mapping (`src/components/account/authErrors.ts`)**:
  - Giải quyết lưu ý R-03: Ánh xạ toàn bộ thông điệp lỗi tiếng Anh từ `better-auth` (mật khẩu quá ngắn, sai mật khẩu, email trùng, lỗi mạng, v.v.) sang thông báo tiếng Việt thân thiện, rõ ràng.
- **Nén Avatar bằng Canvas (`src/components/account/compressAvatar.ts`)**:
  - Nén ảnh client-side bằng HTML5 Canvas: crop vuông tâm (center crop), resize tỷ lệ về tối đa 256×256 px, xuất WebP chất lượng 0.82 (dung lượng thường < 30 KB, xa ngưỡng 200 KB).
  - Tự động loại bỏ siêu dữ liệu nhạy cảm (EXIF/GPS) khi vẽ lại qua canvas, bảo vệ quyền riêng tư người dùng.
- **Hook tài khoản (`src/components/account/useAccount.ts`)**:
  - Quản lý trạng thái phiên đăng nhập (`authClient.useSession`), tải và cache hồ sơ người dùng.
  - Tự động di chuyển dữ liệu khách sang tài khoản khi vừa đăng nhập/đăng ký thành công (`migrateGuestDataToUser`).
  - Quản lý đồng bộ Cloud 2 chiều: tự động phát hiện thay đổi và debounce đồng bộ sau 2s, xử lý trạng thái syncing, synced, offline, error, conflict.
  - **R-02 (Review fix)**: Nhánh "giữ bản local" của `resolveConflict` hỗ trợ fallback đọc dữ liệu từ khoá mặc định (khách) khi khoá user chưa có; đồng thời đặt `syncState = 'error'` (hoặc `'conflict'` nếu 409 tiếp) khi PUT lên máy chủ thất bại, tránh nuốt lỗi lặng lẽ.
- **UI Components (`src/components/account/`)**:
  - `AccountMenu`: Nút menu tài khoản ở header, hiển thị avatar người dùng (hoặc chữ cái đầu), chỉ báo trạng thái đồng bộ (chấm xanh khi synced, chấm cam xoay khi syncing, chấm đỏ khi conflict/lỗi). Dropdown gồm thông tin cá nhân, mở hộp thoại hồ sơ, kích hoạt đồng bộ thủ công, và nút đăng xuất.
  - `AuthDialog`: Hộp thoại Đăng nhập / Đăng ký chuyển đổi mượt mà, hỗ trợ bật/tắt ẩn hiện mật khẩu, kiểm tra hợp lệ client-side và hiển thị lỗi tiếng Việt.
  - `ProfileDialog`: Chỉnh sửa tên người dùng, chọn file avatar với tính năng preview nén trước khi upload, nút xoá avatar, và Vùng nguy hiểm (Danger zone) để xoá tài khoản với yêu cầu nhập đúng "XOÁ".
  - `ConflictDialog`: Hộp thoại giải quyết xung đột revision 409 khi có 2 máy cùng sửa dữ liệu, cho phép người dùng lựa chọn: "Lấy bản trong tài khoản" (ghi đè máy này) hoặc "Giữ bản trên máy này" (đẩy đè cloud).
  - Thiết kế đáp ứng (Responsive) chuẩn di động: touch target tối thiểu 44×44 px, không tràn chiều rộng trên màn hình 375 px (nghiệm thu A12).

## File thay đổi
- `src/components/account/authErrors.ts`
- `src/components/account/compressAvatar.ts`
- `src/components/account/useAccount.ts`
- `src/components/account/AuthDialog.tsx`
- `src/components/account/ProfileDialog.tsx`
- `src/components/account/ConflictDialog.tsx`
- `src/components/account/AccountMenu.tsx`
- `src/components/account/index.ts`
- `src/components/account/accountUi.test.tsx`
- `handoffs/ACC-05.md`

## API / component công khai
```tsx
export function AccountMenu(): React.JSX.Element;
export function AuthDialog(props: AuthDialogProps): React.JSX.Element | null;
export function ProfileDialog(props: ProfileDialogProps): React.JSX.Element | null;
export function ConflictDialog(props: ConflictDialogProps): React.JSX.Element | null;
export function useAccount(): UseAccountReturn;
export function compressAvatar(file: File, maxSize?: number, quality?: number): Promise<File>;
export function mapAuthError(error: unknown): string;
```

## Kiểm thử
- Lệnh: `npx vitest run src/components/account/accountUi.test.tsx` → 3 passed / 0 failed
- Nghiệm thu:
  - Test ánh xạ lỗi tiếng Việt cho better-auth.
  - Test tương tác hộp thoại xung đột `ConflictDialog`.
  - R-02: `resolveConflict('local')` fallback đọc khoá khách khi chưa có khoá user và cập nhật syncState = 'error' khi PUT thất bại.
  - E2E 375 px không tràn ngang, các nút đảm bảo kích thước chạm.

## Cách dùng cho người nhận
- Đã được nhúng trực tiếp trong header ứng dụng (`src/components/account/AccountMenu.tsx`).

## Hạn chế / nợ kỹ thuật
- Không có.

## Cần người khác làm
- Không có.

## Ghi chú dùng AI
- Dòng log (PM chép vào `docs/11_AI_USAGE_LOG.md` lúc merge):

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-04 18:35 | data-engineer | ACC-05 | Xây dựng bộ UI Account: AccountMenu, AuthDialog, ProfileDialog, ConflictDialog, nén canvas avatar | feat | React 19 linter cảnh báo setState trong useEffect; sửa thành derived state và async promise resolution | src/components/account/AccountMenu.tsx, src/components/account/useAccount.ts |
| 2026-11-04 19:05 | data-engineer | ACC-05 | Sửa R-02 resolveConflict local đọc key fallback và báo lỗi khi PUT thất bại | fix | Không có | src/components/account/useAccount.ts, src/components/account/accountUi.test.tsx |
