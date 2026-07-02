#!/usr/bin/env bash
# loop-harness: Stop 検証ゲート（ポータブル版）
#
# 未コミットの対象ファイル変更があるとき、設定されたチェック（型 / lint / test 等）を
# 走らせ、赤なら exit 2 で「完了」をブロックする。緑・変更なしなら exit 0。
#
# 設定ファイル: <project>/.claude/loop-harness.conf（あれば source する）
#   WATCH_GLOBS=('*.ts' '*.tsx')                 変更検出の対象 glob
#   CHECKS=('npx tsc --noEmit' 'npm run lint')   実行するチェックコマンド
#   TEST_CMD='npm test'                          INCLUDE_TEST=1 のとき CHECKS 末尾に追加
#   INCLUDE_TEST=0                               1 でテストもゲートに含める（厳格・低速）
#   REQUIRE_CHANGES=0                            1 で「差分ゼロでの完了」もブロック（空diff拒否）
# 設定が無ければ Node/TS を簡易オートディテクトする。
set -uo pipefail

project="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$project" 2>/dev/null || exit 0

# --- デフォルト値 ---
WATCH_GLOBS=()
CHECKS=()
TEST_CMD=''
INCLUDE_TEST=0
REQUIRE_CHANGES=0

conf="$project/.claude/loop-harness.conf"
conf_loaded=0
if [ -f "$conf" ]; then
  # shellcheck disable=SC1090
  . "$conf"
  conf_loaded=1
fi

# --- オートディテクト（conf が無いときだけ。conf があればそれを正とする） ---
if [ "$conf_loaded" -eq 0 ] && [ ${#CHECKS[@]} -eq 0 ]; then
  if [ -f tsconfig.json ] && command -v npx >/dev/null 2>&1; then
    CHECKS+=('npx tsc --noEmit')
  fi
  if [ -f package.json ] && grep -q '"lint"' package.json 2>/dev/null; then
    CHECKS+=('npm run lint')
  fi
fi
if [ ${#WATCH_GLOBS[@]} -eq 0 ]; then
  WATCH_GLOBS=('*.ts' '*.tsx' '*.js' '*.jsx')
fi
if [ "$INCLUDE_TEST" = "1" ] && [ -n "$TEST_CMD" ]; then
  CHECKS+=("$TEST_CMD")
fi

# チェックが無ければゲートしない（未対応スタック）
if [ ${#CHECKS[@]} -eq 0 ]; then
  exit 0
fi

# --- 変更検出 ---
changed=$(git status --porcelain -- "${WATCH_GLOBS[@]}" 2>/dev/null)
if [ -z "$changed" ]; then
  if [ "$REQUIRE_CHANGES" = "1" ]; then
    anychange=$(git status --porcelain 2>/dev/null)
    if [ -z "$anychange" ]; then
      echo "検証ゲート: 変更ゼロで完了しようとしています（REQUIRE_CHANGES=1）。作業した内容を確認してください。" >&2
      exit 2
    fi
  fi
  exit 0
fi

# --- チェック実行 ---
fails=''
for cmd in "${CHECKS[@]}"; do
  if ! out=$(bash -c "$cmd" 2>&1); then
    fails+="### FAILED: $cmd"$'\n'"$(echo "$out" | tail -20)"$'\n\n'
  fi
done

if [ -n "$fails" ]; then
  {
    echo "検証ゲート失敗（緑になるまで完了不可）。以下を直してください:"
    printf '%s' "$fails" | tail -40
  } >&2
  exit 2
fi
exit 0
