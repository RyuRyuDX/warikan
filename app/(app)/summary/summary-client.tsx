"use client";

import { useEffect, useMemo, useState } from "react";
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { ja } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { calcSettlement, formatYen, type Expense } from "@/lib/calculations";

type Member = { user_id: string; display_name: string; role: "owner" | "partner" };
type Category = { id: string; name: string; color: string };

export default function SummaryClient({
  coupleId,
  defaultRatio,
  members,
  categories,
}: {
  coupleId: string;
  defaultRatio: number;
  members: Member[];
  categories: Category[];
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);

  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);

  useEffect(() => {
    const supabase = createClient();
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("expenses")
        .select("id, date, amount, payer_user_id, ratio_override, category_id, note")
        .eq("couple_id", coupleId)
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"));
      setExpenses(data ?? []);
      setLoading(false);
    })();
  }, [coupleId, monthStart, monthEnd]);

  const owner = members.find((m) => m.role === "owner");
  const partner = members.find((m) => m.role === "partner");

  const settlement = useMemo(
    () =>
      calcSettlement(
        expenses,
        defaultRatio,
        owner?.user_id ?? "",
        partner?.user_id ?? "",
      ),
    [expenses, defaultRatio, owner?.user_id, partner?.user_id],
  );

  const fromMember = members.find((m) => m.user_id === settlement.fromUserId);
  const toMember = members.find((m) => m.user_id === settlement.toUserId);

  // カテゴリ別集計
  const categoryRows = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const e of expenses) {
      byCategory.set(e.category_id, (byCategory.get(e.category_id) ?? 0) + e.amount);
    }
    return Array.from(byCategory.entries())
      .map(([id, amount]) => {
        const cat = categories.find((c) => c.id === id);
        return {
          id,
          name: cat?.name ?? "未分類",
          color: cat?.color ?? "#888",
          amount,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, categories]);

  const maxAmount = Math.max(...categoryRows.map((r) => r.amount), 1);

  return (
    <div className="max-w-md mx-auto safe-top">
      {/* ヘッダー: 月切替 */}
      <header className="flex items-center justify-between px-5 pt-6 pb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="text-2xl text-gray-400 dark:text-zinc-500 px-2"
          aria-label="前の月"
        >
          ‹
        </button>
        <h1 className="text-xl font-bold">
          {format(currentMonth, "yyyy年M月", { locale: ja })}
        </h1>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="text-2xl text-gray-400 dark:text-zinc-500 px-2"
          aria-label="次の月"
        >
          ›
        </button>
      </header>

      {/* 精算額 */}
      <div className="mx-5 mb-6 bg-primary rounded-2xl p-6 text-center">
        <div className="text-xs text-primary-200 mb-1">今月の精算額</div>
        <div className="text-3xl font-bold text-white mb-2">
          {formatYen(settlement.settleAmount)}
        </div>
        {settlement.settleAmount > 0 && fromMember && toMember ? (
          <div className="text-xs text-primary-200">
            {fromMember.display_name} が {toMember.display_name} に支払う
          </div>
        ) : (
          <div className="text-xs text-primary-200">精算は不要だよ</div>
        )}
      </div>

      {/* それぞれの状況 */}
      <div className="mx-5 mb-6">
        <h2 className="text-sm font-bold mb-3">それぞれの状況</h2>
        <div className="space-y-2">
          {members.map((m) => {
            const paid =
              m.role === "owner" ? settlement.ownerPaid : settlement.partnerPaid;
            const share =
              m.role === "owner" ? settlement.ownerShare : settlement.partnerShare;
            const delta = paid - share;
            // delta > 0: 払いすぎ → 受け取る側 / delta < 0: 払い不足 → 渡す側
            return (
              <div
                key={m.user_id}
                className="bg-gray-100 dark:bg-zinc-800 rounded-xl p-4"
              >
                <div className="flex items-center mb-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold mr-3 ${
                      m.role === "owner" ? "bg-primary" : "bg-partner"
                    }`}
                  >
                    {m.display_name.slice(0, 1)}
                  </div>
                  <div className="text-sm font-bold">{m.display_name}</div>
                </div>
                <div className="space-y-1.5 text-sm pl-12">
                  <Row
                    label="払った金額"
                    value={formatYen(paid)}
                  />
                  <Row
                    label="本来の負担分"
                    value={formatYen(share)}
                    muted
                  />
                  <div className="flex justify-between items-baseline pt-1 border-t border-gray-200 dark:border-zinc-700">
                    <span className="text-xs text-gray-500 dark:text-zinc-400">
                      差額
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        delta > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : delta < 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-gray-500 dark:text-zinc-400"
                      }`}
                    >
                      {delta === 0
                        ? "ぴったり"
                        : delta > 0
                          ? `+${formatYen(delta)} 多く払った`
                          : `${formatYen(delta)} 払い足りない`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* カテゴリ別 */}
      <div className="mx-5 mb-10">
        <h2 className="text-sm font-bold mb-3">カテゴリ別の内訳</h2>
        <div className="space-y-3">
          {loading && expenses.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-6">
              読み込み中...
            </p>
          ) : categoryRows.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-6">
              この月の支出はまだありません
            </p>
          ) : (
            categoryRows.map((r) => (
              <div key={r.id}>
                <div className="flex justify-between text-sm mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: r.color }}
                    />
                    <span>{r.name}</span>
                  </div>
                  <span className="text-gray-600 dark:text-zinc-300 font-semibold">
                    {formatYen(r.amount)}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(r.amount / maxAmount) * 100}%`,
                      backgroundColor: r.color,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-xs text-gray-500 dark:text-zinc-400">{label}</span>
      <span
        className={`text-sm ${
          muted
            ? "text-gray-600 dark:text-zinc-300"
            : "font-semibold"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
