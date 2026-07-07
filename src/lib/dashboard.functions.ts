import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeMonthlyBreakdown, clampTaxPercentWithInfo } from "@/lib/dashboard-calc";


export interface DashboardStats {
  revenueMonth: number;
  profitMonth: number;
  profitGrossMonth: number;
  taxAmountMonth: number;
  taxRate: number;
  /** True when the stored tax_percent was outside 0..100 and had to be clamped. */
  taxRateClamped: boolean;
  /** Original stored value before clamping, when available. */
  taxRateRaw: number | null;

  expensesMonth: number;
  receivable: number;
  payable: number;
  ordersMonth: number;
  clientsTotal: number;
  avgTicket: number;
  avgProfit: number;
  commissionMonth: number;
  cardFeesMonth: number;
  shippingMonth: number;
  receivedMonth: number;
  pendingMonth: number;
  watchesSoldMonth: number;
  monthComparison: {
    revenuePrev: number;
    profitPrev: number;
    revenueDelta: number;
    profitDelta: number;
  };
  topProducts: Array<{ label: string; quantity: number; revenue: number }>;
  pipeline: {
    awaitingPayment: number;
    inTransit: number;
    delivered: number;
  };
  monthly: Array<{ month: string; revenue: number; profit: number; orders: number }>;
  activity: Array<{
    id: string;
    type: string;
    message: string | null;
    order_id: string;
    order_number: number | null;
    created_at: string;
  }>;
}



