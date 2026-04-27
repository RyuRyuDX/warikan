"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 既にカップル所属なら calendar へ
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase
        .from("couple_members")
        .select("couple_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) router.replace("/calendar");
    })();
  }, [router]);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("create_couple", {
      p_display_name: displayName || "私",
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.push("/calendar");
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl p-8 shadow-sm">
        <h1 className="text-xl font-bold mb-2">はじめまして</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
          表示名を決めてください。後から変更できます。
        </p>

        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="例: 私"
          maxLength={20}
          className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-zinc-800 mb-4 outline-none focus:ring-2 focus:ring-primary"
          autoFocus
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={loading || !displayName}
          className="w-full py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50 active:opacity-80"
        >
          {loading ? "作成中..." : "始める"}
        </button>

        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-6 text-center">
          パートナーは設定画面の招待リンクから参加します
        </p>
      </div>
    </div>
  );
}
