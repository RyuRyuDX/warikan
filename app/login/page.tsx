"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">割り勘ログ</h1>
        <p className="text-sm text-gray-500 mb-8">
          メールアドレスでログインリンクを受け取ります
        </p>

        {sent ? (
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 text-sm text-gray-700">
            <p className="font-semibold text-primary mb-1">送信しました</p>
            <p>{email} にログインリンクを送信しました。メールを確認してください。</p>
          </div>
        ) : (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl bg-gray-100 mb-4 outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            {error && (
              <p className="text-sm text-red-600 mb-3">{error}</p>
            )}
            <button
              onClick={handleLogin}
              disabled={loading || !email}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50 active:opacity-80"
            >
              {loading ? "送信中..." : "ログインリンクを送信"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
