#!/usr/bin/env node
/**
 * PR guard (techlead) — kiểm nhanh, không cần AI, chạy trong CI cho mọi PR vào main.
 *   node scripts/pr-guard.mjs <branch> [base=origin/main]
 * Lỗi (exit 1): tên nhánh sai mẫu, sửa file dùng chung/hợp đồng, thiếu handoff.
 * Cảnh báo (exit 0): file ngoài phạm vi sở hữu của người giữ role.
 * Nguồn sự thật: CLAUDE.md §4 + TEAM.md §1–§2 — đổi phân công thì sửa bảng dưới cùng lúc.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const [branch, base = 'origin/main', head = 'HEAD'] = process.argv.slice(2);
if (!branch) {
  console.error('Dùng: node scripts/pr-guard.mjs <branch> [base]');
  process.exit(2);
}

/** Người → các role họ giữ (TEAM.md §1) */
const PEOPLE = {
  'Thắng (techlead)': ['techlead', 'pm-release'],
  Huy: ['data-engineer', 'forecast-engineer'],
  'Hoàng Anh': ['ai-engineer'],
  Trường: ['frontend-dashboard'],
  'Thắng 2': ['frontend-input'],
  Nhân: ['ba-analyst', 'qa-engineer'],
};

/** Role → đường dẫn được sửa (CLAUDE.md §4). Chuỗi kết thúc bằng '/' = cả thư mục. */
const OWNED = {
  techlead: ['*'],
  'pm-release': ['*'],
  'data-engineer': ['src/lib/domain/', 'src/lib/data/', 'src/lib/workers/', 'docs/02_DATA_SCHEMA.md'],
  'forecast-engineer': ['src/lib/analytics/', 'docs/04_FORECAST_SPEC.md', 'docs/forecast-validation.md'],
  'ai-engineer': [
    'src/app/api/insights/',
    'src/lib/ai/',
    'src/lib/analytics/anomaly.ts',
    'src/lib/analytics/anomaly.test.ts',
    'src/lib/analytics/pacing.ts',
    'src/lib/analytics/pacing.test.ts',
    'scripts/eval-ai.ts',
    'docs/05_AI_SPEC.md',
    'docs/ai-eval-report.md',
  ],
  'frontend-dashboard': ['src/components/dashboard/', 'docs/06_UI_SPEC.md', 'docs/screens/'],
  'frontend-input': [
    'src/components/input/',
    'src/lib/report/buildReport.ts',
    'src/lib/report/buildReport.test.ts',
    'src/lib/report/clipboard.ts',
    'src/lib/report/clipboard.test.ts',
    'docs/screens/',
  ],
  'ba-analyst': [
    'src/config/',
    'src/lib/ai/prompts/',
    'src/lib/report/templates.ts',
    'src/lib/report/templates.test.ts',
    'src/fixtures/',
    'scripts/gen-mock.ts',
    'docs/03_KPI_RULES.md',
    'docs/05_AI_SPEC.md',
    'docs/07_REPORT_TEMPLATE.md',
    'docs/BA-',
  ],
  'qa-engineer': ['tests/', 'docs/08_TEST_PLAN.md', 'docs/test-report.md', 'docs/perf-report.md', 'docs/bugs.md'],
};
/** Ai cũng được sửa: handoff của task mình */
const ALWAYS = ['handoffs/'];
/** Không ai ngoài techlead/PM sửa trên nhánh task (TEAM.md §4) */
const SHARED = [
  'TASKS.md',
  'docs/11_AI_USAGE_LOG.md',
  'handoffs/CHANGE_REQUESTS.md',
  'CLAUDE.md',
  'TEAM.md',
  'AGENTS.md',
  'src/types/domain.ts',
  'docs/10_CONTRACTS.md',
  'package.json',
  'package-lock.json',
  '.github/',
];

const ROLES = Object.keys(OWNED);
// feat/<role>/<TASK-ID>  hoặc  feat/<tên>/<role>/<TASK-ID> (Nhân đang dùng)  hoặc claude/* (techlead)
const m = branch.match(/^feat\/(?:[^/]+\/)?([a-z-]+)\/([A-Z]+-[A-Za-z0-9-]+)$/);
const isTechlead = /^claude\//.test(branch) || /^feat\/(?:[^/]+\/)?(techlead|pm-release)\//.test(branch);

