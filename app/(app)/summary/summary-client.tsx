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
  const [showOverrides, setShowOverrides] = useState(false);

  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);

  useEffect(() => {
    const supabase = createClient();
    setLoading(true);
    setShowOverrides(false);
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

  const ownerPct = Math.round(defaultRatio * 100);
  const partnerPct = 100 - ownerPct;

  const overrideExpenses = useMemo(
    () =>
      expenses
        .filter((e) => e.ratio_override !== null)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [expenses],
  );

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
  const hasOverrides = overrideExpenses.length > 0;
  const hasExpenses = expenses.length > 0;

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

      {/* それぞれの支払い */}
      <div className="mx-5 mb-6">
        <h2 className="text-sm font-bold mb-3">それぞれの支払い</h2>
        <div className="bg-gray-100 dark:bg-zinc-800 rounded-2xl divide-y divide-white dark:divide-zinc-700">
          {members.map((m) => {
            const paid =
              m.role === "owner" ? settlement.ownerPaid : settlement.partnerPaid;
            return (
              <div key={m.user_id} className="flex items-center p-4">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold mr-3 ${
                    m.role === "owner" ? "bg-primary" : "bg-partner"
                  }`}
                >
                  {m.display_name.slice(0, 1)}
                </div>
                <div className="flex-1 text-sm font-semibold">
                  {m.display_name}
                </div>
                <div className="text-base font-bold">{formatYen(paid)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 今月の総額 */}
      <div className="mx-5 mb-6 bg-gray-100 dark:bg-zinc-800 rounded-2xl p-5">
        <div className="text-xs text-gray-500 dark:text-zinc-400 mb-1">
          今月の総額
        </div>
        <div className="text-3xl font-bold mb-2">
          {formatYen(settlement.total)}
        </div>
        {hasOverrides ? (
          <button
            onClick={() => setShowOverrides((v) => !v)}
            className="flex items-center gap-1 text-xs text-gray-600 dark:text-zinc-300 active:opacity-60"
            aria-expanded={showOverrides}
          >
            <span>
              比率 {ownerPct} : {partnerPct} で分けると
            </span>
            <span
              className={`transition-transform inline-block ${
                showOverrides ? "rotate-90" : ""
              }`}
              aria-hidden
            >
              ›
            </span>
          </button>
        ) : (
          <div className="text-xs text-gray-600 dark:text-zinc-300">
            比率 {ownerPct} : {partnerPct} で分けると
          </div>
        )}

        {hasOverrides && showOverrides && owner && partner && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-700">
            <div className="text-xs text-gray-500 dark:text-zinc-400 mb-2">
              個別に比率を変えた支出 ({overrideExpenses.length} 件)
            </div>
            <ul className="space-y-2 text-xs">
              {overrideExpenses.map((e) => {
                const cat = categories.find((c) => c.id === e.category_id);
                return (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-gray-500 dark:text-zinc-400 tabular-nums">
                        {format(new Date(e.date), "M/d")}
                      </span>
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat?.color ?? "#888" }}
                      />
                      <span className="truncate">{cat?.name ?? "未分類"}</span>
                      <span className="text-gray-500 dark:text-zinc-400 tabular-nums">
                        {formatYen(e.amount)}
                      </span>
                    </div>
                    <span className="text-gray-700 dark:text-zinc-200 shrink-0">
                      {formatOverride(e.ratio_override!, owner, partner)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* 精算 */}
      {hasExpenses && (
        <div className="mx-5 mb-6 bg-primary rounded-2xl p-6 text-center">
          <div className="text-xs text-primary-200 mb-2">精算</div>
          {settlement.settleAmount > 0 && fromMember && toMember ? (
            <>
              <div className="text-sm text-primary-200 mb-1">
                「{fromMember.display_name}」が「{toMember.display_name}」に
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {formatYen(settlement.settleAmount)}
              </div>
              <div className="text-xs text-primary-200">を渡すと精算完了</div>
            </>
          ) : (
            <div className="text-sm font-bold text-white">
              今月はぴったり。精算なし。
            </div>
          )}
        </div>
      )}

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

function formatOverride(
  override: number,
  owner: Member,
  partner: Member,
): string {
  if (override === 0.5) return "折半 50:50";
  if (override === 1) return `「${owner.display_name}」が全額`;
  if (override === 0) return `「${partner.display_name}」が全額`;
  const ownerPct = Math.round(override * 100);
  return `${ownerPct} : ${100 - ownerPct}`;
}
