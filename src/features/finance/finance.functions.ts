import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dateRangeSchema, expenseFilterSchema, expenseSchema } from "./schemas";

const idInput = z.object({ id: z.string().uuid() });

function toISO(d: string, endOfDay = false) {
  // date is YYYY-MM-DD
  return endOfDay ? `${d}T23:59:59.999Z` : `${d}T00:00:00.000Z`;
}

export const getCashFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => dateRangeSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const fromISO = toISO(data.from);
    const toEndISO = toISO(data.to, true);

    const [paymentsRes, expensesRes] = await Promise.all([
      supabase
        .from("payments")
        .select("id, direction, amount, method, paid_at, notes, order_id, orders(order_number, brand, model, clients(name), suppliers(name))")
        .gte("paid_at", fromISO)
        .lte("paid_at", toEndISO)
        .order("paid_at", { ascending: false }),
      supabase
        .from("expenses")
        .select("id, description, amount, category, incurred_at")
        .gte("incurred_at", data.from)
        .lte("incurred_at", data.to)
        .order("incurred_at", { ascending: false }),
    ]);

    if (paymentsRes.error) throw paymentsRes.error;
    if (expensesRes.error) throw expensesRes.error;

    const payments = paymentsRes.data ?? [];
    const expenses = expensesRes.data ?? [];

    const totalIn = payments
      .filter((p) => p.direction === "in")
      .reduce((a, b) => a + Number(b.amount), 0);
    const totalOutPayments = payments
      .filter((p) => p.direction === "out")
      .reduce((a, b) => a + Number(b.amount), 0);
    const totalExpenses = expenses.reduce((a, b) => a + Number(b.amount), 0);
    const totalOut = totalOutPayments + totalExpenses;

    // Series by day or month
    const bucket = (iso: string) => {
      const d = new Date(iso);
      if (data.granularity === "month") {
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      }
      return d.toISOString().slice(0, 10);
    };

    const series = new Map<string, { key: string; inflow: number; outflow: number }>();
    const ensure = (k: string) => {
      if (!series.has(k)) series.set(k, { key: k, inflow: 0, outflow: 0 });
      return series.get(k)!;
    };
    for (const p of payments) {
      const row = ensure(bucket(p.paid_at));
      if (p.direction === "in") row.inflow += Number(p.amount);
      else row.outflow += Number(p.amount);
    }
    for (const e of expenses) {
      ensure(bucket(e.incurred_at + "T12:00:00Z")).outflow += Number(e.amount);
    }
    const chart = Array.from(series.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((r) => ({ ...r, net: r.inflow - r.outflow }));

    // By category (expenses)
    const byCategory = new Map<string, number>();
    for (const e of expenses) {
      const k = e.category ?? "Outros";
      byCategory.set(k, (byCategory.get(k) ?? 0) + Number(e.amount));
    }
    const categories = Array.from(byCategory.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      totals: {
        totalIn,
        totalOut,
        totalOutPayments,
        totalExpenses,
        net: totalIn - totalOut,
      },
      chart,
      categories,
      payments,
      expenses,
    };
  });

export const listReceivables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("orders")
      .select("id, order_number, status, sale_price, amount_received, expected_delivery, created_at, clients(id,name)")
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .order("expected_delivery", { ascending: true, nullsFirst: false });
    if (error) throw error;
    const rows = (data ?? [])
      .map((o) => ({
        ...o,
        balance: Number(o.sale_price ?? 0) - Number(o.amount_received ?? 0),
      }))
      .filter((r) => r.balance > 0.009);
    const total = rows.reduce((a, b) => a + b.balance, 0);
    return { rows, total };
  });

export const listPayables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [ordersRes, paymentsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_number, status, cost_price, expected_delivery, purchase_date, created_at, suppliers(id,name)")
        .is("deleted_at", null)
        .neq("status", "cancelled")
        .gt("cost_price", 0),
      supabase.from("payments").select("order_id, amount, direction").eq("direction", "out"),
    ]);
    if (ordersRes.error) throw ordersRes.error;
    if (paymentsRes.error) throw paymentsRes.error;
    const paidByOrder = new Map<string, number>();
    for (const p of paymentsRes.data ?? []) {
      if (!p.order_id) continue;
      paidByOrder.set(p.order_id, (paidByOrder.get(p.order_id) ?? 0) + Number(p.amount));
    }
    const rows = (ordersRes.data ?? [])
      .map((o) => {
        const paid = paidByOrder.get(o.id) ?? 0;
        return { ...o, paid, balance: Number(o.cost_price ?? 0) - paid };
      })
      .filter((r) => r.balance > 0.009)
      .sort((a, b) => (a.expected_delivery ?? "9999").localeCompare(b.expected_delivery ?? "9999"));
    const total = rows.reduce((a, b) => a + b.balance, 0);
    return { rows, total };
  });

export const listExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => expenseFilterSchema.parse(v))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("expenses")
      .select("id, description, amount, category, incurred_at, created_at")
      .gte("incurred_at", data.from)
      .lte("incurred_at", data.to)
      .order("incurred_at", { ascending: false });
    if (data.category) q = q.eq("category", data.category);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const createExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => expenseSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("expenses").insert({
      ...data,
      created_by: context.userId,
    });
    if (error) throw error;
    return { ok: true };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("expenses").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
