# warikan — プロジェクト指示

ふたりで使うシンプルな割り勘アプリ。Next.js 15 (App Router) / React 19 / TypeScript / Supabase (Auth + Postgres + RLS + RPC) / Tailwind CSS / date-fns。

## 完了の基準（ループ協議）

各タスクは「直線」ではなく「ループ」で回す:

1. 変更を書く
2. チェックを走らせる（下表）
3. 失敗したらエラーを読み、根本原因を直して 2 に戻る（最大 5 回）
4. 全チェック緑になったら「完了」と報告し、通過した出力を証拠として添える

**禁止:** チェック出力なしの「完了」報告 / テスト・アサーションを弱体化して通すこと。

## チェックコマンド

| 種類 | コマンド | 備考 |
|---|---|---|
| 型チェック | `npx tsc --noEmit` | 常に実行可 |
| Lint | `npm run lint` | `next lint`。`.eslintrc.json` 必須 |
| RPC テスト | `bash supabase/tests/run_tests.sh` | ローカル Postgres 必要。RLS/RPC の SQL E2E |
| 本番ビルド | `npm run build` | デプロイ前の最終確認 |

UI の実挙動確認には `.env.local`（Supabase 接続情報）が要る。無い環境では、その旨を明記して報告する（緑を偽装しない）。

## ハーネス（同梱ガード）

- **Stop 検証ゲート** (`.claude/hooks/verify.sh`): 未コミットの `.ts/.tsx` 変更があるとき `tsc + lint` を走らせ、赤なら「完了」をブロックするフック。変更なし・通過なら素通り。**デフォルトでは未登録**なので、有効化するには `.claude/settings.json` に次を追記する:

  ```json
  "hooks": {
    "Stop": [
      { "hooks": [ { "type": "command", "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/verify.sh\"" } ] }
    ]
  }
  ```

- **fixer サブエージェント** (`.claude/agents/fixer.md`): チェックが赤いときに呼ぶ修正専門エージェント。最小差分で緑に戻す。

## コーディング規約

- 既存のコードスタイルに従う。過度なエンジニアリングを避け、シンプルに保つ。
- 明示的に要求されていない機能を足さない。コメントは必要最小限。
- クォート（シングル/ダブル）を変換しない。空白・インデント・改行など機能に無関係なフォーマット変更をしない。

## Git ワークフロー

- 作業はフィーチャーブランチで行う。`main` へ直接コミットしない。
- 緑になったら PR を作成し、`gh pr merge --squash --delete-branch` まで進める。

## DB マイグレーション

`supabase/migrations/` の SQL は番号順に Supabase の SQL Editor で手動実行する（PR マージだけでは DB に反映されない）。詳細は README のセットアップ手順を参照。
