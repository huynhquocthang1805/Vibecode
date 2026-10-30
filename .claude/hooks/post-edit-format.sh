#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit): tự format file vừa sửa bằng Prettier.
# Không bao giờ chặn agent (luôn exit 0).
input="$(cat)"
file="$(printf '%s' "$input" | node -e '
let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
  try{const j=JSON.parse(d);process.stdout.write((j.tool_input&&j.tool_input.file_path)||"")}catch(e){}
})' 2>/dev/null)"
[ -z "$file" ] && exit 0
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.json|*.css|*.md)
    if [ -f "$file" ]; then
      npx --no-install prettier --write "$file" >/dev/null 2>&1 || true
    fi
    ;;
esac
exit 0
