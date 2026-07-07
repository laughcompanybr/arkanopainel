/**
 * Pure calculation helpers for the monthly dashboard/finance summary.
 * Extracted so they can be unit-tested independently of Supabase / SSR.
 */

/**
 * Clamp a tax percent value to a valid 0..100 range.
 * Non-numeric or negative values fall back to 0; anything above 100 is capped.
 * Used as the last-line-of-defense before applying tax in the dashboard/finance.
 */
export function clampTaxPercent(input: unknown, fallback = 0): number {
  if (input === null || input === undefined || input === "") {
    const fb = typeof fallback === "number" && Number.isFinite(fallback) ? fallback : 0;
    if (fb < 0) return 0;
    if (fb > 100) return 100;
    return fb;
  }
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) {
    const fb = typeof fallback === "number" && Number.isFinite(fallback) ? fallback : 0;
    if (fb < 0) return 0;
    if (fb > 100) return 100;
    return fb;
  }
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

export interface ClampResult {
  /** The safe 0..100 value actually used. */
  percent: number;
  /** True when the raw input was outside 0..100 or non-numeric. */
  clamped: boolean;
  /** Original raw input, coerced to number when possible; otherwise null. */
  rawPercent: number | null;
}

/**
 * Same as {@link clampTaxPercent} but also reports whether a correction happened,
 * so the UI can surface an "we corrected this automatically" warning.
 */
export function clampTaxPercentWithInfo(input: unknown, fallback = 0): ClampResult {
  const rawNumeric =
    typeof input === "number"
      ? input
      : input === null || input === undefined || input === ""
        ? null
        : Number(input);
  const rawPercent = rawNumeric !== null && Number.isFinite(rawNumeric) ? rawNumeric : null;
  const percent = clampTaxPercent(input, fallback);
  const clamped = rawPercent === null || rawPercent !== percent;
  return { percent, clamped, rawPercent };
}




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
 * Gross profit contribution of a single order line (before expenses/tax).
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
  /** Sum of gross profits (sale - cost - commission - fees - shipping - other) for the month. */
  grossProfit: number;
  /** Sum of expenses/payables in the month. */
  expenses: number;
  /** Tax percent (0..100). Values outside the range are clamped. */
  taxPercent: number;
}

export interface MonthlyBreakdown {
  grossProfit: number;
  expenses: number;
  /** Clamped tax rate actually applied. */
  taxRate: number;
  /** Tax amount = max(grossProfit, 0) * taxRate/100. Never negative. */
  taxAmount: number;
  /** Final net profit = grossProfit - expenses - taxAmount. */
  netProfit: number;
}

/**
 * Compute the monthly breakdown consistently for dashboard + finance surfaces.
 * Tax is only applied when the gross profit is positive.
 */
export function computeMonthlyBreakdown(
  input: MonthlyBreakdownInput,
): MonthlyBreakdown {
  const grossProfit = Number.isFinite(input.grossProfit) ? input.grossProfit : 0;
  const expenses = Math.max(0, Number.isFinite(input.expenses) ? input.expenses : 0);
  const taxRate = clampTaxPercent(input.taxPercent);
  const taxAmount = Math.max(grossProfit, 0) * (taxRate / 100);
  const netProfit = grossProfit - expenses - taxAmount;
  return { grossProfit, expenses, taxRate, taxAmount, netProfit };
}
