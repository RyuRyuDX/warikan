"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // 招待トークンを localStorage に保存してから login へ
        if (typeof window !== "undefined") {
          window.localStorage.setItem("pending_invite_token", token);
        }
        setNeedsLogin(true);
      }
      setAuthChecking(false);
    })();
  }, [token]);

  async function handleJoin() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("join_couple", {
      p_invite_token: token,
      p_display_name: displayName || "パートナー",
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.push("/calendar");
    }
  }

  if (authChecking) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-sm text-gray-400 dark:text-zinc-500">
        確認中...
      </div>
    );
  }

  if (needsLogin) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl p-8 shadow-sm">
          <h1 className="text-xl font-bold mb-2">カップルに招待されました</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
            参加するには、まずログインしてください。
          </p>
          <button
            onClick={() => router.push("/login")}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold"
          >
            ログインへ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl p-8 shadow-sm">
        <h1 className="text-xl font-bold mb-2">カップルに参加</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
          表示名を決めてください。後から変更できます。
        </p>

        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="例: あい"
          maxLength={20}
          className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-zinc-800 mb-4 outline-none focus:ring-2 focus:ring-primary"
          autoFocus
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

        <button
          onClick={handleJoin}
          disabled={loading || !displayName}
          className="w-full py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50"
        >
          {loading ? "参加中..." : "参加する"}
        </button>
      </div>
    </div>
  );
}
