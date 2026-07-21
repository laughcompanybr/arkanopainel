/**
 * Pure calculation helpers for the monthly dashboard/finance summary.
 * Extracted so they can be unit-tested independently of Supabase / SSR.
 */

export interface OrderForProfit {
  quantity?: number | null;
  sale_price?: number | null;
  cost_price?: number | null;
  commission?: number | null;
  card_fee?: number | null;
  shipping?: number | null;
  other_costs?: number | null;
  status?: string | null;
}

/**
 * Gross profit contribution of a single order line (before expenses).
 * Cancelled orders always contribute 0.
 */
export function orderGrossProfit(o: OrderForProfit): number {
  if (String(o.status ?? "") === "cancelled") return 0;
  const qty = Number(o.quantity ?? 1) || 1;
  const sale = Number(o.sale_price ?? 0) * qty;
  const cost = Number(o.cost_price ?? 0) * qty;
  const commission = Number(o.commission ?? 0);
  const cardFee = Number(o.card_fee ?? 0);
  const shipping = Number(o.shipping ?? 0);
  const otherCosts = Number(o.other_costs ?? 0);
  return sale - cost - commission - cardFee - shipping - otherCosts;
}

export interface MonthlyBreakdownInput {
  grossProfit: number;
  expenses: number;
}

export interface MonthlyBreakdown {
  grossProfit: number;
  expenses: number;
  netProfit: number;
}

/**
 * Compute the monthly breakdown consistently for dashboard + finance surfaces.
 */
export function computeMonthlyBreakdown(
  input: MonthlyBreakdownInput,
): MonthlyBreakdown {
  const grossProfit = Number.isFinite(input.grossProfit) ? input.grossProfit : 0;
  const expenses = Math.max(0, Number.isFinite(input.expenses) ? input.expenses : 0);
  const netProfit = grossProfit - expenses;
  return { grossProfit, expenses, netProfit };
}
