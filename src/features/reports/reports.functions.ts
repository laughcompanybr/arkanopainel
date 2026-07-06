import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rangeInput = z.object({
  from: z.string().min(10),
  to: z.string().min(10),
});

function toISO(d: string, endOfDay = false) {
  return endOfDay ? `${d}T23:59:59.999Z` : `${d}T00:00:00.000Z`;
}

export const getReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => rangeInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const fromISO = toISO(data.from);
    const toEndISO = toISO(data.to, true);

    const [ordersRes, expensesRes] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id, order_number, status, sale_price, cost_price, profit, amount_received, brand, model, reference, created_at, purchase_date, expected_delivery, client_id, supplier_id, clients(id,name), suppliers(id,name)",
        )
        .is("deleted_at", null)
        .gte("created_at", fromISO)
        .lte("created_at", toEndISO),
      supabase
        .from("expenses")
        .select("amount, category, incurred_at")
        .gte("incurred_at", data.from)
        .lte("incurred_at", data.to),
    ]);
    if (ordersRes.error) throw ordersRes.error;
    if (expensesRes.error) throw expensesRes.error;

    const orders = ordersRes.data ?? [];
    const activeOrders = orders.filter((o) => o.status !== "cancelled");
    const expenses = expensesRes.data ?? [];

    const revenue = activeOrders.reduce((a, b) => a + Number(b.sale_price ?? 0), 0);
    const cost = activeOrders.reduce((a, b) => a + Number(b.cost_price ?? 0), 0);
    const grossProfit = activeOrders.reduce((a, b) => a + Number(b.profit ?? 0), 0);
    const totalExpenses = expenses.reduce((a, b) => a + Number(b.amount ?? 0), 0);
    const netProfit = grossProfit - totalExpenses;
    const ticket = activeOrders.length ? revenue / activeOrders.length : 0;

    // Monthly evolution (revenue + profit)
    const monthMap = new Map<string, { key: string; revenue: number; profit: number; orders: number }>();
    for (const o of activeOrders) {
      const d = new Date(o.created_at);
      const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const row = monthMap.get(k) ?? { key: k, revenue: 0, profit: 0, orders: 0 };
      row.revenue += Number(o.sale_price ?? 0);
      row.profit += Number(o.profit ?? 0);
      row.orders += 1;
      monthMap.set(k, row);
    }
    const monthly = Array.from(monthMap.values()).sort((a, b) => a.key.localeCompare(b.key));

    // Status distribution
    const statusMap = new Map<string, number>();
    for (const o of orders) statusMap.set(o.status, (statusMap.get(o.status) ?? 0) + 1);
    const statusDist = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

    // Top clients
    const clientMap = new Map<string, { id: string; name: string; orders: number; revenue: number; profit: number }>();
    for (const o of activeOrders) {
      const id = o.client_id ?? "sem";
      const name = o.clients?.name ?? "Sem cliente";
      const row = clientMap.get(id) ?? { id, name, orders: 0, revenue: 0, profit: 0 };
      row.orders += 1;
      row.revenue += Number(o.sale_price ?? 0);
      row.profit += Number(o.profit ?? 0);
      clientMap.set(id, row);
    }
    const topClients = Array.from(clientMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 20);

    // Top suppliers
    const supMap = new Map<string, { id: string; name: string; orders: number; cost: number }>();
    for (const o of activeOrders) {
      const id = o.supplier_id ?? "sem";
      const name = o.suppliers?.name ?? "Sem fornecedor";
      const row = supMap.get(id) ?? { id, name, orders: 0, cost: 0 };
      row.orders += 1;
      row.cost += Number(o.cost_price ?? 0);
      supMap.set(id, row);
    }
    const topSuppliers = Array.from(supMap.values()).sort((a, b) => b.cost - a.cost).slice(0, 20);

    // Top products (brand + model)
    const prodMap = new Map<string, { name: string; brand: string | null; model: string | null; qty: number; revenue: number; profit: number }>();
    for (const o of activeOrders) {
      const brand = o.brand ?? "—";
      const model = o.model ?? "";
      const k = `${brand}|${model}`;
      const row = prodMap.get(k) ?? { name: `${brand} ${model}`.trim(), brand: o.brand, model: o.model, qty: 0, revenue: 0, profit: 0 };
      row.qty += 1;
      row.revenue += Number(o.sale_price ?? 0);
      row.profit += Number(o.profit ?? 0);
      prodMap.set(k, row);
    }
    const topProducts = Array.from(prodMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 20);

    return {
      totals: {
        revenue,
        cost,
        grossProfit,
        netProfit,
        totalExpenses,
        ticket,
        orders: activeOrders.length,
        cancelled: orders.length - activeOrders.length,
        clients: clientMap.size,
        suppliers: supMap.size,
      },
      monthly,
      statusDist,
      topClients,
      topSuppliers,
      topProducts,
      orders: activeOrders.map((o) => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        client: o.clients?.name ?? "—",
        supplier: o.suppliers?.name ?? "—",
        brand: o.brand,
        model: o.model,
        reference: o.reference,
        sale_price: Number(o.sale_price ?? 0),
        cost_price: Number(o.cost_price ?? 0),
        profit: Number(o.profit ?? 0),
        created_at: o.created_at,
      })),
    };
  });

export type ReportData = Awaited<ReturnType<typeof getReports>>;