const errors = [];
const warnings = [];
const notes = [];

let role = null;
let taskIds = [];
if (isTechlead) {
  role = 'techlead';
} else if (!m || !ROLES.includes(m[1])) {
  errors.push(
    `Tên nhánh \`${branch}\` sai mẫu \`feat/<role>/<TASK-ID>\` (role ∈ ${ROLES.join(', ')}). Ví dụ: \`feat/frontend-input/FI-01\`.`,
  );
} else {
  role = m[1];
  // "DATA-01-DATA-04-FC-01" → [DATA-01, DATA-04, FC-01]; "DATA-FIX-01" → [DATA-FIX-01]; "DATA-05-lite" → [DATA-05-lite]
  taskIds = m[2].match(/[A-Z]+(?:-[A-Z]+)*-\d+[a-z]*(?:-lite)?/g) ?? [m[2]];
}

const person = role ? Object.entries(PEOPLE).find(([, rs]) => rs.includes(role))?.[0] : null;
const allowed = person ? PEOPLE[person].flatMap((r) => OWNED[r]) : [];

const files = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMRD', `${base}...${head}`], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);

// File do NGƯỜI sửa (bỏ commit của Claude review bot — bot được phép cập nhật TASKS.md + biên bản review)
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const BOT = /github-actions\[bot\]|claude\[bot\]/;
const humanFiles = new Set();
for (const c of git('rev-list', '--no-merges', `${base}..${head}`).split('\n').filter(Boolean)) {
  if (BOT.test(git('show', '-s', '--format=%an <%ae>', c))) continue;
  for (const f of git('diff-tree', '--no-commit-id', '--name-only', '-r', c).split('\n').filter(Boolean))
    humanFiles.add(f);
}

const match = (f, p) =>
  p === '*' || f === p || (p.endsWith('/') ? f.startsWith(p) : f.startsWith(p) && p.endsWith('-'));
const colocatedTest = (f) =>
  /\.test\.tsx?$/.test(f) && allowed.some((p) => match(f.replace(/\.test(\.tsx?)$/, '$1'), p));

if (role && role !== 'techlead') {
  for (const f of files.filter((x) => humanFiles.has(x))) {
    if (SHARED.some((p) => match(f, p))) {
      errors.push(
        `\`${f}\` là file dùng chung/hợp đồng — chỉ techlead/PM sửa. Ghi yêu cầu vào handoff (mục "Cần người khác làm").`,
      );
    } else if (!(ALWAYS.some((p) => match(f, p)) || allowed.some((p) => match(f, p)) || colocatedTest(f))) {
      warnings.push(`\`${f}\` ngoài phạm vi của ${person} (${PEOPLE[person].join(' + ')}).`);
    }
  }
  for (const id of taskIds) {
    if (
      !files.some((f) => f === `handoffs/${id}.md`) &&
      !files.some((f) => f.startsWith('handoffs/') && f.includes(id))
    ) {
      errors.push(`Thiếu \`handoffs/${id}.md\` (bàn giao theo handoffs/_TEMPLATE.md).`);
    }
  }
}
notes.push(
  `Nhánh: \`${branch}\` · Role: ${role ?? '?'} · Người: ${person ?? '?'} · Task: ${taskIds.join(', ') || '—'}`,
);
notes.push(`${files.length} file thay đổi so với \`${base}\`.`);

const lines = [
  '## 🛡️ PR guard',
  ...notes.map((n) => `- ${n}`),
  '',
  errors.length ? `### ❌ Lỗi (${errors.length}) — phải sửa` : '### ✅ Không có lỗi chặn',
  ...errors.map((e) => `- ${e}`),
  ...(warnings.length
    ? ['', `### ⚠️ Cảnh báo (${warnings.length}) — techlead xem xét`, ...warnings.map((w) => `- ${w}`)]
    : []),
];
const report = lines.join('\n');
process.stdout.write(`${report}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
process.exit(errors.length ? 1 : 0);