const PIPELINE_AWAITING = new Set([
  "new",
  "awaiting_deposit",
  "paid",
  "purchasing",
]);
const PIPELINE_IN_TRANSIT = new Set(["in_transit", "received", "ready_delivery"]);
const PIPELINE_DELIVERED = new Set(["delivered"]);

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardStats> => {
    const { supabase } = context;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // All non-deleted orders (bounded by soft-delete filter; small tables here)
    const [ordersRes, clientsRes, paymentsRes, expensesRes, eventsRes, taxRes] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id, order_number, status, brand, model, sale_price, cost_price, amount_received, quantity, commission, card_fee, shipping, other_costs, created_at",
        )
        .is("deleted_at", null),
      supabase.from("clients").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("payments").select("direction, amount, paid_at"),
      supabase.from("expenses").select("amount, incurred_at").gte("incurred_at", sixMonthsAgo.toISOString().slice(0, 10)),
      supabase
        .from("order_events")
        .select("id, type, message, order_id, created_at, orders!inner(order_number)")
        .order("created_at", { ascending: false })
        .limit(12),
      supabase.from("app_settings").select("value").eq("key", "tax_percent").maybeSingle(),
    ]);


    if (ordersRes.error) throw ordersRes.error;
    if (paymentsRes.error) throw paymentsRes.error;
    if (eventsRes.error) throw eventsRes.error;

    const orders = ordersRes.data ?? [];
    const payments = paymentsRes.data ?? [];
    const expenses = expensesRes.data ?? [];

    // Month buckets — last 6 months, oldest first
    const months: Array<{ key: string; label: string; revenue: number; profit: number; orders: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        revenue: 0,
        profit: 0,
        orders: 0,
      });
    }
    const monthIndex = new Map(months.map((m, i) => [m.key, i]));
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;

    let revenueMonth = 0;
    let profitMonth = 0;
    let receivable = 0;
    let ordersMonth = 0;
    let commissionMonth = 0;
    let cardFeesMonth = 0;
    let shippingMonth = 0;
    let receivedMonth = 0;
    let pendingMonth = 0;
    let watchesSoldMonth = 0;
    const pipeline = { awaitingPayment: 0, inTransit: 0, delivered: 0 };
    const productTally = new Map<string, { quantity: number; revenue: number }>();

    for (const o of orders) {
      const qty = Number((o as { quantity?: number }).quantity ?? 1) || 1;
      const sale = Number(o.sale_price ?? 0) * qty;
      const cost = Number(o.cost_price ?? 0) * qty;
      const received = Number(o.amount_received ?? 0);
      const commission = Number((o as { commission?: number }).commission ?? 0);
      const cardFee = Number((o as { card_fee?: number }).card_fee ?? 0);
      const shipping = Number((o as { shipping?: number }).shipping ?? 0);
      const otherCosts = Number((o as { other_costs?: number }).other_costs ?? 0);
      const profit = sale - cost - commission - cardFee - shipping - otherCosts;
      const created = new Date(o.created_at);
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
      const idx = monthIndex.get(key);
      const status = String(o.status);

      if (status !== "cancelled") {
        if (idx !== undefined) {
          months[idx].revenue += sale;
          months[idx].profit += profit;
          months[idx].orders += 1;
        }
        if (key === currentKey) {
          revenueMonth += sale;
          profitMonth += profit;
          ordersMonth += 1;
          commissionMonth += commission;
          cardFeesMonth += cardFee;
          shippingMonth += shipping;
          receivedMonth += received;
          pendingMonth += Math.max(sale - received, 0);
          watchesSoldMonth += qty;
          const label = [
            (o as { brand?: string }).brand,
            (o as { model?: string }).model,
          ].filter(Boolean).join(" ") || "Sem descrição";
          const cur = productTally.get(label) ?? { quantity: 0, revenue: 0 };
          cur.quantity += qty;
          cur.revenue += sale;
          productTally.set(label, cur);
        }
        if (status !== "delivered") {
          receivable += Math.max(sale - received, 0);
        }
      }

      if (PIPELINE_AWAITING.has(status)) pipeline.awaitingPayment += 1;
      else if (PIPELINE_IN_TRANSIT.has(status)) pipeline.inTransit += 1;
      else if (PIPELINE_DELIVERED.has(status)) pipeline.delivered += 1;
    }

    // Payable = supplier outflows (payments.direction='out') + expenses in current month
    const monthStart = startOfMonth.slice(0, 10);
    let payable = 0;
    for (const p of payments) {
      if (p.direction === "out" && p.paid_at && p.paid_at >= monthStart) {
        payable += Number(p.amount ?? 0);
      }
    }
    for (const e of expenses) {
      if (e.incurred_at && e.incurred_at >= monthStart) {
        payable += Number(e.amount ?? 0);
      }
    }

    // Separate expenses for the current month (payables = expenses subtracted from profit)
    let expensesMonth = 0;
    for (const p of payments) {
      if (p.direction === "out" && p.paid_at && p.paid_at >= monthStart) {
        expensesMonth += Number(p.amount ?? 0);
      }
    }
    for (const e of expenses) {
      if (e.incurred_at && e.incurred_at >= monthStart) {
        expensesMonth += Number(e.amount ?? 0);
      }
    }

    // Tax: configurable % applied on top of gross profit. Clamp the persisted
    // value defensively so a bad app_settings row cannot break the dashboard;
    // report the clamp so the UI can show a warning.
    const taxRow = (taxRes?.data ?? null) as { value?: { percent?: number } } | null;
    const taxInfo = clampTaxPercentWithInfo(taxRow?.value?.percent, 6);
    const breakdown = computeMonthlyBreakdown({
      grossProfit: profitMonth,
      expenses: expensesMonth,
      taxPercent: taxInfo.percent,
    });
    const taxRate = breakdown.taxRate;
    const taxRateClamped = taxInfo.clamped;
    const taxRateRaw = taxInfo.rawPercent;
    const profitGrossMonth = breakdown.grossProfit;
    const taxAmountMonth = breakdown.taxAmount;
    const profitNetMonth = breakdown.netProfit;



    const nonCancelled = orders.filter((o) => String(o.status) !== "cancelled");
    const totalRevenue = nonCancelled.reduce((s, o) => s + Number(o.sale_price ?? 0) * Number((o as { quantity?: number }).quantity ?? 1), 0);
    const totalProfit = nonCancelled.reduce(
      (s, o) => {
        const q = Number((o as { quantity?: number }).quantity ?? 1);
        return s + (Number(o.sale_price ?? 0) * q - Number(o.cost_price ?? 0) * q);
      },
      0,
    );
    const avgTicket = nonCancelled.length ? totalRevenue / nonCancelled.length : 0;
    const avgProfit = nonCancelled.length ? totalProfit / nonCancelled.length : 0;

    const prevBucket = months.find((m) => m.key === prevKey);
    const monthComparison = {
      revenuePrev: prevBucket?.revenue ?? 0,
      profitPrev: prevBucket?.profit ?? 0,
      revenueDelta: (prevBucket?.revenue ?? 0) > 0 ? ((revenueMonth - (prevBucket?.revenue ?? 0)) / (prevBucket?.revenue ?? 1)) * 100 : 0,
      profitDelta: (prevBucket?.profit ?? 0) !== 0 ? ((profitNetMonth - (prevBucket?.profit ?? 0)) / Math.abs(prevBucket?.profit ?? 1)) * 100 : 0,
    };


    const topProducts = Array.from(productTally.entries())
      .map(([label, v]) => ({ label, quantity: v.quantity, revenue: v.revenue }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const activity = (eventsRes.data ?? []).map((row) => {
      const rel = row as unknown as {
        id: string;
        type: string;
        message: string | null;
        order_id: string;
        created_at: string;
        orders: { order_number: number | null } | null;
      };
      return {
        id: rel.id,
        type: rel.type,
        message: rel.message,
        order_id: rel.order_id,
        order_number: rel.orders?.order_number ?? null,
        created_at: rel.created_at,
      };
    });

    return {
      revenueMonth,
      profitMonth: profitNetMonth,
      profitGrossMonth,
      taxAmountMonth,
      taxRate,
      taxRateClamped,
      taxRateRaw,

      expensesMonth,
      receivable,
      payable,
      ordersMonth,
      clientsTotal: clientsRes.count ?? 0,
      avgTicket,
      avgProfit,
      commissionMonth,
      cardFeesMonth,
      shippingMonth,
      receivedMonth,
      pendingMonth,
      watchesSoldMonth,
      monthComparison,
      topProducts,
      pipeline,
      monthly: months.map(({ label, revenue, profit, orders: o }) => ({
        month: label,
        revenue,
        profit,
        orders: o,
      })),
      activity,
    };
  });


