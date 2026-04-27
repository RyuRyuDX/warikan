"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { formatYen, type Expense } from "@/lib/calculations";

type Member = { user_id: string; display_name: string; role: "owner" | "partner" };
type Category = { id: string; name: string; color: string };

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
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const owner = members.find((m) => m.role === "owner");
  const amountNum = parseInt(amount.replace(/[^0-9]/g, "") || "0", 10);
  const ownerShare = Math.round(amountNum * defaultRatio);
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="sticky top-0 bg-white border-b border-gray-200 flex items-center justify-between px-5 py-4">
          <button onClick={onClose} className="text-gray-500 text-sm">
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

        <div className="p-5 space-y-5">
          {/* 日付 */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">日付</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-100 outline-none"
            />
          </div>

          {/* 金額 */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">金額</label>
            <div className="bg-gray-100 rounded-xl px-4 py-5 flex items-center justify-center">
              <span className="text-3xl font-bold text-gray-600 mr-2">¥</span>
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
            <label className="text-xs text-gray-500 mb-2 block">カテゴリ</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const selected = c.id === categoryId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategoryId(c.id)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                      selected ? "text-white" : "bg-gray-100 text-gray-600"
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
            <label className="text-xs text-gray-500 mb-2 block">
              立て替えた人
            </label>
            <div className="bg-gray-100 rounded-xl p-1 grid grid-cols-2 gap-1">
              {members.map((m) => {
                const selected = m.user_id === payerId;
                return (
                  <button
                    key={m.user_id}
                    onClick={() => setPayerId(m.user_id)}
                    className={`py-2.5 rounded-lg text-sm font-bold transition ${
                      selected
                        ? "bg-primary text-white"
                        : "text-gray-600"
                    }`}
                  >
                    {m.display_name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 比率プレビュー */}
          {amountNum > 0 && owner && (
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
              <div className="text-xs text-primary font-bold mb-1">
                ⚡ {Math.round(defaultRatio * 100)}:
                {Math.round((1 - defaultRatio) * 100)}で自動分割
              </div>
              <div className="text-sm">
                {owner.display_name}: {formatYen(ownerShare)} /{" "}
                {members.find((m) => m.role === "partner")?.display_name ?? "相手"}:{" "}
                {formatYen(partnerShare)}
              </div>
            </div>
          )}

          {/* メモ */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">
              メモ (任意)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="スーパーまとめ買い..."
              className="w-full px-4 py-3 rounded-xl bg-gray-100 outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* 削除ボタン (編集時のみ) */}
          {editing && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="w-full py-3 text-red-600 font-semibold border border-red-200 rounded-xl active:bg-red-50"
            >
              この支出を削除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
