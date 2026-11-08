# Checklist nộp bài (PM-07)

Owner: pm-release. Đánh dấu ngay trước khi nộp; mỗi dòng có bằng chứng kiểm được. Cập nhật 2026-11-08.
`[x]` đã có bằng chứng · `[ ]` còn phải làm (ghi người làm).

## 1. Sản phẩm chạy online
- [x] Link deploy mở được ở cửa sổ ẩn danh: https://vibecode-three-xi.vercel.app
- [x] 5 tính năng P0 chạy trên deploy — e2e trên deploy 50/52 (2026-11-08) (2 ca `account.spec` A1 lỗi do môi trường chạy test, không phải sản phẩm), `crosstab.spec` 6/6 (handoffs/REVIEW-QA04-FC10.md)
- [ ] **AI thật trả lời trên deploy** (rubric: mock tối đa 4/15) — đang chẩn đoán lỗi Gemini (AI-FIX-03); kiểm bằng `POST /api/insights`, xem `model` bắt đầu bằng `gemini-` · Thắng + Claude
- [x] Tài khoản + database chạy trên deploy: `/api/account/profile` 401 khi chưa đăng nhập, đăng nhập sai trả `INVALID_EMAIL_OR_PASSWORD` (đã tra DB)
- [ ] Thử tay trên điện thoại thật: nhập 3 ngày → Phân tích → Xuất báo cáo → Sao chép → dán Zalo (G1) · Thắng
- [x] Khách không đăng nhập vẫn dùng đủ P0; key AI chỉ ở server (QA-07 grep bundle, `tests/integration/security-bundle.ts`)

## 2. Mã nguồn
- [x] Repo: https://github.com/huynhquocthang1805/Vibecode — `main` CI xanh (lint, typecheck, ≈ 4.260 test, build, e2e)
- [x] Không commit secret: `.env.local` trong `.gitignore`, chỉ có `.env.example`
- [x] README: cài đặt, biến môi trường, lệnh, kiến trúc, bộ dữ liệu test, bằng chứng (`README.md`)
- [x] Thư mục `.claude/`: 9 agent, 5 rules, 4 skills, 8 commands, hooks

## 3. Tài liệu chứng minh (rubric)
| Tiêu chí | Tài liệu | Trạng thái |
|---|---|---|
| Chức năng & nghiệp vụ (25) | `docs/03_KPI_RULES.md`, `src/fixtures/edge-cases.json`, `docs/test-report.md` | [x] |
| Kỹ thuật & chất lượng mã (20) | `docs/01_ARCHITECTURE.md`, `docs/10_CONTRACTS.md`, `docs/13_SCALE_RESILIENCE.md`, `docs/perf-report.md`, `docs/forecast-validation.md` | [x] |
| AI & kiểm soát đầu ra (15) | `docs/05_AI_SPEC.md`, `docs/ai-eval-report.md` | [ ] eval với **Gemini thật** (AI-10) — còn là mock |
| Kiểm thử & ổn định (15) | `docs/08_TEST_PLAN.md`, `docs/test-report.md`, `docs/bugs.md`, `docs/qa08-chaos-plan.md` | [x] |
| Vibe coding & phản biện (15) | `docs/11_AI_USAGE_LOG.md` (99 dòng, 10 ca AI sai), `docs/QA_DEFENSE.md` (24 câu), `TEAM.md`, `.claude/` | [x] |
| Giao diện (5) | `docs/06_UI_SPEC.md`, ảnh `docs/screens/` (desktop + 375px) | [x] |
| Triển khai & bàn giao (5) | Link deploy, README, video | [ ] video |

## 4. Video & slide
- [ ] Quay video theo `docs/12_DEMO_SCRIPT.md` mục A (~5 phút, đúng thời lượng ban tổ chức) · Thắng
- [ ] Slide 8 trang theo `docs/12_DEMO_SCRIPT.md` mục B · Thắng
- [ ] Chạy smoke mục C ngay trước khi quay

## 5. Ngay trước khi nộp
- [ ] `TASKS.md` và `docs/STATUS.md` cập nhật ngày nộp
- [ ] Bug còn mở trong `docs/bugs.md` có ghi rõ lý do và ảnh hưởng — hiện: **7 major QA-08** (DATA-FIX-05, DATA-PERF-01 · Huy), BUG-QA03-01 (AI-FIX-02 · Hoàng Anh), QA05-01..03 và QA08-07 (minor)
- [ ] Đúng định dạng nộp của ban tổ chức (link repo + link deploy + video + slide)
