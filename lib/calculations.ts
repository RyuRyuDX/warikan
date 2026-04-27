export type Expense = {
  id: string;
  date: string;
  amount: number;
  payer_user_id: string;
  ratio_override: number | null;
  category_id: string;
};

export type CoupleMember = {
  user_id: string;
  display_name: string;
  role: "owner" | "partner";
};

export type SettlementResult = {
  total: number;
  ownerPaid: number;
  partnerPaid: number;
  ownerShare: number;
  partnerShare: number;
  ownerDelta: number;
  partnerDelta: number;
  settleAmount: number;
  fromUserId: string | null;
  toUserId: string | null;
};

/**
 * 月次精算を計算
 * @param expenses 該当月の支出
 * @param defaultRatio owner（自分）の分担比率（0-1）
 * @param ownerId owner の user_id
 * @param partnerId partner の user_id
 */
export function calcSettlement(
  expenses: Expense[],
  defaultRatio: number,
  ownerId: string,
  partnerId: string
): SettlementResult {
  let ownerPaid = 0;
  let partnerPaid = 0;
  let ownerShare = 0;
  let partnerShare = 0;

  for (const e of expenses) {
    const ratio = e.ratio_override ?? defaultRatio;
    const ownerOf = Math.round(e.amount * ratio);
    const partnerOf = e.amount - ownerOf;

    ownerShare += ownerOf;
    partnerShare += partnerOf;

    if (e.payer_user_id === ownerId) {
      ownerPaid += e.amount;
    } else if (e.payer_user_id === partnerId) {
      partnerPaid += e.amount;
    }
  }

  const ownerDelta = ownerPaid - ownerShare;
  const partnerDelta = partnerPaid - partnerShare;

  let settleAmount = 0;
  let fromUserId: string | null = null;
  let toUserId: string | null = null;

  if (ownerDelta > 0) {
    settleAmount = ownerDelta;
    fromUserId = partnerId;
    toUserId = ownerId;
  } else if (ownerDelta < 0) {
    settleAmount = -ownerDelta;
    fromUserId = ownerId;
    toUserId = partnerId;
  }

  return {
    total: ownerPaid + partnerPaid,
    ownerPaid,
    partnerPaid,
    ownerShare,
    partnerShare,
    ownerDelta,
    partnerDelta,
    settleAmount,
    fromUserId,
    toUserId,
  };
}

export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}
