#!/usr/bin/env bash
# Stop フック（検証ゲート）
# 未コミットの .ts/.tsx 変更があるときだけ tsc + lint を走らせ、
# 失敗したら exit 2 で「完了」をブロックする。変更なし or 通過なら exit 0。
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# staged / unstaged / untracked すべての ts/tsx 変更を検出
changed=$(git status --porcelain -- '*.ts' '*.tsx' 2>/dev/null)
if [ -z "$changed" ]; then
  exit 0
fi

if output=$(npx tsc --noEmit 2>&1 && npm run lint 2>&1); then
  exit 0
fi

{
  echo "検証ゲート失敗（緑になるまで完了不可）。tsc / lint を直してください:"
  echo "$output" | tail -25
} >&2
exit 2
