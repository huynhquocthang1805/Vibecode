#!/usr/bin/env bash
# PreToolUse (Bash): chặn lệnh nguy hiểm. exit 2 = chặn, nội dung stderr được gửi lại cho agent.
input="$(cat)"
cmd="$(printf '%s' "$input" | node -e '
let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
  try{const j=JSON.parse(d);process.stdout.write((j.tool_input&&j.tool_input.command)||"")}catch(e){}
})' 2>/dev/null)"
[ -z "$cmd" ] && exit 0

block() { echo "CHẶN bởi pre-bash-guard: $1" >&2; exit 2; }

echo "$cmd" | grep -Eq 'rm[[:space:]]+-[a-zA-Z]*r[a-zA-Z]*f?[[:space:]]+(/|~|\.|\*)([[:space:]]|$)' && block "rm -rf trên thư mục gốc/dự án"
echo "$cmd" | grep -Eq 'git[[:space:]]+push.*(--force|-f)([[:space:]]|$)' && block "git push --force — nhờ techlead"
echo "$cmd" | grep -Eq 'git[[:space:]]+reset[[:space:]]+--hard' && block "git reset --hard — dễ mất việc của agent khác"
echo "$cmd" | grep -Eq '(cat|less|more|head|tail|type)[[:space:]]+[^|]*\.env(\.local|\.production)?([[:space:]]|$)' && block "không đọc file .env chứa secret"
echo "$cmd" | grep -Eq '(^|[;&|[:space:]])(printenv|env)[[:space:]]*($|\|)' && block "không in toàn bộ biến môi trường"
echo "$cmd" | grep -Eq 'git[[:space:]]+(checkout|switch)[[:space:]]+main.*&&.*git[[:space:]]+commit' && block "không commit thẳng vào main — dùng nhánh feat/<role>/<TASK-ID>"
exit 0
