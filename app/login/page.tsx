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

    setLoading(false);
    if (error) {
      setError(translateError(error.message));
      return;
    }
    // ミドルウェアが /calendar or /onboarding に振り分ける
    router.replace("/calendar");
    router.refresh();
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">割り勘ログ</h1>
        <p className="text-sm text-gray-500 mb-6">
          {mode === "signin"
            ? "メールアドレスとパスワードでログイン"
            : "新規アカウントを作成"}
        </p>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 text-sm font-bold">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 py-2 rounded-lg transition-colors ${
              mode === "signin" ? "bg-white text-primary shadow-sm" : "text-gray-500"
            }`}
          >
            ログイン
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 py-2 rounded-lg transition-colors ${
              mode === "signup" ? "bg-white text-primary shadow-sm" : "text-gray-500"
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
            className="w-full px-4 py-3 rounded-xl bg-gray-100 outline-none focus:ring-2 focus:ring-primary"
            autoComplete="email"
            required
            autoFocus
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード (6文字以上)"
            className="w-full px-4 py-3 rounded-xl bg-gray-100 outline-none focus:ring-2 focus:ring-primary"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={6}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !email || password.length < 6}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50 active:opacity-80"
          >
            {loading
              ? "処理中..."
              : mode === "signin"
                ? "ログイン"
                : "アカウントを作成"}
          </button>
        </form>

        {mode === "signup" && (
          <p className="text-xs text-gray-400 mt-4 text-center">
            登録後すぐにアプリが使えます
          </p>
        )}
      </div>
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
