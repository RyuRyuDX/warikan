# 割り勘ログ

彼女と使うシンプルな割り勘アプリ。Next.js + Supabase + PWA。

## 機能

- カレンダーで日付を選んで支出を入力（日付・金額・カテゴリ・立て替え者）
- 比率（デフォ 7:3）を自動適用
- 月次サマリーで「彼女→あなた ¥30,000」のように精算額を表示
- 招待リンクでカップルとして共有
- カテゴリは自由に追加・削除
- 表示名は各自カスタマイズ可

## 技術スタック

- Next.js 15 (App Router) / React 19 / TypeScript
- Supabase (Auth + Postgres + RLS)
- Tailwind CSS
- date-fns
- PWA (manifest.json + apple-web-app meta)

---

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. Supabase プロジェクトを作成

1. https://supabase.com/dashboard で新規プロジェクトを作成（無料）
2. プロジェクトの **Settings → API** から以下をコピー：
   - `Project URL`
   - `anon public` キー

### 3. 環境変数の設定

`.env.example` をコピーして `.env.local` を作成：

```bash
cp .env.example .env.local
```

`.env.local` を編集して上記の値を貼り付け：

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiI...
```

### 4. データベーススキーマを適用

Supabase ダッシュボードの **SQL Editor** を開き、`supabase/migrations/0001_initial.sql` の中身を全部コピペして実行。テーブル・RLS・RPC関数が一気に作られます。

### 5. 認証設定

メールアドレス + パスワード認証を使います。

Supabase ダッシュボードの **Authentication → Providers → Email** で：

- **Enable Email provider**: ON
- **Confirm email**: OFF（メール確認なしで即ログイン可にする）

`Confirm email` を ON のままだと新規登録のたびに確認メールが必要になります。
個人/カップル単位の利用なら OFF が楽。

### 6. ローカル起動

```bash
npm run dev
```

http://localhost:3000 を開いて、メールアドレス + パスワードで新規登録 → 表示名を入れて使い始められます。

---

## GitHub にプッシュする手順

```bash
# 1. リポジトリ初期化
git init
git add .
git commit -m "initial commit"

# 2. GitHub で新しいリポジトリを作成（Web UIから、Privateでも Publicでも可）
#    https://github.com/new

# 3. リモート追加 & プッシュ（YOUR_USER と REPO_NAME は適宜置き換え）
git branch -M main
git remote add origin git@github.com:YOUR_USER/REPO_NAME.git
git push -u origin main
```

---

## Vercel にデプロイ

1. https://vercel.com にログイン（GitHub アカウントでOK）
2. 「Add New → Project」→ さっき push した GitHub リポジトリを選択
3. 「Environment Variables」セクションで `.env.local` の中身（Supabase の URL とキー）をそのままコピペ
4. Deploy ボタンを押す → 1〜2分でデプロイ完了
5. 発行された URL（例: `warikan-abc.vercel.app`）を Supabase の **Authentication → URL Configuration** の Site URL と Redirect URLs にも追加

その後は `git push` するたびに自動でデプロイされます。

---

## PWA としてホーム画面に追加

iPhone Safari で本番 URL を開いて：
1. 共有ボタン（□↑）をタップ
2. 「ホーム画面に追加」を選択

これでネイティブアプリっぽく使えます。彼女にも招待リンクを送って、同じく追加してもらえばOK。

---

## ディレクトリ構成

```
warikan/
├── app/
│   ├── (app)/                  # 認証必須のエリア（下部タブ付き）
│   │   ├── calendar/           # カレンダー画面（メイン）
│   │   ├── summary/            # 月次サマリー
│   │   └── settings/           # 設定
│   ├── auth/callback/          # マジックリンクのコールバック
│   ├── invite/[token]/         # 招待リンクからの参加
│   ├── login/                  # ログイン画面
│   ├── onboarding/             # 初回カップル作成
│   └── layout.tsx              # ルートレイアウト
├── lib/
│   ├── supabase/               # Supabaseクライアント
│   └── calculations.ts         # 比率・精算ロジック
├── supabase/
│   └── migrations/             # DBスキーマ
└── public/
    └── manifest.json           # PWA設定
```

---

## 拡張アイデア（将来）

- 個別比率オーバーライド（旅行だけ 50:50 など）
- 月またぎの精算履歴の閲覧
- レシート画像の添付
- カテゴリ別グラフ（折れ線・円グラフ）
- パートナーの入力をリアルタイム反映（Supabase Realtime）
- CSVエクスポート
- 通知（Web Push、月末リマインダー等）

---

## アイコン用画像（後で追加）

`public/icon-192.png` と `public/icon-512.png` をお好みの画像で追加してください。なくてもアプリは動きますが、PWA としてホーム画面に追加した時のアイコンが空になります。

簡易的な作り方：
- Figma や Canva で正方形の画像作成
- もしくは https://realfavicongenerator.net などのジェネレーターを使う

---

## トラブルシューティング

### `npm run dev` でエラー
- Node.js 20 以上を推奨
- `.env.local` に Supabase の値が入っているか確認

### ログインできない
- メールアドレス・パスワードが正しいか確認
- 「Confirm email」が ON のままだと新規登録時に確認メールが必要 (Supabase の Authentication → Providers → Email でトグル OFF を推奨)
- 既存のマジックリンク経由ユーザーをパスワード認証に移行したい場合は、Supabase ダッシュボードで該当ユーザーを削除して再登録する

### 招待リンクから参加できない
- Supabase の Redirect URLs に該当ドメインが追加されているか
- 既に2人埋まっていないか

### `Could not find the function public.create_couple(p_display_name) in the schema cache`
表示名を決めて「始める」を押した時に出る場合：
- `supabase/migrations/0002_fix_create_couple.sql` の中身を SQL Editor にコピペして実行
- 旧バージョンのパラメータ名 (`display_name` 等) で作られた関数を作り直し、PostgREST のスキーマキャッシュを再読込する

---

## ライセンス

私的利用前提。お好きにどうぞ。
