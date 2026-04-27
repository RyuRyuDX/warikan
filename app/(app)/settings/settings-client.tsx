"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Member = { user_id: string; display_name: string; role: "owner" | "partner" };
type Category = { id: string; name: string; color: string; sort_order: number };

export default function SettingsClient({
  currentUserId,
  couple,
  members,
  categories: initialCategories,
}: {
  currentUserId: string;
  couple: { id: string; default_ratio: number; invite_token: string };
  members: Member[];
  categories: Category[];
}) {
  const router = useRouter();
  const [ratio, setRatio] = useState(couple.default_ratio);
  const [inviteToken, setInviteToken] = useState(couple.invite_token);
  const [categories, setCategories] = useState(initialCategories);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberDisplayName, setMemberDisplayName] = useState("");

  const owner = members.find((m) => m.role === "owner");
  const partner = members.find((m) => m.role === "partner");
  const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${inviteToken}`;

  async function saveRatio(newRatio: number) {
    setRatio(newRatio);
    const supabase = createClient();
    await supabase
      .from("couples")
      .update({ default_ratio: newRatio })
      .eq("id", couple.id);
  }

  async function saveDisplayName(memberId: string, name: string) {
    if (!name.trim()) return;
    const supabase = createClient();
    await supabase
      .from("couple_members")
      .update({ display_name: name })
      .eq("user_id", memberId);
    setEditingMemberId(null);
    router.refresh();
  }

  async function regenerateInvite() {
    if (!confirm("招待リンクを再発行しますか? 前のリンクは無効になります。")) return;
    const supabase = createClient();
    const { data, error } = await supabase.rpc("regenerate_invite_token");
    if (!error && data) setInviteToken(data);
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    alert("招待リンクをコピーしました");
  }

  async function addCategory() {
    const name = prompt("カテゴリ名を入力");
    if (!name) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("categories")
      .insert({
        couple_id: couple.id,
        name,
        color: "#888888",
        sort_order: categories.length + 1,
      })
      .select()
      .single();
    if (data) setCategories([...categories, data]);
  }

  async function deleteCategory(id: string) {
    if (!confirm("このカテゴリを削除しますか? 紐付いた支出があると削除できません。")) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("categories")
      .update({ archived: true })
      .eq("id", id);
    if (!error) setCategories(categories.filter((c) => c.id !== id));
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const ownerPercent = Math.round(ratio * 100);
  const partnerPercent = 100 - ownerPercent;

  return (
    <div className="max-w-md mx-auto safe-top">
      <header className="px-5 pt-6 pb-4 flex items-center justify-between">
        <div className="w-6" />
        <h1 className="text-xl font-bold">設定</h1>
        <button
          onClick={logout}
          className="text-xs text-gray-500 px-2"
        >
          ログアウト
        </button>
      </header>

      {/* プロフィール */}
      <Section title="プロフィール">
        <div className="bg-gray-100 rounded-2xl divide-y divide-white">
          {members.map((m) => {
            const isMe = m.user_id === currentUserId;
            const isEditing = editingMemberId === m.user_id;
            return (
              <div key={m.user_id} className="flex items-center p-4">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold mr-3 ${
                    m.role === "owner" ? "bg-primary" : "bg-partner"
                  }`}
                >
                  {m.display_name.slice(0, 1)}
                </div>
                <div className="flex-1">
                  <div className="text-[10px] text-gray-500">
                    {m.role === "owner" ? "あなた" : "パートナー"}
                  </div>
                  {isEditing ? (
                    <input
                      type="text"
                      value={memberDisplayName}
                      onChange={(e) => setMemberDisplayName(e.target.value)}
                      onBlur={() =>
                        saveDisplayName(m.user_id, memberDisplayName)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          saveDisplayName(m.user_id, memberDisplayName);
                        }
                      }}
                      maxLength={20}
                      className="w-full bg-white rounded px-2 py-0.5 text-sm font-semibold outline-none"
                      autoFocus
                    />
                  ) : (
                    <div className="text-sm font-semibold">{m.display_name}</div>
                  )}
                </div>
                {isMe && !isEditing && (
                  <button
                    onClick={() => {
                      setEditingMemberId(m.user_id);
                      setMemberDisplayName(m.display_name);
                    }}
                    className="text-xs text-primary font-semibold"
                  >
                    編集 ›
                  </button>
                )}
              </div>
            );
          })}
          {members.length === 1 && (
            <div className="p-4 text-xs text-gray-500">
              パートナーはまだ参加していません。下の招待リンクを共有してください。
            </div>
          )}
        </div>
      </Section>

      {/* デフォルト比率 */}
      <Section title="デフォルト比率">
        <div className="bg-gray-100 rounded-2xl p-5">
          <div className="flex justify-between text-sm font-bold mb-3">
            <span>{owner?.display_name ?? "あなた"} {ownerPercent}%</span>
            <span>{partner?.display_name ?? "パートナー"} {partnerPercent}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={ownerPercent}
            onChange={(e) => saveRatio(parseInt(e.target.value, 10) / 100)}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-gray-500 mt-2">
            <span>あなたが多い</span>
            <span>パートナーが多い</span>
          </div>
        </div>
      </Section>

      {/* カテゴリ管理 */}
      <Section title="カテゴリ管理">
        <div className="bg-gray-100 rounded-2xl divide-y divide-white">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center p-3">
              <span className="text-gray-300 text-lg mr-3">≡</span>
              <span
                className="w-3 h-3 rounded-full mr-3"
                style={{ backgroundColor: c.color }}
              />
              <span className="flex-1 text-sm">{c.name}</span>
              <button
                onClick={() => deleteCategory(c.id)}
                className="text-xs text-red-500 px-2"
              >
                削除
              </button>
            </div>
          ))}
          <button
            onClick={addCategory}
            className="flex items-center w-full p-3 text-primary text-sm font-bold"
          >
            <span className="text-lg mr-2">+</span>
            新しいカテゴリを追加
          </button>
        </div>
      </Section>

      {/* 招待 */}
      <Section title="カップル招待">
        <div className="bg-gray-100 rounded-2xl p-4 space-y-3">
          <div>
            <div className="text-[10px] text-gray-500 mb-1">招待リンク</div>
            <div className="text-xs font-mono break-all bg-white rounded-lg p-2">
              {inviteUrl}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyInvite}
              className="flex-1 py-2 bg-primary text-white text-xs font-bold rounded-lg active:opacity-80"
            >
              コピー
            </button>
            <button
              onClick={regenerateInvite}
              className="flex-1 py-2 border border-primary text-primary text-xs font-bold rounded-lg active:opacity-80"
            >
              再発行
            </button>
          </div>
          <p className="text-[10px] text-gray-400 italic">
            ※ 再発行すると前のリンクは無効になります
          </p>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-5 mb-6">
      <h2 className="text-xs font-bold text-gray-500 mb-2 px-1">{title}</h2>
      {children}
    </div>
  );
}
