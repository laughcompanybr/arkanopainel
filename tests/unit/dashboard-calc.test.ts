import { describe, expect, it } from "vitest";
import {
  computeMonthlyBreakdown,
  orderGrossProfit,
} from "../../src/lib/dashboard-calc";

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
  it("net profit = grossProfit - expenses", () => {
    const r = computeMonthlyBreakdown({ grossProfit: 10_000, expenses: 1_500 });
    expect(r.grossProfit).toBe(10_000);
    expect(r.expenses).toBe(1_500);
    expect(r.netProfit).toBe(8_500);
  });

  it("treats negative expenses as 0 (guards against bad data)", () => {
    const r = computeMonthlyBreakdown({ grossProfit: 1_000, expenses: -500 });
    expect(r.expenses).toBe(0);
    expect(r.netProfit).toBe(1_000);
  });

  it("allows negative gross profit through", () => {
    const r = computeMonthlyBreakdown({ grossProfit: -1_000, expenses: 200 });
    expect(r.netProfit).toBe(-1_200);
  });
});
