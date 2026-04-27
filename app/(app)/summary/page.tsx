import { createClient } from "@/lib/supabase/server";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { ja } from "date-fns/locale";
import { calcSettlement, formatYen, type Expense } from "@/lib/calculations";

export const dynamic = "force-dynamic";

export default async function SummaryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", user.id)
    .single();
  if (!member) return null;

  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const [{ data: couple }, { data: members }, { data: expenses }, { data: categories }] =
    await Promise.all([
      supabase
        .from("couples")
        .select("default_ratio")
        .eq("id", member.couple_id)
        .single(),
      supabase
        .from("couple_members")
        .select("user_id, display_name, role")
        .eq("couple_id", member.couple_id),
      supabase
        .from("expenses")
        .select("id, date, amount, payer_user_id, ratio_override, category_id, note")
        .eq("couple_id", member.couple_id)
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd")),
      supabase
        .from("categories")
        .select("id, name, color")
        .eq("couple_id", member.couple_id),
    ]);

  const owner = members?.find((m) => m.role === "owner");
  const partner = members?.find((m) => m.role === "partner");
  const settlement = calcSettlement(
    (expenses ?? []) as Expense[],
    couple?.default_ratio ?? 0.7,
    owner?.user_id ?? "",
    partner?.user_id ?? ""
  );

  const fromMember = members?.find((m) => m.user_id === settlement.fromUserId);
  const toMember = members?.find((m) => m.user_id === settlement.toUserId);

  // カテゴリ別集計
  const byCategory = new Map<string, number>();
  for (const e of (expenses ?? []) as Expense[]) {
    byCategory.set(e.category_id, (byCategory.get(e.category_id) ?? 0) + e.amount);
  }
  const categoryRows = Array.from(byCategory.entries())
    .map(([id, amount]) => {
      const cat = categories?.find((c) => c.id === id);
      return {
        id,
        name: cat?.name ?? "未分類",
        color: cat?.color ?? "#888",
        amount,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const maxAmount = Math.max(...categoryRows.map((r) => r.amount), 1);

  return (
    <div className="max-w-md mx-auto safe-top">
      <header className="px-5 pt-6 pb-4">
        <h1 className="text-xl font-bold text-center">
          {format(today, "yyyy年M月", { locale: ja })}
        </h1>
      </header>

      {/* 精算額 */}
      <div className="mx-5 mb-6 bg-primary rounded-2xl p-6 text-center">
        <div className="text-xs text-primary-200 mb-1">今月の精算額</div>
        <div className="text-3xl font-bold text-white mb-2">
          {formatYen(settlement.settleAmount)}
        </div>
        {settlement.settleAmount > 0 ? (
          <div className="text-xs text-primary-200">
            {fromMember?.display_name ?? "?"} → {toMember?.display_name ?? "?"}
          </div>
        ) : (
          <div className="text-xs text-primary-200">精算不要</div>
        )}
      </div>

      {/* 支払い状況 */}
      <div className="mx-5 mb-6">
        <h2 className="text-sm font-bold mb-3">支払い状況</h2>
        <div className="space-y-2">
          {members?.map((m) => {
            const paid =
              m.role === "owner" ? settlement.ownerPaid : settlement.partnerPaid;
            const share =
              m.role === "owner"
                ? settlement.ownerShare
                : settlement.partnerShare;
            const delta = paid - share;
            return (
              <div key={m.user_id} className="bg-gray-100 dark:bg-zinc-800 rounded-xl p-4 flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mr-3 ${
                    m.role === "owner" ? "bg-primary" : "bg-partner"
                  }`}
                >
                  {m.display_name.slice(0, 1)}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-500 dark:text-zinc-400">立て替え総額</div>
                  <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                    {m.display_name}の分: {formatYen(share)} → {delta >= 0 ? "+" : ""}
                    {formatYen(delta)}
                  </div>
                </div>
                <div className="text-base font-bold">{formatYen(paid)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* カテゴリ別 */}
      <div className="mx-5 mb-6">
        <h2 className="text-sm font-bold mb-3">カテゴリ別内訳</h2>
        <div className="space-y-3">
          {categoryRows.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-6">
              今月の支出はまだありません
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

      <div className="mx-5 mb-8">
        <button className="w-full py-3.5 bg-primary text-white font-bold rounded-xl active:opacity-80">
          精算済みにする
        </button>
        <p className="text-[10px] text-gray-400 dark:text-zinc-500 text-center mt-2">
          ※ 履歴に記録され、来月リセットされます
        </p>
      </div>
    </div>
  );
}
