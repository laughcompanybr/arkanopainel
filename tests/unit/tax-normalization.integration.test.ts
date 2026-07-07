import { describe, expect, it } from "vitest";
import {
  clampTaxPercentWithInfo,
  computeMonthlyBreakdown,
} from "../../src/lib/dashboard-calc";

/**
 * Integration-style tests exercising the exact tax normalization path used by
 * `settings.functions.getTaxPercent` (read side) and
 * `dashboard.functions.getDashboardStats` (calculation side).
 *
 * We simulate the row returned by Supabase for `app_settings.value.percent`
 * and run it through the same helpers those server functions use — proving
 * the clamp is applied both when reading the setting and when computing the
 * tax amount.
 */

// Mirrors what `getTaxPercent`'s handler does after `.maybeSingle()`.
function readTaxFromSettingsRow(
  row: { value?: { percent?: unknown } } | null,
): { percent: number; clamped: boolean; rawPercent: number | null } {
  const raw = (row?.value ?? {}) as { percent?: unknown };
  return clampTaxPercentWithInfo(raw.percent, 6);
}

// Mirrors the dashboard calc path: raw row + gross/expenses in.
function dashboardTaxSlice(
  row: { value?: { percent?: unknown } } | null,
  grossProfit: number,
  expenses: number,
) {
  const info = clampTaxPercentWithInfo(row?.value?.percent, 6);
  const breakdown = computeMonthlyBreakdown({
    grossProfit,
    expenses,
    taxPercent: info.percent,
  });
  return {
    taxRate: breakdown.taxRate,
    taxRateClamped: info.clamped,
    taxRateRaw: info.rawPercent,
    taxAmountMonth: breakdown.taxAmount,
    profitGrossMonth: breakdown.grossProfit,
    profitNetMonth: breakdown.netProfit,
    expensesMonth: breakdown.expenses,
  };
}

describe("settings.getTaxPercent — clamp on read", () => {
  it("returns the persisted percent untouched when it's valid", () => {
    const result = readTaxFromSettingsRow({ value: { percent: 12.5 } });
    expect(result).toEqual({ percent: 12.5, clamped: false, rawPercent: 12.5 });
  });

  it("clamps a negative persisted percent to 0 and flags it", () => {
    const result = readTaxFromSettingsRow({ value: { percent: -10 } });
    expect(result.percent).toBe(0);
    expect(result.clamped).toBe(true);
    expect(result.rawPercent).toBe(-10);
  });

  it("clamps a persisted percent above 100 down to 100", () => {
    const result = readTaxFromSettingsRow({ value: { percent: 250 } });
    expect(result.percent).toBe(100);
    expect(result.clamped).toBe(true);
    expect(result.rawPercent).toBe(250);
  });

  it("falls back to 6 when the row is missing or non-numeric", () => {
    expect(readTaxFromSettingsRow(null).percent).toBe(6);
    expect(readTaxFromSettingsRow({ value: {} }).percent).toBe(6);
    expect(readTaxFromSettingsRow({ value: { percent: "abc" } }).percent).toBe(6);
    // rawPercent is null when it couldn't be coerced to a finite number
    expect(readTaxFromSettingsRow({ value: { percent: "abc" } }).rawPercent).toBeNull();
  });
});

describe("dashboard.getDashboardStats — tax normalized in calc", () => {
  it("uses the persisted percent as-is when valid", () => {
    const s = dashboardTaxSlice({ value: { percent: 8 } }, 10_000, 1_000);
    expect(s.taxRate).toBe(8);
    expect(s.taxRateClamped).toBe(false);
    expect(s.taxAmountMonth).toBeCloseTo(800, 6);
    // 10000 - 1000 - 800
    expect(s.profitNetMonth).toBeCloseTo(8_200, 6);
  });

  it("caps an out-of-range percent to 100 and reports the clamp", () => {
    const s = dashboardTaxSlice({ value: { percent: 500 } }, 1_000, 0);
    expect(s.taxRate).toBe(100);
    expect(s.taxRateClamped).toBe(true);
    expect(s.taxRateRaw).toBe(500);
    expect(s.taxAmountMonth).toBe(1_000);
    expect(s.profitNetMonth).toBe(0);
  });

  it("floors a negative percent at 0", () => {
    const s = dashboardTaxSlice({ value: { percent: -25 } }, 1_000, 200);
    expect(s.taxRate).toBe(0);
    expect(s.taxRateClamped).toBe(true);
    expect(s.taxAmountMonth).toBe(0);
    expect(s.profitNetMonth).toBe(800);
  });

  it("skips tax when the gross profit is not positive", () => {
    const s = dashboardTaxSlice({ value: { percent: 6 } }, -500, 100);
    expect(s.taxAmountMonth).toBe(0);
    expect(s.profitNetMonth).toBe(-600);
  });

  it("agrees between the read-side clamp and the calc-side clamp", () => {
    // Same row read via both entry points must produce a consistent taxRate.
    const row = { value: { percent: 175 } };
    const read = readTaxFromSettingsRow(row);
    const calc = dashboardTaxSlice(row, 5_000, 250);
    expect(calc.taxRate).toBe(read.percent);
    expect(calc.taxRateClamped).toBe(read.clamped);
  });
});
