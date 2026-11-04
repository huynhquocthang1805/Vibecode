# REVIEW DATA-08 + DATA-09 — REQUEST_CHANGES

PR #14 · nhánh `feat/data-engineer/DATA-08-DATA-09` · Reviewer: techlead (Claude)

## Vòng 1 — REQUEST_CHANGES

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ Không có lỗi chặn |
| `npm run check` | ✅ lint + typecheck xanh; Vitest 47 file, 3815 pass, 11 expected-fail, 0 fail |
| `npm run build` | ✅ xanh |
| Ownership (§4) | ✅ chỉ `lib/data/**` + handoff |
| Đúng `domain.ts` / chữ ký hợp đồng | ✅ `origin: 'live'` đã có trong `DomainEvent` |
| Không any / ts-ignore / console.log | ✅ (có 2 `console.warn` trong store.ts:140, :221 — không chặn) |
| Test ca biên | ⚠️ crossTab/simulator tốt; migration thiếu ca IndexedDB không khả dụng |
| Handoff + log AI | ✅ DATA-08, DATA-09 |

## Lỗi phải sửa

**R-01 (Cao) — `src/lib/data/storage/indexedDbAdapter.ts` (`migrateStorage` + `save`): mất dữ liệu khi IndexedDB không khả dụng.**
`save()` của adapter IndexedDB nuốt mọi lỗi (chỉ phát `degraded` và lưu vào `inMemoryBackup`), không ném. `migrateStorage` coi `to.save()` là thành công rồi gọi `from.clear()` → xoá toàn bộ dữ liệu localStorage; `migrateToIndexedDb` còn ghi `ACTIVE_STORAGE_TYPE_KEY='indexedDB'`. Kịch bản: IDB bị chặn (chế độ riêng tư…), user vượt 40.000 dòng → dữ liệu chỉ còn trong RAM, tải lại trang là mất sạch.
Cách sửa: trước `from.clear()` phải xác minh ghi thật (cho `save` chế độ strict ném lỗi khi dùng cho migrate, hoặc `to.load()` đọc lại và so số dòng/checksum). Xác minh lỗi → KHÔNG clear, KHÔNG đặt `ACTIVE_STORAGE_TYPE_KEY`, giữ adapter cũ. Thêm test: IDB không khả dụng + migrate → localStorage còn nguyên dữ liệu, `storage.kind` vẫn `localStorage`.

**R-02 (Trung bình) — `src/lib/data/store.ts` `checkAndAutoSwitchAdapter`: race với persist debounce.**
Trong lúc `await migrateToIndexedDb`, `schedulePersist` có thể ghi vào adapter cũ quanh thời điểm `from.clear()` → thay đổi mới bị mất. Cách sửa: khi `isMigrating`, hoãn persist (đánh dấu dirty) và persist lại bằng adapter mới sau khi swap. Thêm test addEntries trong lúc migrate.

**R-03 (Thấp) — `src/lib/data/realtime/liveSimulator.ts`: dùng `new Date().getHours()` (giờ máy) trong khi quy ước là `Asia/Ho_Chi_Minh`.** Dùng giờ VN qua helper trong `lib/domain/dates.ts` để đường cong ngày-đêm khớp `todayVN()`.

## Lưu ý không chặn
- Thay `console.warn` trong store.ts bằng `bus.emit({type:'system/health'…})` cho nhất quán docs/13.
- Tab nhận delta có thể còn `storage.kind` khác tab gửi sau khi tab gửi chuyển IndexedDB.
- x60 gọi `postMessage` ~60 lần/giây; cân nhắc gộp delta ở FD-07.

## Điểm tốt
- Chống echo bằng `tabId` + chặn re-broadcast `origin: 'remote'`; có fallback `storage`.
- Simulator có PRNG seed tái lập, giữ bất biến clicks ≤ reach, orders ≤ clicks; cleanup sạch.
- Test dày, handoff đầy đủ.
