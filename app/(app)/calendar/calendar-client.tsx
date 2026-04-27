"use client";

import { useState, useEffect, useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  format,
  addMonths,
  subMonths,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  getDay,
} from "date-fns";
import { ja } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { calcSettlement, formatYen, type Expense } from "@/lib/calculations";
import ExpenseModal from "./expense-modal";

type Member = { user_id: string; display_name: string; role: "owner" | "partner" };
type Category = { id: string; name: string; color: string };

export default function CalendarClient({
  currentUserId,
  coupleId,
  defaultRatio,
  members,
  categories,
}: {
  currentUserId: string;
  coupleId: string;
  defaultRatio: number;
  members: Member[];
  categories: Category[];
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);

  const owner = members.find((m) => m.role === "owner");
  const partner = members.find((m) => m.role === "partner");
  const me = members.find((m) => m.user_id === currentUserId);
  const other = members.find((m) => m.user_id !== currentUserId);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // 月の支出を取得
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("expenses")
        .select("id, date, amount, payer_user_id, ratio_override, category_id")
        .eq("couple_id", coupleId)
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"))
        .order("date");
      setExpenses(data ?? []);
    })();
  }, [coupleId, currentMonth, monthStart, monthEnd]);

  // 月次サマリー計算
  const settlement = useMemo(() => {
    if (!owner || !partner) return null;
    return calcSettlement(expenses, defaultRatio, owner.user_id, partner.user_id);
  }, [expenses, defaultRatio, owner, partner]);

  // 自分視点の負担額（meがowner なら ownerBurden、partner なら partnerBurden）
  const myBurden = useMemo(() => {
    if (!settlement || !me) return 0;
    return me.role === "owner" ? settlement.ownerBurden : settlement.partnerBurden;
  }, [settlement, me]);

  const otherBurden = useMemo(() => {
    if (!settlement || !other) return 0;
    return other.role === "owner" ? settlement.ownerBurden : settlement.partnerBurden;
  }, [settlement, other]);

  // 日付ごとの支出合計とカテゴリ
  const expensesByDate = useMemo(() => {
    const map = new Map<string, { total: number; categoryId: string }>();
    for (const e of expenses) {
      const existing = map.get(e.date);
      map.set(e.date, {
        total: (existing?.total ?? 0) + e.amount,
        categoryId: existing?.categoryId ?? e.category_id,
      });
    }
    return map;
  }, [expenses]);

  // カレンダーグリッド（前月末〜翌月頭含む）
  const days = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 0 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 0 }),
    });
  }, [monthStart, monthEnd]);

  const myRatio = me?.role === "owner" ? defaultRatio : 1 - defaultRatio;

  function openAddModal(date?: Date) {
    setSelectedDate(date ?? new Date());
    setEditing(null);
    setModalOpen(true);
  }

  function openEditModal(expense: Expense) {
    setEditing(expense);
    setSelectedDate(new Date(expense.date));
    setModalOpen(true);
  }

  async function handleSaved() {
    setModalOpen(false);
    // 再取得
    const supabase = createClient();
    const { data } = await supabase
      .from("expenses")
      .select("id, date, amount, payer_user_id, ratio_override, category_id")
      .eq("couple_id", coupleId)
      .gte("date", format(monthStart, "yyyy-MM-dd"))
      .lte("date", format(monthEnd, "yyyy-MM-dd"))
      .order("date");
    setExpenses(data ?? []);
  }

  // 選択日の支出
  const selectedDayExpenses = selectedDate
    ? expenses.filter((e) => isSameDay(new Date(e.date), selectedDate))
    : [];

  return (
    <div className="max-w-md mx-auto safe-top">
      {/* ヘッダー: 月切り替え */}
      <header className="flex items-center justify-between px-5 pt-6 pb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="text-2xl text-gray-400 px-2"
          aria-label="前の月"
        >
          ‹
        </button>
        <h1 className="text-xl font-bold">
          {format(currentMonth, "yyyy年M月", { locale: ja })}
        </h1>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="text-2xl text-gray-400 px-2"
          aria-label="次の月"
        >
          ›
        </button>
      </header>

      {/* サマリーカード */}
      <div className="mx-5 mb-6 bg-gray-100 rounded-2xl p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">今月の支出合計</div>
            <div className="text-2xl font-bold">
              {formatYen(settlement?.total ?? 0)}
            </div>
          </div>
          <div className="border-l border-gray-300 pl-4">
            <div className="text-xs text-gray-500 mb-1">
              あなたの負担 ({Math.round(myRatio * 100)}%)
            </div>
            <div className="text-xl font-bold text-primary">
              {formatYen(myBurden)}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {other?.display_name ?? "相手"}: {formatYen(otherBurden)}
            </div>
          </div>
        </div>
      </div>

      {/* 曜日 */}
      <div className="grid grid-cols-7 px-3 mb-2">
        {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
          <div
            key={d}
            className={`text-center text-xs font-bold ${
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 px-3 gap-y-2 mb-6">
        {days.map((d) => {
          const dateStr = format(d, "yyyy-MM-dd");
          const expense = expensesByDate.get(dateStr);
          const inMonth = isSameMonth(d, currentMonth);
          const isToday = isSameDay(d, new Date());
          const isSelected = selectedDate && isSameDay(d, selectedDate);
          const dayOfWeek = getDay(d);
          const dayColor =
            !inMonth
              ? "text-gray-300"
              : dayOfWeek === 0
                ? "text-red-500"
                : dayOfWeek === 6
                  ? "text-blue-500"
                  : "text-gray-800";
          const category = expense
            ? categories.find((c) => c.id === expense.categoryId)
            : null;

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(d)}
              className="flex flex-col items-center pt-1 pb-1 active:opacity-60"
            >
              <span
                className={`flex items-center justify-center w-7 h-7 text-sm rounded-full ${
                  isToday
                    ? "bg-primary text-white font-bold"
                    : isSelected && inMonth
                      ? "bg-primary-100 text-primary font-bold"
                      : dayColor
                }`}
              >
                {format(d, "d")}
              </span>
              {expense && inMonth && (
                <span
                  className="text-[9px] font-semibold mt-1 px-1 rounded"
                  style={{
                    backgroundColor: (category?.color ?? "#888") + "30",
                    color: category?.color ?? "#666",
                  }}
                >
                  {formatYen(expense.total)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-3 px-5 mb-4">
        {categories.slice(0, 6).map((c) => (
          <div key={c.id} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: c.color }}
            />
            <span className="text-xs text-gray-600">{c.name}</span>
          </div>
        ))}
      </div>

      {/* 選択日の支出一覧 */}
      {selectedDate && selectedDayExpenses.length > 0 && (
        <div className="mx-5 mb-6">
          <h3 className="text-sm font-bold mb-2 text-gray-700">
            {format(selectedDate, "M月d日 (E)", { locale: ja })}
          </h3>
          <div className="space-y-2">
            {selectedDayExpenses.map((e) => {
              const cat = categories.find((c) => c.id === e.category_id);
              const payer = members.find((m) => m.user_id === e.payer_user_id);
              return (
                <button
                  key={e.id}
                  onClick={() => openEditModal(e)}
                  className="w-full flex items-center bg-white rounded-xl p-3 active:opacity-70"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full mr-3"
                    style={{ backgroundColor: cat?.color ?? "#888" }}
                  />
                  <div className="flex-1 text-left">
                    <div className="text-sm font-semibold">{cat?.name}</div>
                    <div className="text-xs text-gray-500">
                      {payer?.display_name ?? "?"}が立て替え
                    </div>
                  </div>
                  <div className="text-base font-bold">
                    {formatYen(e.amount)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => openAddModal(selectedDate ?? undefined)}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-primary text-white text-3xl font-light shadow-lg active:opacity-80 flex items-center justify-center"
        aria-label="支出を追加"
      >
        +
      </button>

      {/* 入力モーダル */}
      {modalOpen && (
        <ExpenseModal
          coupleId={coupleId}
          currentUserId={currentUserId}
          members={members}
          categories={categories}
          defaultRatio={defaultRatio}
          initialDate={selectedDate ?? new Date()}
          editing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
