"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { formatYen, type Expense } from "@/lib/calculations";

type Member = { user_id: string; display_name: string; role: "owner" | "partner" };
type Category = { id: string; name: string; color: string };

type RatioMode = "default" | "half" | "me_all" | "other_all" | "custom";

// editing.ratio_override (= owner 分担比率) から UI 用のモードを逆算する
function deriveRatioMode(
  override: number | null | undefined,
  meRole: "owner" | "partner" | null
): { mode: RatioMode; customMe: number } {
  if (override === null || override === undefined) {
    return { mode: "default", customMe: 50 };
  }
  if (override === 0.5) return { mode: "half", customMe: 50 };
  if (override === 1) {
    return { mode: meRole === "owner" ? "me_all" : "other_all", customMe: 100 };
  }
  if (override === 0) {
    return { mode: meRole === "owner" ? "other_all" : "me_all", customMe: 0 };
  }
  // それ以外はカスタム。me 視点 (%) に変換
  const meRatio = meRole === "owner" ? override : 1 - override;
  return { mode: "custom", customMe: Math.round(meRatio * 100) };
}

// UI モードと me の role から DB 保存用の owner 分担比率 (0-1 or null) を計算
function ratioModeToOverride(
  mode: RatioMode,
  customMe: number,
  meRole: "owner" | "partner" | null
): number | null {
  if (mode === "default") return null;
  if (mode === "half") return 0.5;
  if (mode === "me_all") return meRole === "owner" ? 1 : 0;
  if (mode === "other_all") return meRole === "owner" ? 0 : 1;
  // custom: customMe (%) は me 視点。owner 視点に変換
  const meRatio = customMe / 100;
  return meRole === "owner" ? meRatio : 1 - meRatio;
}

