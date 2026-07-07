import { describe, expect, it } from "vitest";
import {
  clampTaxPercent,
  computeMonthlyBreakdown,
  orderGrossProfit,
} from "../../src/lib/dashboard-calc";


describe("clampTaxPercent", () => {
  it("returns the value when within 0..100", () => {
    expect(clampTaxPercent(0)).toBe(0);
    expect(clampTaxPercent(6)).toBe(6);
    expect(clampTaxPercent(100)).toBe(100);
    expect(clampTaxPercent(12.5)).toBe(12.5);
  });

  it("clamps negative and above-100 values", () => {
    expect(clampTaxPercent(-5)).toBe(0);
    expect(clampTaxPercent(250)).toBe(100);
  });

  it("uses fallback for non-numeric input", () => {
    expect(clampTaxPercent(undefined, 6)).toBe(6);
    expect(clampTaxPercent(null, 6)).toBe(6);
    expect(clampTaxPercent("abc", 6)).toBe(6);
    expect(clampTaxPercent(Number.NaN, 6)).toBe(6);
  });

  it("clamps the fallback itself", () => {
    expect(clampTaxPercent("bad", -1)).toBe(0);
    expect(clampTaxPercent("bad", 500)).toBe(100);
  });
});

describe("orderGrossProfit", () => {
  it("computes sale*qty - cost*qty - commission - card_fee - shipping - other_costs", () => {
    const profit = orderGrossProfit({
      quantity: 2,
      sale_price: 1000,
      cost_price: 400,
      commission: 50,
      card_fee: 30,
      shipping: 20,
      other_costs: 10,
    });
    // 2000 - 800 - 50 - 30 - 20 - 10 = 1090
    expect(profit).toBe(1090);
  });

  it("returns 0 for cancelled orders regardless of numbers", () => {
    expect(
      orderGrossProfit({
        quantity: 1,
        sale_price: 5000,
        cost_price: 0,
        status: "cancelled",
      }),
    ).toBe(0);
  });

  it("defaults missing fields to 0 and quantity to 1", () => {
    expect(orderGrossProfit({ sale_price: 100, cost_price: 40 })).toBe(60);
    expect(orderGrossProfit({})).toBe(0);
  });
});

describe("computeMonthlyBreakdown", () => {
  it("applies the configured tax rate over the gross profit", () => {
    const r = computeMonthlyBreakdown({
      grossProfit: 10_000,
      expenses: 1_500,
      taxPercent: 6,
    });
    expect(r.grossProfit).toBe(10_000);
    expect(r.expenses).toBe(1_500);
    expect(r.taxRate).toBe(6);
    expect(r.taxAmount).toBeCloseTo(600, 6);
    // 10000 - 1500 - 600 = 7900
    expect(r.netProfit).toBeCloseTo(7_900, 6);
  });

  it("keeps net profit consistent when there are no expenses", () => {
    const r = computeMonthlyBreakdown({
      grossProfit: 5_000,
      expenses: 0,
      taxPercent: 10,
    });
    expect(r.taxAmount).toBeCloseTo(500, 6);
    expect(r.netProfit).toBeCloseTo(4_500, 6);
  });

  it("does not charge tax on a negative gross profit", () => {
    const r = computeMonthlyBreakdown({
      grossProfit: -1_000,
      expenses: 200,
      taxPercent: 6,
    });
    expect(r.taxAmount).toBe(0);
    // -1000 - 200 - 0
    expect(r.netProfit).toBe(-1_200);
  });

  it("clamps an out-of-range tax percent before applying", () => {
    const high = computeMonthlyBreakdown({
      grossProfit: 1_000,
      expenses: 0,
      taxPercent: 250,
    });
    expect(high.taxRate).toBe(100);
    expect(high.taxAmount).toBe(1_000);
    expect(high.netProfit).toBe(0);

    const low = computeMonthlyBreakdown({
      grossProfit: 1_000,
      expenses: 0,
      taxPercent: -20,
    });
    expect(low.taxRate).toBe(0);
    expect(low.taxAmount).toBe(0);
    expect(low.netProfit).toBe(1_000);
  });

  it("treats negative expenses as 0 (guards against bad data)", () => {
    const r = computeMonthlyBreakdown({
      grossProfit: 1_000,
      expenses: -500,
      taxPercent: 0,
    });
    expect(r.expenses).toBe(0);
    expect(r.netProfit).toBe(1_000);
  });

  it("net profit equals grossProfit - expenses - tax for a range of inputs", () => {
    const cases = [
      { grossProfit: 0, expenses: 0, taxPercent: 6 },
      { grossProfit: 12_345.67, expenses: 234.5, taxPercent: 8.25 },
      { grossProfit: 999.99, expenses: 100, taxPercent: 15 },
    ];
    for (const c of cases) {
      const r = computeMonthlyBreakdown(c);
      const expectedTax = Math.max(c.grossProfit, 0) * (c.taxPercent / 100);
      expect(r.taxAmount).toBeCloseTo(expectedTax, 6);
      expect(r.netProfit).toBeCloseTo(c.grossProfit - c.expenses - expectedTax, 6);
    }
  });
});
