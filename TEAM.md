# TEAM — Phân công 6 tài khoản (5 người), quy trình PR tự động & câu lệnh cho AI

> Owner: `techlead` + `pm-release` (Thắng + Claude). Thành viên đọc file này **trước** khi ra lệnh cho AI.
> Luật kỹ thuật chung vẫn ở `CLAUDE.md`. File này trả lời: *ai làm gì, làm trên nhánh nào, gõ lệnh gì cho AI, nộp bài cho techlead ra sao.*

## 1. Đội & phân vai

| Người | Công cụ AI | Vai (role trong `.claude/agents/`) | Phạm vi một câu | Số task (P0) |
|---|---|---|---|---|
| **Thắng** (chủ dự án) | **Claude** (+ ChatGPT để review chéo) | `techlead` + `pm-release` | Khởi tạo repo, hợp đồng, stub, CI, **review & merge mọi PR**, gate G1–G3, TASKS/STATUS, README, deploy, log AI, demo | 15 (14) |
| **Huy** | Gemini · Argon | `data-engineer` | \"Động cơ dữ liệu\" + **tài khoản & database** (CR-005): validation, KPI, lưu trữ, store, rollup, worker, CSV, realtime **và** đăng nhập/đăng xuất, hồ sơ, avatar, Postgres, đồng bộ (docs/14) | 12 (6) |
| **Hoàng Anh** | Gemini · Argon | `ai-engineer` (+ FC-07, FC-08) | Tích hợp AI thật (Gemini): `/api/insights`, adapter, guardrails, fallback, hook `useInsights`, eval AI **và** phát hiện bất thường, pacing | 10 (7) |
| **Trường** | ChatGPT · Astral | `frontend-dashboard` + `frontend-input` | Toàn bộ giao diện: dashboard, thẻ KPI, biểu đồ, card AI, nút xuất **và** form nhập, bảng, import (UI đã làm local — cần push ngay) | 17 (8) |
| **Thắng 2** (tài khoản thứ 2 của Thắng) | Claude (tài khoản 2) | `forecast-engineer` (+ AI-08) | Phần phía sau: mô hình dự báo baseline/Holt/Holt-Winters, backtest, khoảng tin cậy, nowcast tháng/quý, dự báo bền vững **và** `buildReport` + `copyText` | 9 (1) |
| **Nhân** | ChatGPT · Astral | `ba-analyst` + `qa-engineer` | Nghiệp vụ & chất lượng: công thức + ca biên, ngưỡng, prompt, mẫu báo cáo, mock data **và** test ca biên, E2E, perf, stress/chaos, bảo mật | 16 (6 + 3 P0*) |

Dữ liệu lớn, chống phình và xử lý lỗi là yêu cầu chung của mọi người: đọc **`docs/13_SCALE_RESILIENCE.md`** trước khi làm task có chữ "docs/13"; giới hạn chỉ lấy từ `LIMITS` trong `src/types/domain.ts`.

Lý do chia như vậy:
- **Tải P0 cân bằng** (5–8 task/người) để kịp Gate G1; phần P1 nặng của Huy (dự báo) có thể cắt/chuyển nếu trễ (xem §7).
- **Hoàng Anh dùng Gemini → làm phần gọi Gemini API**: tự thử structured output trên chính công cụ mình dùng.
- **Thắng 2 (thêm 2026-11-03) làm phần phía sau:** UI/UX (dashboard + nhập liệu) Trường đã làm xong ở máy, chỉ chưa push → giữ nguyên cho Trường. Thắng 2 nhận **toàn bộ dự báo P1** từ Huy (Huy đang nặng nhất, giờ tập trung DATA-05-lite đang chặn G1 rồi big data) + **AI-08** từ Hoàng Anh (để Hoàng Anh tập trung luồng Gemini). Thư mục `lib/analytics/models/**`, `forecast.ts`, `nowcast.ts` chưa ai đụng → không xung đột.
- PR của Thắng 2 vẫn qua Claude review tự động + CI như mọi người; nên nhờ ChatGPT review chéo vì cùng một người với techlead.
- **Nhân viết quy tắc rồi tự viết test cho quy tắc đó** (BA-01 ca biên → QA-01 test) → không lệch giữa spec và test.
- **Huy giữ toàn bộ `lib/`** (data + analytics) → worker host và hàm dự báo do cùng một người, ít change request. Riêng `anomaly.ts`, `pacing.ts` (P2) chuyển cho Hoàng Anh để cân tải sau khi thêm DATA-10/11, FC-10.

