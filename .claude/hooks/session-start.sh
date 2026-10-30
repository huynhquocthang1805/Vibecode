#!/usr/bin/env bash
# SessionStart: in nhanh tình hình dự án vào ngữ cảnh của agent.
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
echo "=== DỰ ÁN: Dashboard KPI Chiến dịch Mini — đọc CLAUDE.md trước khi làm ==="
if [ -f TASKS.md ]; then
  total=$(grep -cE '^\| \[( |~|x|!)\]' TASKS.md 2>/dev/null || true)
  done=$(grep -cE '^\| \[x\]' TASKS.md 2>/dev/null || true)
  doing=$(grep -E '^\| \[~\]' TASKS.md 2>/dev/null | awk -F'|' '{gsub(/ /,"",$3); print $3}' | paste -sd ', ' -)
  blocked=$(grep -E '^\| \[!\]' TASKS.md 2>/dev/null | awk -F'|' '{gsub(/ /,"",$3); print $3}' | paste -sd ', ' -)
  echo "Tiến độ: ${done}/${total} task xong"
  [ -n "$doing" ] && echo "Đang làm: $doing"
  [ -n "$blocked" ] && echo "BỊ CHẶN: $blocked"
fi
if [ -f handoffs/CHANGE_REQUESTS.md ]; then
  open=$(grep -c '^- \[ \]' handoffs/CHANGE_REQUESTS.md 2>/dev/null || true)
  [ -n "$open" ] && [ "$open" != "0" ] && echo "Change request đang mở: $open (techlead xử lý)"
fi
branch=$(git branch --show-current 2>/dev/null)
[ -n "$branch" ] && echo "Nhánh hiện tại: $branch"
exit 0