export default function ExpenseModal({
  coupleId,
  currentUserId,
  members,
  categories,
  defaultRatio,
  initialDate,
  editing,
  onClose,
  onSaved,
}: {
  coupleId: string;
  currentUserId: string;
  members: Member[];
  categories: Category[];
  defaultRatio: number;
  initialDate: Date;
  editing: Expense | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const me = members.find((m) => m.user_id === currentUserId);
  const meRole = me?.role ?? null;

  const initialRatio = deriveRatioMode(editing?.ratio_override ?? null, meRole);

  const [date, setDate] = useState(format(initialDate, "yyyy-MM-dd"));
  const [amount, setAmount] = useState<string>(
    editing ? String(editing.amount) : ""
  );
  const [categoryId, setCategoryId] = useState<string>(
    editing?.category_id ?? categories[0]?.id ?? ""
  );
  const [payerId, setPayerId] = useState<string>(
    editing?.payer_user_id ?? currentUserId
  );
  const [note, setNote] = useState(editing?.note ?? "");
  const [ratioMode, setRatioMode] = useState<RatioMode>(initialRatio.mode);
  const [customMe, setCustomMe] = useState<number>(initialRatio.customMe);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const owner = members.find((m) => m.role === "owner");
  const partner = members.find((m) => m.role === "partner");
  const amountNum = parseInt(amount.replace(/[^0-9]/g, "") || "0", 10);

  const ratioOverride = ratioModeToOverride(ratioMode, customMe, meRole);
  const effectiveRatio = ratioOverride ?? defaultRatio;
  const ownerShare = Math.round(amountNum * effectiveRatio);
  const partnerShare = amountNum - ownerShare;

  async function handleSave() {
    if (!amountNum || !categoryId) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();

    if (editing) {
      const { error } = await supabase
        .from("expenses")
        .update({
          date,
          amount: amountNum,
          category_id: categoryId,
          payer_user_id: payerId,
          ratio_override: ratioOverride,
          note: note || null,
        })
        .eq("id", editing.id);
      setSaving(false);
      if (error) {
        setError(error.message);
      } else {
        onSaved();
      }
    } else {
      const { error } = await supabase.from("expenses").insert({
        couple_id: coupleId,
        date,
        amount: amountNum,
        category_id: categoryId,
        payer_user_id: payerId,
        ratio_override: ratioOverride,
        note: note || null,
        created_by: currentUserId,
      });
      setSaving(false);
      if (error) {
        setError(error.message);
      } else {
        onSaved();
      }
    }
  }

  async function handleDelete() {
    if (!editing) return;
    if (!confirm("この支出を削除しますか?")) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      setError(error.message);
    } else {
      onSaved();
    }
  }

  const defaultMePct = Math.round(
    (meRole === "owner" ? defaultRatio : 1 - defaultRatio) * 100
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/60">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90dvh] flex flex-col">
        {/* ヘッダー (常時表示。iOS Safari の sticky 不具合を避けるため flex で固定) */}
        <div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 flex items-center justify-between px-5 py-4 rounded-t-3xl flex-shrink-0">
          <button onClick={onClose} className="text-gray-500 dark:text-zinc-400 text-sm">
            キャンセル
          </button>
          <h2 className="font-bold">
            {editing ? "支出を編集" : "支出を追加"}
          </h2>
          <button
            onClick={handleSave}
            disabled={saving || !amountNum || !categoryId}
            className="text-primary font-bold text-sm disabled:opacity-30"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 日付 */}
          <div>
            <label className="text-xs text-gray-500 dark:text-zinc-400 mb-2 block">日付</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-zinc-800 outline-none"
            />
          </div>

          {/* 金額 */}
          <div>
            <label className="text-xs text-gray-500 dark:text-zinc-400 mb-2 block">金額</label>
            <div className="bg-gray-100 dark:bg-zinc-800 rounded-xl px-4 py-5 flex items-center justify-center">
              <span className="text-3xl font-bold text-gray-600 dark:text-zinc-300 mr-2">¥</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={amount ? Number(amount.replace(/\D/g, "")).toLocaleString("ja-JP") : ""}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="0"
                className="bg-transparent text-3xl font-bold outline-none w-32 text-center"
                autoFocus={!editing}
              />
            </div>
          </div>

          {/* カテゴリ */}
          <div>
            <label className="text-xs text-gray-500 dark:text-zinc-400 mb-2 block">カテゴリ</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const selected = c.id === categoryId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategoryId(c.id)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                      selected ? "text-white" : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300"
                    }`}
                    style={selected ? { backgroundColor: c.color } : {}}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 立て替えた人 */}
          <div>
            <label className="text-xs text-gray-500 dark:text-zinc-400 mb-2 block">
              立て替えた人
            </label>
            <div className="bg-gray-100 dark:bg-zinc-800 rounded-xl p-1 grid grid-cols-2 gap-1">
              {members.map((m) => {
                const selected = m.user_id === payerId;
                return (
                  <button
                    key={m.user_id}
                    onClick={() => setPayerId(m.user_id)}
                    className={`py-2.5 rounded-lg text-sm font-bold transition ${
                      selected
                        ? "bg-primary text-white"
                        : "text-gray-600 dark:text-zinc-300"
                    }`}
                  >
                    {m.display_name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 比率 */}
          <div>
            <label className="text-xs text-gray-500 dark:text-zinc-400 mb-2 block">この支出の比率</label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { mode: "default" as const, label: `デフォルト (${defaultMePct}:${100 - defaultMePct})` },
                  { mode: "half" as const, label: "折半 50:50" },
                  { mode: "me_all" as const, label: "自分が全額" },
                  { mode: "other_all" as const, label: "相手が全額" },
                ]
              ).map((opt) => {
                const selected = ratioMode === opt.mode;
                return (
                  <button
                    key={opt.mode}
                    onClick={() => setRatioMode(opt.mode)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition ${
                      selected
                        ? "bg-primary text-white"
                        : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
              <button
                onClick={() => setRatioMode("custom")}
                className={`col-span-2 py-2.5 px-3 rounded-xl text-xs font-bold transition ${
                  ratioMode === "custom"
                    ? "bg-primary text-white"
                    : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300"
                }`}
              >
                カスタム…
              </button>
            </div>
            {ratioMode === "custom" && (
              <div className="mt-3 bg-gray-50 dark:bg-zinc-900 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400 mb-2">
                  <span>自分: {customMe}%</span>
                  <span>相手: {100 - customMe}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={customMe}
                  onChange={(e) => setCustomMe(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            )}
          </div>

          {/* 比率プレビュー */}
          {amountNum > 0 && owner && partner && (
            <div className="bg-primary-50 dark:bg-primary/15 border border-primary-200 dark:border-primary/40 rounded-xl p-4">
              <div className="text-xs text-primary font-bold mb-1">
                {ratioOverride === null ? "⚡" : "🔧"}{" "}
                {Math.round(effectiveRatio * 100)}:
                {Math.round((1 - effectiveRatio) * 100)} で分割
                {ratioOverride !== null && " (この支出のみ)"}
              </div>
              <div className="text-sm">
                {owner.display_name}: {formatYen(ownerShare)} /{" "}
                {partner.display_name}: {formatYen(partnerShare)}
              </div>
            </div>
          )}

          {/* メモ */}
          <div>
            <label className="text-xs text-gray-500 dark:text-zinc-400 mb-2 block">
              メモ (任意)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="スーパーまとめ買い..."
              className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-zinc-800 outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          {/* 削除ボタン (編集時のみ) */}
          {editing && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="w-full py-3 text-red-600 dark:text-red-400 font-semibold border border-red-200 dark:border-red-900/40 rounded-xl active:bg-red-50 dark:active:bg-red-950/30"
            >
              この支出を削除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
