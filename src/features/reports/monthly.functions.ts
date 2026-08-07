import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface MonthlyReportData {
  month: number;
  year: number;
  revenue: number;
  profit: number;
  profitGross: number;
  expenses: number;
  ordersCount: number;
  ordersCompleted: number;
  ordersCancelled: number;
  ordersPending: number;
  received: number;
  observations: string | null;
  orders: any[];
  expenses_list: any[];
  newClients: number;
  topProducts: any[];
  overrides: {
    revenue_override: number | null;
    expenses_override: number | null;
    profit_override: number | null;
    orders_count_override: number | null;
  };
}

/** Limites do mês em UTC — determinístico, independente do fuso do servidor. */
function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

export const getMonthlyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      month: z.number().min(1).max(12),
      year: z.number().min(2000).max(2100),
    }).parse(data)
  )
  .handler(async ({ data, context }): Promise<MonthlyReportData> => {
    const { supabase } = context;
    const { month, year } = data;

    const { startDate, endDate } = monthRange(year, month);

    const [ordersRes, paymentsRes, expensesRes, reportMetaRes, clientsRes, overridesRes] = await Promise.all([

      supabase
        .from("orders")
        .select("id, order_number, status, sale_price, cost_price, amount_received, quantity, commission, card_fee, shipping, other_costs, created_at, client_id, clients(name), brand, model")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .is("deleted_at", null),
      supabase
        .from("payments")
        .select("direction, amount, paid_at")
        .gte("paid_at", startDate.slice(0, 10))
        .lte("paid_at", endDate.slice(0, 10)),
      supabase
        .from("expenses")
        .select("id, amount, description, category, incurred_at")
        .gte("incurred_at", startDate.slice(0, 10))
        .lte("incurred_at", endDate.slice(0, 10)),
      supabase
        .from("monthly_reports")
        .select("observations")
        .eq("month", month)
        .eq("year", year)
        .maybeSingle(),
      supabase
        .from("clients")
        .select("id")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .is("deleted_at", null),
      supabase
        .from("monthly_report_overrides")
        .select("revenue_override, expenses_override, profit_override, orders_count_override")
        .eq("month", month)
        .eq("year", year)
        .maybeSingle()
    ]);

    if (ordersRes.error) throw ordersRes.error;

    const orders = ordersRes.data ?? [];
    const payments = paymentsRes.data ?? [];
    const expenses_list = expensesRes.data ?? [];

    let revenue = 0;
    let profitGross = 0;
    let received = 0;
    let ordersCompleted = 0;
    let ordersCancelled = 0;
    let ordersPending = 0;
    const productTally = new Map<string, { quantity: number; revenue: number }>();

    for (const o of orders) {
      const qty = Number(o.quantity ?? 1) || 1;
      const sale = Number(o.sale_price ?? 0) * qty;
      const cost = Number(o.cost_price ?? 0) * qty;
      const commission = Number(o.commission ?? 0);
      const cardFee = Number(o.card_fee ?? 0);
      const shipping = Number(o.shipping ?? 0);
      const otherCosts = Number(o.other_costs ?? 0);
      
      if (o.status !== 'cancelled') {
        revenue += sale;
        profitGross += (sale - cost - commission - cardFee - shipping - otherCosts);
      }
      received += Number(o.amount_received ?? 0);

      if (o.status === 'delivered') ordersCompleted++;
      else if (o.status === 'cancelled') ordersCancelled++;
      else ordersPending++;

      const label = [o.brand, o.model].filter(Boolean).join(" ") || "Sem descrição";
      const cur = productTally.get(label) ?? { quantity: 0, revenue: 0 };
      cur.quantity += qty;
      cur.revenue += sale;
      productTally.set(label, cur);
    }

    let expensesTotal = 0;
    for (const p of payments) {
      if (p.direction === "out") expensesTotal += Number(p.amount ?? 0);
    }
    for (const e of expenses_list) {
      expensesTotal += Number(e.amount ?? 0);
    }

    const topProducts = Array.from(productTally.entries())
      .map(([label, v]) => ({ label, quantity: v.quantity, revenue: v.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const ov = (overridesRes.data ?? null) as {
      revenue_override: number | null;
      expenses_override: number | null;
      profit_override: number | null;
      orders_count_override: number | null;
    } | null;

    const overrides = {
      revenue_override: ov?.revenue_override ?? null,
      expenses_override: ov?.expenses_override ?? null,
      profit_override: ov?.profit_override ?? null,
      orders_count_override: ov?.orders_count_override ?? null,
    };

    const finalRevenue = overrides.revenue_override ?? revenue;
    const finalExpenses = overrides.expenses_override ?? expensesTotal;
    const finalProfit = overrides.profit_override ?? profitGross - finalExpenses;

    return {
      month,
      year,
      revenue: Number(finalRevenue),
      profit: Number(finalProfit),
      profitGross,
      expenses: Number(finalExpenses),
      ordersCount: overrides.orders_count_override ?? orders.length,
      ordersCompleted,
      ordersCancelled,
      ordersPending,
      received,
      observations: reportMetaRes.data?.observations ?? null,
      orders,
      expenses_list,
      newClients: clientsRes.data?.length ?? 0,
      topProducts,
      overrides,
    };
  });

const nullableNumber = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  });

export const updateMonthlyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      month: z.number().min(1).max(12),
      year: z.number().min(2000).max(2100),
      observations: z.string().nullable().optional(),
      revenue_override: nullableNumber,
      expenses_override: nullableNumber,
      profit_override: nullableNumber,
      orders_count_override: nullableNumber,
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { month, year, observations, ...ov } = data;

    const { error: obsError } = await supabase
      .from("monthly_reports")
      .upsert(
        { month, year, observations: observations ?? null, updated_at: new Date().toISOString() },
        { onConflict: "month,year" },
      );
    if (obsError) throw obsError;

    const { error: ovError } = await supabase
      .from("monthly_report_overrides")
      .upsert(
        {
          month,
          year,
          revenue_override: ov.revenue_override,
          expenses_override: ov.expenses_override,
          profit_override: ov.profit_override,
          orders_count_override: ov.orders_count_override,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "month,year" },
      );
    if (ovError) throw ovError;

    return { success: true };
  });


