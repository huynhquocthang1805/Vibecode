# REVIEW — AI-FIX-01 · PR #24 — **APPROVE** (vòng 2; vòng 1: REQUEST_CHANGES)

## Vòng 1

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ không lỗi chặn; 2 cảnh báo ownership (`tests/e2e/g1-smoke.spec.ts`, `tests/integration/fd-review.review.test.tsx`) — chấp nhận: chỉ gỡ `test.fail`/`it.fails` của R-02/R-03 đúng chỉ dẫn |
| `npm run check` | ✅ lint + typecheck xanh; Vitest 63 file, 3933 test pass / 0 fail |
| `npm run build` | ✅ xanh |
| Hợp đồng `useInsights` (§E) | ✅ chữ ký không đổi; `_resetInflightState` là export thêm cho test |
| Không `any`/`ts-ignore`/`console.log`, không gọi AI từ client trực tiếp | ✅ |
| R-02 (E26) không gọi khi thiếu dữ liệu | ✅ `useInsights.ts` guard `isSufficient` + test |
| R-03 gộp request trùng | ✅ `inflightRequests` theo cacheKey |
| R-04 khoá effect theo cacheKey+revision | ✅ |
| Hook không throw trong render | ✅ |
| Test ca lỗi/ca biên | ❌ thiếu ca đổi cacheKey khi request đang bay |
| Handoff + log AI | ✅ `handoffs/AI-FIX-01.md` |

### Lỗi phải sửa
**R-05 (Trung bình) — `src/lib/ai/useInsights.ts`, đoạn broadcast trong `fetchInsights` (`if (subs && subs.size > 0) … else applyOutcome(outcome)`).**
Bỏ `AbortController` nhưng không thay bằng cơ chế chống kết quả cũ. Khi người dùng đổi Ngày/Tuần/Tháng (đổi cacheKey) lúc request cũ còn bay: cleanup của effect đã gỡ subscriber của key cũ → `subs` rỗng → nhánh `else` gọi `applyOutcome` của kết quả KEY CŨ lên hook đang hiển thị key mới. Nếu key mới trúng cache client thì dữ liệu đúng bị ghi đè bằng nhận xét của grain cũ (và trạng thái `loading` của key mới bị đè). Tương tự khi unmount.
Cách sửa: bỏ nhánh `else` (initiator luôn đã đăng ký subscriber trong effect trước khi fetch; `refresh()` cũng chạy khi đã subscribe), hoặc chỉ `applyOutcome` khi `cKey === cacheKeyRef.current` của hook. Phần cập nhật `lastFetched*Ref` cũng chỉ làm khi key còn hiện hành.

### Việc cần làm
1. Sửa R-05 như trên.
2. Thêm test: đổi snapshot sang grain khác (cacheKey khác) khi fetch cũ chưa resolve → sau khi resolve, `data` vẫn là của key mới (cả trường hợp key mới lấy từ cache và trường hợp fetch mới); unmount giữa chừng không setState.

### Lưu ý không chặn
- Hai hook cùng key đều chạy vòng broadcast nên `applyOutcome` bị gọi trùng — vô hại nhưng có thể để một nơi (initiator của promise) phát.
- Hook thứ hai không thấy `loading` khi hook đầu đang bay request; cân nhắc `setStatus('loading')` khi tái sử dụng promise.
- Handoff ghi "tiết kiệm 50% quota" — chỉ đúng khi 2 nơi cùng key.

### Điểm tốt
- Giải quyết đúng 3 lỗi R-02..R-04, gỡ `it.fails`/`test.fail` tương ứng, có thêm test mới.
- Effect khóa theo giá trị nguyên thuỷ, tránh vòng lặp khi snapshot đổi tham chiếu; tuân thủ lint React 19.
- Handoff rõ ràng, số liệu kiểm thử khớp kết quả chạy thật.

---

## Vòng 2 — **APPROVE**

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ không lỗi chặn; 2 cảnh báo ownership (e2e/integration) như vòng 1 — chấp nhận (chỉ gỡ `test.fail`/`it.fails`) |
| `npm run check` | ✅ lint + typecheck xanh; Vitest 63 file, 3936 test pass / 0 fail |
| `npm run build` | ✅ xanh |
| Hợp đồng `useInsights` (§E) | ✅ chữ ký không đổi |
| R-05 | ✅ bỏ nhánh `else applyOutcome`; broadcast chỉ tới subscriber còn `active` và `activeKeyRef.current === cacheKey` |
| Test ca biên R-05 | ✅ 3 test: đổi key (key mới từ cache), đổi key (fetch mới), unmount giữa chừng |
| Handoff + log AI | ✅ |

### Lưu ý không chặn
- Khi đổi key và đang tải key mới, `data` của key cũ vẫn hiển thị cùng `status: 'loading'` tới khi có kết quả; cân nhắc `setData(null)` khi đổi key nếu UI cần.
- Handoff ghi "tiết kiệm 50% quota" chỉ đúng khi 2 nơi cùng cacheKey.

### Điểm tốt
- Sửa R-05 đúng gốc, không thêm cơ chế phức tạp; test phủ đúng kịch bản race.
- Số liệu kiểm thử trong handoff khớp kết quả chạy thật.
