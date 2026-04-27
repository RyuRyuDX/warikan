"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (error) {
      setLoading(false);
      setError(translateError(error.message));
      return;
    }
    // 成功時は loading=true のまま遷移する。
    // setLoading(false) を呼ぶと、router.replace 完了までの数百 ms
    // 何も起きていないように見えてユーザーが画面を更新してしまう。
    router.replace("/calendar");
    router.refresh();
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      {loading && <LoadingOverlay mode={mode} />}
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl p-8 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">割り勘ログ</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
          {mode === "signin"
            ? "メールアドレスとパスワードでログイン"
            : "新規アカウントを作成"}
        </p>

        <div className="flex gap-1 bg-gray-100 dark:bg-zinc-800 rounded-xl p-1 mb-6 text-sm font-bold">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 py-2 rounded-lg transition-colors ${
              mode === "signin" ? "bg-white dark:bg-zinc-900 text-primary shadow-sm" : "text-gray-500 dark:text-zinc-400"
            }`}
          >
            ログイン
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 py-2 rounded-lg transition-colors ${
              mode === "signup" ? "bg-white dark:bg-zinc-900 text-primary shadow-sm" : "text-gray-500 dark:text-zinc-400"
            }`}
          >
            新規登録
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-primary"
            autoComplete="email"
            required
            autoFocus
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              className="w-full pl-4 pr-16 py-3 rounded-xl bg-gray-100 dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-primary"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={6}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-2 text-xs font-bold text-gray-500 dark:text-zinc-400 active:text-primary"
              tabIndex={-1}
              aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
            >
              {showPassword ? "隠す" : "表示"}
            </button>
          </div>

          {mode === "signup" && (
            <p className="text-xs text-gray-500 dark:text-zinc-400 px-1">
              6 文字以上。半角英字・数字・記号が使えます（例: <code className="bg-gray-100 dark:bg-zinc-800 px-1 rounded">MyPass2026!</code>）
            </p>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !email || password.length < 6}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50 active:opacity-80 flex items-center justify-center gap-2"
          >
            {loading && <Spinner />}
            {loading
              ? mode === "signin"
                ? "ログイン中..."
                : "登録中..."
              : mode === "signin"
                ? "ログイン"
                : "アカウントを作成"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

function LoadingOverlay({ mode }: { mode: Mode }) {
  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-900/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
      <svg
        className="animate-spin h-10 w-10 text-primary"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      <p className="text-sm text-gray-700 dark:text-zinc-200 font-semibold">
        {mode === "signin" ? "ログインしています..." : "アカウントを作成しています..."}
      </p>
    </div>
  );
}

// Supabase が返すエラーを日本語化
function translateError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "メールアドレスまたはパスワードが間違っています";
  }
  if (lower.includes("user already registered")) {
    return "このメールアドレスは既に登録されています。ログインしてください";
  }
  if (lower.includes("password should be at least")) {
    return "パスワードは 6 文字以上にしてください";
  }
  if (lower.includes("email") && lower.includes("confirm")) {
    return "メール確認が有効です。Supabase の Authentication 設定で「Confirm email」を OFF にしてください";
  }
  return msg;
}