export const getMonthlySummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ year: z.number().min(2000).max(2100) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { year } = data;

    const reports: any[] = [];
    
    const startDate = `${year}-01-01T00:00:00.000Z`;
    const endDate = `${year}-12-31T23:59:59.999Z`;

    const [ordersRes, expensesRes, paymentsRes, overridesRes] = await Promise.all([
      supabase.from("orders").select("sale_price, quantity, status, created_at, cost_price, commission, card_fee, shipping, other_costs").gte("created_at", startDate).lte("created_at", endDate).is("deleted_at", null),
      supabase.from("expenses").select("amount, incurred_at").gte("incurred_at", startDate.slice(0, 10)).lte("incurred_at", endDate.slice(0, 10)),
      supabase.from("payments").select("amount, direction, paid_at").gte("paid_at", startDate.slice(0, 10)).lte("paid_at", endDate.slice(0, 10)),
      supabase.from("monthly_report_overrides").select("month, revenue_override, expenses_override, profit_override, orders_count_override").eq("year", year),
    ]);

    const orders = ordersRes.data ?? [];
    const expensesList = expensesRes.data ?? [];
    const payments = paymentsRes.data ?? [];
    const overrides = overridesRes.data ?? [];

    for (let m = 1; m <= 12; m++) {
      const monthOrders = orders.filter(o => new Date(o.created_at).getUTCMonth() + 1 === m);
      const monthExpenses = expensesList.filter(e => {
        const d = new Date(e.incurred_at);
        return d.getUTCMonth() + 1 === m;
      });
      const monthPayments = payments.filter(p => {
        const d = new Date(p.paid_at);
        return p.direction === 'out' && d.getUTCMonth() + 1 === m;
      });

      let revenue = 0;
      let profitGross = 0;
      for (const o of monthOrders) {
        if (o.status === 'cancelled') continue;
        const qty = Number(o.quantity ?? 1);
        const sale = Number(o.sale_price ?? 0) * qty;
        revenue += sale;
        profitGross += (sale - (Number(o.cost_price ?? 0) * qty) - Number(o.commission ?? 0) - Number(o.card_fee ?? 0) - Number(o.shipping ?? 0) - Number(o.other_costs ?? 0));
      }

      const expensesTotal = monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0) + 
                          monthPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      const ov = overrides.find((o: any) => o.month === m) as any;
      const finalRevenue = ov?.revenue_override ?? revenue;
      const finalExpenses = ov?.expenses_override ?? expensesTotal;
      const finalProfit = ov?.profit_override ?? profitGross - finalExpenses;

      reports.push({
        month: m,
        ordersCount: ov?.orders_count_override ?? monthOrders.length,
        revenue: Number(finalRevenue),
        expenses: Number(finalExpenses),
        profit: Number(finalProfit),
      });
    }


    return reports;
  });
