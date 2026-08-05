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
  overrides?: {
    revenue_override: number | null;
    expenses_override: number | null;
    profit_override: number | null;
    orders_count_override: number | null;
  };
}

// Logic extracted for reuse
export async function fetchMonthlyReport(supabase: any, month: number, year: number): Promise<MonthlyReportData> {
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

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
      .from("monthly_report_overrides" as any)
      .select("revenue_override, expenses_override, profit_override, orders_count_override")
      .eq("month" as any, month as any)
      .eq("year" as any, year as any)
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

  const overrides = overridesRes.data;
  
  // Safe field check
  const revenue_override = overrides?.revenue_override;
  const expenses_override = overrides?.expenses_override;
  const profit_override = overrides?.profit_override;
  const orders_count_override = overrides?.orders_count_override;

  const finalRevenue = (revenue_override !== null && revenue_override !== undefined) ? Number(revenue_override) : revenue;
  const finalExpenses = (expenses_override !== null && expenses_override !== undefined) ? Number(expenses_override) : expensesTotal;
  const finalProfit = (profit_override !== null && profit_override !== undefined) ? Number(profit_override) : (profitGross - expensesTotal);
  const finalOrdersCount = (orders_count_override !== null && orders_count_override !== undefined) ? Number(orders_count_override) : orders.length;

  return {
    month,
    year,
    revenue: finalRevenue,
    profit: finalProfit,
    profitGross,
    expenses: finalExpenses,
    ordersCount: finalOrdersCount,
    ordersCompleted,
    ordersCancelled,
    ordersPending,
    received,
    observations: reportMetaRes.data?.observations ?? null,
    orders,
    expenses_list,
    newClients: clientsRes.data?.length ?? 0,
    topProducts,
    overrides: overrides ? {
      revenue_override: overrides.revenue_override,
      expenses_override: overrides.expenses_override,
      profit_override: overrides.profit_override,
      orders_count_override: overrides.orders_count_override
    } : undefined
  };
}

export const getMonthlyReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => 
    z.object({ 
      month: z.number().min(1).max(12), 
      year: z.number().min(2000).max(2100)
    }).parse(data)
  )
  .handler(async ({ data, context }): Promise<MonthlyReportData> => {
    try {
      return await fetchMonthlyReport(context.supabase, data.month, data.year);
    } catch (error) {
      console.error(`[getMonthlyReport Error] ${data.month}/${data.year}:`, error);
      throw error;
    }
  });

export const updateMonthlyObservations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => 
    z.object({
      month: z.number().min(1).max(12),
      year: z.number(),
      observations: z.string().nullable()
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { month, year, observations } = data;

    const { error } = await supabase
      .from("monthly_reports")
      .upsert(
        { month, year, observations, updated_at: new Date().toISOString() },
        { onConflict: "month,year" }
      );

    if (error) throw error;
    return { success: true };
  });

export const updateMonthlyOverrides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => 
    z.object({
      month: z.number().min(1).max(12),
      year: z.number(),
      revenue: z.number().nullable(),
      expenses: z.number().nullable(),
      profit: z.number().nullable(),
      ordersCount: z.number().nullable(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { month, year, revenue, expenses, profit, ordersCount } = data;

    const { error } = await supabase
      .from("monthly_report_overrides" as any)
      .upsert(
        { 
          month, 
          year, 
          revenue_override: revenue, 
          expenses_override: expenses, 
          profit_override: profit, 
          orders_count_override: ordersCount,
          updated_at: new Date().toISOString() 
        },
        { onConflict: "month,year" }
      );

    if (error) throw error;
    return { success: true };
  });

export const getMonthlySummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ year: z.number() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { year } = data;

    const reports: any[] = [];
    
    const startDate = `${year}-01-01T00:00:00.000Z`;
    const endDate = `${year}-12-31T23:59:59.999Z`;

    const ordersRes = await (supabase as any).from("orders").select("sale_price, quantity, status, created_at, cost_price, commission, card_fee, shipping, other_costs").gte("created_at", startDate).lte("created_at", endDate).is("deleted_at", null);
    const expensesRes = await (supabase as any).from("expenses").select("amount, incurred_at").gte("incurred_at", startDate.slice(0, 10)).lte("incurred_at", endDate.slice(0, 10));
    const paymentsRes = await (supabase as any).from("payments").select("amount, direction, paid_at").gte("paid_at", startDate.slice(0, 10)).lte("paid_at", endDate.slice(0, 10));
    const overridesRes = await (supabase as any).from("monthly_report_overrides").select("*").eq("year", year);
    
    // removed bad line

    const orders = ordersRes.data ?? [];
    const expensesList = expensesRes.data ?? [];
    const payments = paymentsRes.data ?? [];
    const yearOverrides = (overridesRes as any).data ?? [];

    for (let m = 1; m <= 12; m++) {
      const monthOrders = orders.filter((o: any) => new Date(o.created_at).getMonth() + 1 === m);
      const monthExpenses = expensesList.filter((e: any) => {
        const d = new Date(e.incurred_at);
        return d.getUTCMonth() + 1 === m;
      });
      const monthPayments = payments.filter((p: any) => {
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

      const expensesTotal = monthExpenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0) + 
                          monthPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      const monthOverride = yearOverrides.find((o: any) => o.month === m);
      
      reports.push({
        month: m,
        ordersCount: (monthOverride?.orders_count_override !== null && monthOverride?.orders_count_override !== undefined) ? Number(monthOverride.orders_count_override) : monthOrders.length,
        revenue: (monthOverride?.revenue_override !== null && monthOverride?.revenue_override !== undefined) ? Number(monthOverride.revenue_override) : revenue,
        expenses: (monthOverride?.expenses_override !== null && monthOverride?.expenses_override !== undefined) ? Number(monthOverride.expenses_override) : expensesTotal,
        profit: (monthOverride?.profit_override !== null && monthOverride?.profit_override !== undefined) ? Number(monthOverride.profit_override) : (profitGross - expensesTotal)
      });
    }

    return reports;
  });
