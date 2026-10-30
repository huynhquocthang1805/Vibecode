---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "tests/**"
---

# Quy tắc viết test
- Tên test tiếng Việt mô tả hành vi: `it('trả null khi số đơn = 0', ...)`.
- Mỗi hàm: ≥ 1 happy path + các ca biên liên quan trong `edge-cases.json` + ít nhất 1 nhánh lỗi.
- Không phụ thuộc giờ máy: truyền `today` cố định hoặc `vi.setSystemTime`.
- Dữ liệu ngẫu nhiên phải có seed; property test dùng fast-check `numRuns: 200`.
- E2E dùng `data-testid`, không dùng selector theo text dễ đổi; AI dùng `AI_PROVIDER=stub`.
- Không sửa code nguồn để test qua — mở bug.