## 2. Mỗi người được sửa file nào (ownership)

Chi tiết từng role: `.claude/agents/<role>.md` → mục "Bạn sở hữu". Tóm tắt theo người:

| Người | Được sửa | KHÔNG được sửa |
|---|---|---|
| Thắng + Claude | `CLAUDE.md`, `TEAM.md`, `AGENTS.md`, `GEMINI.md`, `TASKS.md`, `README.md`, `src/types/domain.ts`, `docs/13`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/ui/**`, config gốc (`package.json`, `tsconfig.json`, eslint, vitest, playwright, next), `.github/**`, `.claude/**`, `docs/00,01,09,10,11,12`, `docs/STATUS.md`, `docs/QA_DEFENSE.md`, `handoffs/CHANGE_REQUESTS.md`, `handoffs/GATE-*.md` | — (nhưng không viết logic nghiệp vụ thay owner) |
| Huy | `src/lib/domain/**`, `src/lib/data/**`, `src/lib/workers/**`, `docs/02` + tài khoản: `src/lib/server/**`, `src/lib/auth-client.ts`, `src/app/api/auth/**`, `src/app/api/account/**`, `src/components/account/**`, `drizzle/**`, `tests/e2e/account.spec.ts` | UI, `lib/analytics/**` (Thắng 2, Hoàng Anh), `lib/ai`, `config`, `fixtures`, `domain.ts` |
| Hoàng Anh | `src/app/api/insights/**`, `src/lib/ai/**` (trừ `prompts/`), `src/lib/analytics/anomaly.ts`, `src/lib/analytics/pacing.ts`, `scripts/eval-ai.ts`, `docs/05` (trừ §4, §7), `docs/ai-eval-report.md` | `lib/ai/prompts/**`, `config/**` (của Nhân), `lib/report/**` |
| Trường | `src/components/dashboard/**`, `src/components/input/**`, `docs/06` | `components/ui/**` (shadcn — nhờ techlead generate), `app/page.tsx` |
| Thắng 2 | `src/lib/analytics/**` (trừ `anomaly.ts`, `pacing.ts` của Hoàng Anh), `docs/04`, `docs/forecast-validation.md`, `src/lib/report/buildReport.ts`, `src/lib/report/clipboard.ts` (+ test cạnh file) | UI, `lib/data/**` (Huy), `lib/report/templates.ts` (Nhân) |
| Nhân | `src/config/**`, `src/lib/ai/prompts/**`, `src/lib/report/templates.ts`, `src/fixtures/**`, `scripts/gen-mock.ts`, `docs/03`, `docs/07`, `docs/05` §4 §7, `tests/integration/**`, `tests/e2e/**`, `tests/perf/**`, `docs/08`, `docs/test-report.md`, `docs/perf-report.md`, `docs/bugs.md` | code trong `src/lib/**` ngoài phần trên |

Mọi người: được tạo **`handoffs/<TASK-ID>.md` của task mình** và test `*.test.ts(x)` cạnh file mình sở hữu.
Cần đổi file người khác → ghi ở mục "Cần người khác làm" trong handoff + mô tả PR. Techlead chuyển vào `handoffs/CHANGE_REQUESTS.md`. **Không tự sửa.**

## 3. Mô hình nhánh

```
main  ←──── chỉ techlead (Thắng + Claude) merge, qua Pull Request, squash merge
 ├── feat/data-engineer/DATA-01        (Huy)
 ├── feat/ai-engineer/AI-01            (Hoàng Anh)
 ├── feat/frontend-dashboard/FD-01     (Trường)
 ├── feat/frontend-input/FI-01         (Trường)
 ├── feat/forecast-engineer/FC-02      (Thắng 2)
 ├── feat/forecast-engineer/AI-08      (Thắng 2 — AI-08 đi nhánh role forecast-engineer)
 ├── feat/ba-analyst/BA-01             (Nhân)
 ├── feat/qa-engineer/QA-01            (Nhân)
 └── feat/techlead/TL-01 …             (Thắng + Claude)
```

Quy tắc:
1. **1 task = 1 nhánh = 1 PR.** Tên nhánh: `feat/<role>/<TASK-ID>`. Được gộp task nhỏ cùng role: `feat/ai-engineer/AI-01-AI-03`.
2. Luôn tạo nhánh **từ `main` mới nhất**. Không tạo nhánh từ nhánh của người khác.
3. **Không ai push lên `main`**, không `push --force` lên nhánh người khác, không tự merge PR của mình.
4. Sửa theo review → commit thêm vào **cùng nhánh** (PR tự cập nhật). Không mở PR mới.
5. Sau khi PR được merge: xoá nhánh, quay về `main`, `git pull`, tạo nhánh mới cho task tiếp theo.
6. Commit message: `feat(DATA-01): validateEntry + Zod schema` · `fix(FD-02): ...` · `test(QA-01): ...` · `docs(BA-01): ...`.

### Lần đầu (mỗi thành viên làm 1 lần)
Cần Node 22 + Git. Repo đã có khung chạy được (TL-01..04 xong).
```bash
git clone https://github.com/huynhquocthang1805/Vibecode.git
```
```bash
cd Vibecode
```
```bash
npm ci
```
```bash
npm run dev
```
Mở http://localhost:3000 → thấy trang "KPI Mini" với các khu tạm có mã task (FD-02, FI-01…). Khu nào mang mã task của bạn là chỗ bạn thay bằng code thật.
Hàm chưa làm đều là stub ném `NOT_IMPLEMENTED: <TASK-ID>` — tìm việc của mình: `grep -rn "NOT_IMPLEMENTED: DATA-01" src` (đổi mã task).
**Next.js 16 khác kiến thức cũ của AI** → luôn bảo AI đọc `AGENTS.md` và `node_modules/next/dist/docs/` trước khi viết code Next.

### Lệnh git cho thành viên (copy theo thứ tự)

Bắt đầu task:
```bash
git switch main
```
```bash
git pull origin main
```
```bash
git switch -c feat/<role>/<TASK-ID>
```

Trước khi gửi PR (cập nhật code mới nhất của đội, chạy kiểm tra):
```bash
git fetch origin
```
```bash
git rebase origin/main
```
```bash
npm run check
```

Gửi bài:
```bash
git push -u origin feat/<role>/<TASK-ID>
```
Rồi mở Pull Request **vào `main`** trên GitHub, điền theo mẫu (tự hiện từ `.github/pull_request_template.md`).
- Đang làm dở → mở **Draft PR** (= báo nhận task; Claude chưa review).
- Xong → bấm **Ready for review** → tự động chạy §3.1.

### 3.1 Điều gì xảy ra sau khi mở PR (tự động)
| Bước | Ai/Cái gì | Kết quả |
|---|---|---|
| 1 | **CI** (`ci.yml`) | `PR guard` (tên nhánh, quyền sở hữu file, có handoff, không sửa file dùng chung) + `lint · typecheck · test · build` + e2e |
| 2 | **Claude review** (`claude-review.yml`) | Đọc diff theo `.claude/commands/review.md`, chạy `npm run check` + `build`, ghi **`handoffs/REVIEW-<TASK-ID>.md`** vào nhánh PR, đăng biên bản lên PR (bình luận ghim, sửa lại mỗi vòng) |
| 3a | Verdict **APPROVE** | Nhãn `claude-approved`, `TASKS.md` đánh `[x]` (trong chính PR), bật **auto-merge squash** → GitHub merge khi check xanh + Thắng bấm Approve → **nhánh tự xoá** |
| 3b | Verdict **REQUEST_CHANGES** | Nhãn `changes-requested` + danh sách việc đánh số (R-01…). Bạn sửa trên **cùng nhánh** rồi push → Claude review lại, thêm "Vòng 2" vào biên bản |
| — | Muốn hỏi/nhờ Claude | Bình luận trong PR có `@claude …` (VD `@claude vì sao R-02 sai?`) |

Sau khi PR đã merge: `git switch main && git pull origin main`, xoá nhánh local (`git branch -d feat/<role>/<TASK-ID>`), tạo nhánh mới cho task sau.

Rebase bị xung đột? Chỉ giải quyết trong file **của mình**. Xung đột ở file người khác → `git rebase --abort` và nhắn techlead.

## 4. Quy tắc chống xung đột khi 5 người cùng làm

| Việc | Ai làm | Ở đâu |
|---|---|---|
| Nhận task (`[ ]` → `[~]`) | Thành viên mở **Draft PR** sớm (hoặc nhắn nhóm); PM (Claude) cập nhật | `TASKS.md` trên `main` |
| Đánh xong (`[~]` → `[x]`) | **Claude review bot** khi APPROVE (đi cùng PR) | `TASKS.md` |
| Biên bản review | **Claude review bot** | `handoffs/REVIEW-<TASK-ID>.md` (đi cùng PR) |
| Ghi nhật ký dùng AI | Thành viên ghi trong **handoff** (mục "Ghi chú dùng AI"); PM gom vào log lúc merge | `docs/11_AI_USAGE_LOG.md` |
| Change request | Thành viên ghi trong handoff + PR; techlead chép vào | `handoffs/CHANGE_REQUESTS.md` |
| Bàn giao | Thành viên | `handoffs/<TASK-ID>.md` (file riêng, không bao giờ xung đột) |

→ Thành viên **KHÔNG sửa** `TASKS.md`, `docs/11_AI_USAGE_LOG.md`, `handoffs/CHANGE_REQUESTS.md`, `CLAUDE.md` trên nhánh của mình. Đây là 3–4 file ai cũng muốn sửa → nguồn xung đột số 1.

## 5. Lịch theo người (chi tiết mốc: `docs/09_TIMELINE.md`)

> **Từ 2026-11-03:** Hoàng Anh bỏ AI-08; Huy bỏ FC-02..06, FC-09, FC-10 → chuyển sang **Thắng 2: AI-08 (P0, làm ngay) → FC-02 → FC-03 → FC-04 → FC-10 → FC-05 → FC-06 → FC-09 (P1)**. Trường giữ toàn bộ FD-* + FI-* (đã làm local, push ngay).

| Wave | Thắng + Claude | Huy (Gemini) | Hoàng Anh (Gemini) | Trường (ChatGPT) | Nhân (ChatGPT) |
|---|---|---|---|---|---|
| **W0** khởi tạo | TL-01 → TL-02 → TL-03 → TL-04 | Đọc `docs/02,03,04,10` + skill `big-data-frontend`, `time-series-forecasting`; chờ TL-03 | Lấy Gemini API key (chỉ đưa cho Thắng đặt vào Vercel/`.env.local`); đọc `docs/05` + skill `llm-structured-output` | Đọc `docs/06`, phác layout 375px/desktop; chờ TL-03 | **BA-01** (ngay) → **BA-05** (sau TL-01) |
| **W1** P0 | TL-05 review liên tục, PM-01 | DATA-01 → DATA-02 → DATA-03 → DATA-04 → FC-01 | AI-01 → AI-03 → AI-02 → AI-07 → AI-04 → AI-05 → AI-06 → AI-08 | FD-01 → FD-02 → FD-03 → FI-01 → FI-02 → FI-05 → FD-05 → FD-06 | BA-02 → BA-03 → BA-04 → QA-01 |
| **W3** | **TL-06 tích hợp + Gate G1** | sửa bug G1 | sửa bug G1 | sửa bug G1 | test tay G1 |
| **W4** P1 | TL-07 + **Gate G2**, PM-06 | DATA-05 → DATA-06 → DATA-11 → DATA-07 → FC-02 → FC-03 → FC-04 → FC-10 → FC-05 → FC-06 → DATA-10 → FC-09 | AI-09 (sau BA-06) | FI-02b → FI-03 → FI-07 → FI-04 → FI-06 → FD-04 → FD-09 | BA-06 → BA-07 → BA-08 → QA-02 → QA-03 → QA-05 → QA-08 |
| **W5** P2 + release | TL-08 + **Gate G3**, PM-02..07 | DATA-08 → DATA-09 | FC-07 → FC-08 | FD-07 → FD-08 | QA-04 → QA-06 → QA-07 |

## 6. Câu lệnh cho AI (copy–paste)

Gemini Argon và ChatGPT Astral **không chạy được** hook/slash command của Claude Code, nên lệnh `/kickoff`, `/check`, `/handoff` phải viết bằng chữ như dưới. Thay `<…>` trước khi gửi.
Nếu công cụ chỉ là khung chat (không đọc được repo): đính kèm các file được nhắc trong prompt rồi dán code AI trả về vào đúng file.

### 6.1 Prompt mở đầu (gửi 1 lần mỗi phiên)
```
Bạn là trợ lý code của <TÊN> trong dự án "Dashboard KPI Chiến dịch Mini" (Next.js + TypeScript strict).
Tôi giữ vai: <ROLE_1> [+ <ROLE_2>]. Techlead là Thắng (dùng Claude) — chỉ techlead merge vào main.

Đọc theo thứ tự rồi tóm tắt lại cho tôi trong 5 dòng phạm vi của tôi:
1. CLAUDE.md  2. TEAM.md  3. AGENTS.md  4. .claude/agents/<ROLE_1>.md [và .claude/agents/<ROLE_2>.md]
5. TASKS.md  6. src/types/domain.ts  7. docs/10_CONTRACTS.md

Luật bắt buộc:
- Chỉ sửa file thuộc quyền sở hữu của tôi (TEAM.md §2). Không đổi chữ ký hàm trong docs/10_CONTRACTS.md, không sửa src/types/domain.ts.
- Không sửa TASKS.md, docs/11_AI_USAGE_LOG.md, handoffs/CHANGE_REQUESTS.md, CLAUDE.md.
- Không `any`, không `@ts-ignore`, không `console.log`. Chia qua safeDiv. KPI tổng = tỉ số của tổng. Ngày dùng helper lib/domain/dates.ts.
- Không đọc/in file .env*. Không gọi AI từ client.
- Không push lên main, không force push.
Chưa viết code — chờ tôi giao task.
```

### 6.2 Giao task
```
Làm task <TASK-ID> (role <ROLE>). Làm theo .claude/commands/kickoff.md:
1. Đọc mục <TASK-ID> trong .claude/agents/<ROLE>.md, các docs được nhắc, và handoffs/ của task phụ thuộc (xem cột "Phụ thuộc" trong TASKS.md).
   Phụ thuộc chưa xong → dùng stub/fixture, ghi rõ giả định.
2. Cho tôi xem kế hoạch ≤ 10 gạch đầu dòng: file sẽ tạo/sửa (chỉ file của tôi), hàm/component, test sẽ viết, rủi ro. CHỜ tôi đồng ý.
3. Sau khi tôi đồng ý: viết code + test cùng lúc (test phải có ca lỗi/ca biên, không chỉ happy path).
4. Đưa tôi lệnh để chạy: npm run check
```

### 6.3 Khi lệnh kiểm tra báo lỗi
```
Đây là output lỗi:
<dán output>
Chỉ sửa lỗi nằm trong file tôi sở hữu. Lỗi ở file người khác: KHÔNG sửa, viết cho tôi 1 dòng change request (file, lỗi, đề xuất) để tôi ghi vào handoff.
```

### 6.4 Kết thúc task
```
Task <TASK-ID> đã xanh. Làm theo .claude/commands/handoff.md (bản dành cho thành viên):
1. Tạo handoffs/<TASK-ID>.md theo handoffs/_TEMPLATE.md, điền đủ mọi mục, gồm "Ghi chú dùng AI": prompt chính, chỗ bạn (AI) đã sai và tôi phát hiện thế nào.
2. Viết commit message dạng: feat(<TASK-ID>): <mô tả ngắn>
3. Viết nội dung PR theo .github/pull_request_template.md.
Không sửa TASKS.md và docs/11_AI_USAGE_LOG.md — PM sẽ cập nhật khi merge.
```

### 6.5 Sửa theo review của techlead
```
Techlead REQUEST CHANGES cho PR <TASK-ID>:
<dán danh sách nhận xét>
Sửa từng mục theo đúng số thứ tự, chỉ trong file của tôi. Mục nào bạn thấy không đúng → giải thích, không tự ý bỏ qua.
Cập nhật mục "Hạn chế / nợ kỹ thuật" trong handoff nếu có thay đổi.
```

### 6.6 Prompt mở đầu đã điền sẵn

**Huy (Gemini Argon)** — `<TÊN>`=Huy, `<ROLE_1>`=`data-engineer` (từ 2026-11-03 không giữ forecast nữa). **Tài khoản & database (ACC-01..06):** giao task `ACC-01` → … → `ACC-06`, nhánh `feat/data-engineer/ACC-01` (có thể gộp `ACC-01-ACC-02`); đọc kỹ `docs/14_ACCOUNTS_DB.md` + mục cuối `.claude/agents/data-engineer.md`; test integration chạy thật trên PGlite (`DATABASE_URL=pglite://memory`). Task đầu: `DATA-01`. Đọc kỹ `docs/13_SCALE_RESILIENCE.md` (phần lớn là của Huy). Đọc thêm skill `.claude/skills/big-data-frontend/SKILL.md`, `.claude/skills/kpi-metrics/SKILL.md`, `.claude/skills/time-series-forecasting/SKILL.md`, rule `.claude/rules/data-layer.md`, `.claude/rules/analytics.md`.

**Hoàng Anh (Gemini Argon)** — `<ROLE_1>`=`ai-engineer`. Task đầu: `AI-01`. Đọc thêm `.claude/skills/llm-structured-output/SKILL.md`, `.claude/rules/ai-api.md`, `docs/05_AI_SPEC.md`. Prompt (`lib/ai/prompts/**`) là của Nhân — cần đổi thì change request.

**Trường (ChatGPT Astral)** — `<ROLE_1>`=`frontend-dashboard`, `<ROLE_2>`=`frontend-input`. UI đã làm ở máy → **push ngay** theo task: `feat/frontend-dashboard/FD-01…` và `feat/frontend-input/FI-01…` (mỗi task 1 PR, hoặc gộp task cùng role: `feat/frontend-input/FI-01-FI-02-FI-05`). Đọc thêm `.claude/rules/ui.md`, `docs/06_UI_SPEC.md`, `.claude/skills/big-data-frontend/SKILL.md`. Cần component shadcn mới → nhờ techlead thêm vào `components/ui/`.

**Thắng 2 (Claude, tài khoản 2)** — Claude Code đọc `CLAUDE.md` tự động và có sẵn subagent + slash command. Thứ tự: `/kickoff forecast-engineer AI-08` (đặc tả AI-08 ở `.claude/agents/ai-engineer.md`, cần `TEMPLATES` của BA-04 — chưa có thì viết với template tạm trong test) → `/kickoff forecast-engineer FC-02` → FC-03 → FC-04 → FC-10 → FC-05 → FC-06 → FC-09. Nhánh `feat/forecast-engineer/<TASK-ID>`. Đọc thêm `docs/04_FORECAST_SPEC.md`, `docs/13` §5, skill `.claude/skills/time-series-forecasting/SKILL.md`, rule `.claude/rules/analytics.md`. Dữ liệu thử: `src/fixtures/campaign-2y.json` (BA-05). FC-01 (`trend.ts`) Huy đã làm — góp ý slope ở REVIEW-BA-03 RISK-05 giờ thuộc Thắng 2.

**Nhân (ChatGPT Astral)** — `<ROLE_1>`=`ba-analyst`, `<ROLE_2>`=`qa-engineer`. Task đầu: `BA-01` (làm được ngay, không chờ ai). Đọc thêm `.claude/skills/kpi-metrics/SKILL.md`, `.claude/rules/tests.md`, `docs/03_KPI_RULES.md`, `docs/08_TEST_PLAN.md`.

## 7. Quy trình merge của techlead (Thắng + Claude)

1. Thành viên mở PR (Ready for review) → **Claude review bot tự chạy** (§3.1). Thắng chỉ cần đọc biên bản trên PR.
2. Bot **APPROVE** → Thắng bấm **Approve** trên GitHub → auto-merge squash khi check xanh → nhánh tự xoá (`pr-cleanup.yml` dự phòng). Thắng không đồng ý bot → bình luận lý do + `@claude` hoặc tắt auto-merge.
3. Bot **REQUEST_CHANGES** → người làm sửa và push; bot review lại. Thắng có thể ghi đè bằng cách approve + merge tay (ghi lý do trong PR).
4. Định kỳ (mỗi buổi), Claude (vai PM, phiên Claude Code) gom dòng log AI từ handoff vào `docs/11_AI_USAGE_LOG.md`, xử lý change request, cập nhật `docs/STATUS.md`. Có thể nhờ ChatGPT review chéo PR do Claude/Thắng 2 viết (điểm "phản biện").
4. Nhắn nhóm: "đã merge <TASK-ID>, ai đang làm nhánh phụ thuộc thì `git fetch && git rebase origin/main`".
5. **Thứ tự merge P0** (TL-06): TL-* → BA-01/BA-05 → DATA-01..04 → FI-01/02/05 → FC-01 → BA-02..04 → AI-* → FD-* → QA-01.
6. Cân lại tải: task `[~]` quá 3 giờ không có PR → đánh `[!]`, hỏi lý do. Huy trễ ở P1 → cắt DATA-09, rồi DATA-10 (giữ bản 1 key của DATA-03) trước; hoặc chuyển nhóm task P2 (cả thư mục, không chia đôi file) sang Hoàng Anh — techlead ghi rõ trong `TASKS.md` cột "Người".

## 8. Thiết lập GitHub (Thắng làm 1 lần)
1. Settings → Collaborators: mời Huy, Hoàng Anh, Trường, Nhân **và tài khoản Thắng 2** (quyền **Write**).
2. Settings → Branches → Branch protection cho `main`:
   - *Require a pull request before merging* → *Require approvals: 1* (Thắng bấm Approve).
   - *Require status checks to pass*: chọn **`lint · typecheck · test · build`** và **`PR guard`** (hiện sau lần CI đầu tiên trên PR). **Bắt buộc** — thiếu bước này thì auto-merge sẽ merge ngay khi bot APPROVE mà không chờ CI.
   - *Allow specified actors to bypass*: chỉ tài khoản Thắng (để phiên Claude techlead đẩy cập nhật PM/docs). Không cho bypass Thắng 2.
3. Settings → General → Pull Requests: bật *Allow squash merging*, **Allow auto-merge**, *Automatically delete head branches*.
4. Settings → Actions → General → Workflow permissions: **Read and write permissions** (bot commit biên bản review vào nhánh PR + gắn nhãn).
5. Settings → Secrets and variables → Actions → New repository secret: **`CLAUDE_CODE_OAUTH_TOKEN`** (trên máy có Claude Code chạy `claude setup-token`, dán token) — hoặc **`ANTHROPIC_API_KEY`** (tên khác như `BOT_CHECK` cũng được — workflow tự nhận loại theo tiền tố `sk-ant-oat…` / `sk-ant-api…`). Không có secret này thì job Claude review báo lỗi, CI vẫn chạy bình thường.
6. API key AI: chỉ Thắng giữ, đặt ở Vercel Environment Variables. Thành viên test local dùng provider `stub` hoặc key cá nhân trong `.env.local` (không commit).
