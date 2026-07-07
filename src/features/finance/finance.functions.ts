import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  dateRangeSchema,
  expenseFilterSchema,
  expenseSchema,
  financialTxFilterSchema,
  financialTxSchema,
  goalSchema,
  payablesFilterSchema,
} from "./schemas";
import { sanitizeReceiptPath, validateReceiptMetadata } from "./receipt-validation";

const RECEIPT_BUCKET = "finance-receipts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type SupabaseCtx = any;

async function validateReceiptPath(
  supabase: SupabaseCtx,
  path: string | null | undefined,
): Promise<string | null> {
  const clean = sanitizeReceiptPath(path);
  if (!clean) return null;
  const parts = clean.split("/");
  const folder = parts.slice(0, -1).join("/") || "";
  const file = parts[parts.length - 1];
  const { data, error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .list(folder, { limit: 1, search: file });
  if (error) throw new Error(`Falha ao validar comprovante: ${error.message}`);
  const found = (data ?? []).find((f: { name: string }) => f.name === file);
  if (!found) throw new Error("Comprovante não encontrado no storage");
  validateReceiptMetadata(file, {
    size: found.metadata?.size,
    mime: found.metadata?.mimetype,
  });
  return clean;
}


async function auditReceipt(
  supabase: SupabaseCtx,
  opts: { actor: string; table: string; recordId: string; route: string; receipt_url: string },
) {
  await supabase.from("audit_log").insert({
    table_name: opts.table,
    record_id: opts.recordId,
    operation: "RECEIPT_ATTACHED",
    actor: opts.actor,
    new_data: { route: opts.route, receipt_url: opts.receipt_url },
  });
}


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

    const [paymentsRes, expensesRes, txRes] = await Promise.all([
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
      supabase
        .from("financial_transactions")
        .select("id, direction, amount, method, paid_at, description, category, status")
        .eq("status", "paid")
        .not("paid_at", "is", null)
        .gte("paid_at", fromISO)
        .lte("paid_at", toEndISO),
    ]);

    if (paymentsRes.error) throw paymentsRes.error;
    if (expensesRes.error) throw expensesRes.error;
    if (txRes.error) throw txRes.error;

    const payments = paymentsRes.data ?? [];
    const expenses = expensesRes.data ?? [];
    const manualTx = txRes.data ?? [];

    const totalInPayments = payments
      .filter((p) => p.direction === "in")
      .reduce((a, b) => a + Number(b.amount), 0);
    const totalOutPayments = payments
      .filter((p) => p.direction === "out")
      .reduce((a, b) => a + Number(b.amount), 0);
    const totalInManual = manualTx
      .filter((t) => t.direction === "in")
      .reduce((a, b) => a + Number(b.amount), 0);
    const totalOutManual = manualTx
      .filter((t) => t.direction === "out")
      .reduce((a, b) => a + Number(b.amount), 0);
    const totalExpenses = expenses.reduce((a, b) => a + Number(b.amount), 0);
    const totalIn = totalInPayments + totalInManual;
    const totalOut = totalOutPayments + totalOutManual + totalExpenses;

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
    for (const t of manualTx) {
      if (!t.paid_at) continue;
      const row = ensure(bucket(t.paid_at));
      if (t.direction === "in") row.inflow += Number(t.amount);
      else row.outflow += Number(t.amount);
    }
    for (const e of expenses) {
      ensure(bucket(e.incurred_at + "T12:00:00Z")).outflow += Number(e.amount);
    }
    const chart = Array.from(series.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((r) => ({ ...r, net: r.inflow - r.outflow }));

    // By category (expenses + manual out)
    const byCategory = new Map<string, number>();
    for (const e of expenses) {
      const k = e.category ?? "Outros";
      byCategory.set(k, (byCategory.get(k) ?? 0) + Number(e.amount));
    }
    for (const t of manualTx) {
      if (t.direction !== "out") continue;
      const k = t.category ?? "Outros";
      byCategory.set(k, (byCategory.get(k) ?? 0) + Number(t.amount));
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
        totalInManual,
        totalOutManual,
        net: totalIn - totalOut,
      },
      chart,
      categories,
      payments,
      expenses,
      manualTx,
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

export const listPayables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => payablesFilterSchema.parse(v ?? {}))
  .handler(async ({ data, context }) => {
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
    const today = new Date().toISOString().slice(0, 10);
    const search = (data.search ?? "").toLowerCase().trim();
    const rows = (ordersRes.data ?? [])
      .map((o) => {
        const paid = paidByOrder.get(o.id) ?? 0;
        return { ...o, paid, balance: Number(o.cost_price ?? 0) - paid };
      })
      .filter((r) => r.balance > 0.009)
      .filter((r) => {
        if (!search) return true;
        const hay = `${r.suppliers?.name ?? ""} #${r.order_number}`.toLowerCase();
        return hay.includes(search);
      })
      .filter((r) => {
        const due = r.expected_delivery ?? r.purchase_date ?? null;
        if (data.from && due && due < data.from) return false;
        if (data.to && due && due > data.to) return false;
        if (data.statusFilter === "overdue") return !!due && due < today;
        if (data.statusFilter === "upcoming") {
          if (!due) return false;
          const diff = (new Date(due).getTime() - new Date(today).getTime()) / 86400000;
          return diff >= 0 && diff <= 7;
        }
        if (data.statusFilter === "future") return !!due && due > today;
        if (data.statusFilter === "no_date") return !due;
        return true;
      })
      .sort((a, b) => (a.expected_delivery ?? "9999").localeCompare(b.expected_delivery ?? "9999"));
    const total = rows.reduce((a, b) => a + b.balance, 0);
    return { rows, total };
  });

export const getPayableHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z
      .object({
        order_id: z.string().uuid(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: rows, error, count } = await context.supabase
      .from("payments")
      .select("id, amount, method, paid_at, notes, receipt_url, direction", { count: "exact" })
      .eq("order_id", data.order_id)
      .eq("direction", "out")
      .order("paid_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return { rows: rows ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });


export const listExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => expenseFilterSchema.parse(v))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("expenses")
      .select("id, description, amount, category, incurred_at, receipt_url, created_at")
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
    const receipt = await validateReceiptPath(context.supabase, data.receipt_url);
    const { data: inserted, error } = await context.supabase
      .from("expenses")
      .insert({
        description: data.description,
        amount: data.amount,
        category: data.category,
        incurred_at: data.incurred_at,
        receipt_url: receipt,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    if (receipt && inserted?.id) {
      await auditReceipt(context.supabase, {
        actor: context.userId,
        table: "expenses",
        recordId: inserted.id,
        route: "/financeiro:createExpense",
        receipt_url: receipt,
      });
    }
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

/* -------- Manual financial transactions -------- */

export const listFinancialTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => financialTxFilterSchema.parse(v))
  .handler(async ({ data, context }) => {
    const fromISO = `${data.from}T00:00:00.000Z`;
    const toISO = `${data.to}T23:59:59.999Z`;
    let q = context.supabase
      .from("financial_transactions")
      .select("id, direction, status, description, category, amount, method, due_date, paid_at, notes, receipt_url, created_at")
      .or(
        `and(paid_at.gte.${fromISO},paid_at.lte.${toISO}),and(due_date.gte.${data.from},due_date.lte.${data.to})`,
      )
      .order("created_at", { ascending: false });
    if (data.direction) q = q.eq("direction", data.direction);
    if (data.status) q = q.eq("status", data.status);
    if (data.search) {
      const s = data.search.replace(/[%,()]/g, " ");
      q = q.or(`description.ilike.%${s}%,category.ilike.%${s}%,notes.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const createFinancialTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => financialTxSchema.parse(v))
  .handler(async ({ data, context }) => {
    const receipt = await validateReceiptPath(context.supabase, data.receipt_url);
    const paid_at =
      data.status === "paid"
        ? data.paid_at
          ? new Date(data.paid_at).toISOString()
          : new Date().toISOString()
        : null;
    const { data: inserted, error } = await context.supabase
      .from("financial_transactions")
      .insert({
        direction: data.direction,
        status: data.status,
        description: data.description,
        category: data.category || null,
        amount: data.amount,
        method: data.method || null,
        due_date: data.due_date || null,
        paid_at,
        notes: data.notes || null,
        receipt_url: receipt,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    if (receipt && inserted?.id) {
      await auditReceipt(context.supabase, {
        actor: context.userId,
        table: "financial_transactions",
        recordId: inserted.id,
        route: "/financeiro:createFinancialTransaction",
        receipt_url: receipt,
      });
    }
    return { ok: true };
  });

export const deleteFinancialTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("financial_transactions")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

const markTxPaidSchema = z.object({
  id: z.string().uuid(),
  paid_at: z.string().optional().nullable(),
  method: z.string().trim().max(40).optional().nullable(),
  receipt_url: z.string().trim().max(500).optional().nullable(),
});

export const markTransactionPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => markTxPaidSchema.parse(v))
  .handler(async ({ data, context }) => {
    const receipt = await validateReceiptPath(context.supabase, data.receipt_url);
    const patch: {
      status: "paid";
      paid_at: string;
      method?: string;
      receipt_url?: string;
    } = {
      status: "paid",
      paid_at: data.paid_at ? new Date(data.paid_at).toISOString() : new Date().toISOString(),
    };
    if (data.method) patch.method = data.method;
    if (receipt) patch.receipt_url = receipt;
    const { error } = await context.supabase
      .from("financial_transactions")
      .update(patch)
      .eq("id", data.id);
    if (error) throw error;
    if (receipt) {
      await auditReceipt(context.supabase, {
        actor: context.userId,
        table: "financial_transactions",
        recordId: data.id,
        route: "/financeiro:markTransactionPaid",
        receipt_url: receipt,
      });
    }
    return { ok: true };
  });

/* -------- Pay supplier payable (order cost) -------- */
const payPayableSchema = z.object({
  order_id: z.string().uuid(),
  amount: z.number().positive(),
  method: z.string().trim().max(40).optional().nullable(),
  paid_at: z.string().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  receipt_url: z.string().trim().max(500).optional().nullable(),
});

export const payPayable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => payPayableSchema.parse(v))
  .handler(async ({ data, context }) => {
    const receipt = await validateReceiptPath(context.supabase, data.receipt_url);
    const paidAt = data.paid_at
      ? new Date(data.paid_at).toISOString()
      : new Date().toISOString();
    const { data: inserted, error } = await context.supabase
      .from("payments")
      .insert({
        order_id: data.order_id,
        direction: "out",
        amount: data.amount,
        method: data.method || null,
        paid_at: paidAt,
        notes: data.notes || null,
        receipt_url: receipt,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    if (receipt && inserted?.id) {
      await auditReceipt(context.supabase, {
        actor: context.userId,
        table: "payments",
        recordId: inserted.id,
        route: "/financeiro:payPayable",
        receipt_url: receipt,
      });
    }
    return { ok: true };
  });

const bulkPayPayableSchema = z.object({
  paid_at: z.string().optional().nullable(),
  method: z.string().trim().max(40).optional().nullable(),
  receipt_url: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  items: z
    .array(z.object({ order_id: z.string().uuid(), amount: z.number().positive() }))
    .min(1)
    .max(200),
});

export const bulkPayPayables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => bulkPayPayableSchema.parse(v))
  .handler(async ({ data, context }) => {
    const receipt = await validateReceiptPath(context.supabase, data.receipt_url);
    const paidAt = data.paid_at
      ? new Date(data.paid_at).toISOString()
      : new Date().toISOString();
    const rows = data.items.map((it) => ({
      order_id: it.order_id,
      direction: "out" as const,
      amount: it.amount,
      method: data.method || null,
      paid_at: paidAt,
      notes: data.notes || null,
      receipt_url: receipt,
      created_by: context.userId,
    }));
    const { data: inserted, error } = await context.supabase
      .from("payments")
      .insert(rows)
      .select("id");
    if (error) throw error;
    if (receipt && inserted?.length) {
      const auditRows = inserted.map((r: { id: string }) => ({
        table_name: "payments",
        record_id: r.id,
        operation: "RECEIPT_ATTACHED",
        actor: context.userId,
        new_data: { route: "/financeiro:bulkPayPayables", receipt_url: receipt },
      }));
      await context.supabase.from("audit_log").insert(auditRows);
    }
    return { ok: true, count: rows.length };
  });

/* -------- Goals -------- */

export const listGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("goals")
      .select("id, month, sales_target, orders_target, profit_target, notes, created_at, updated_at")
      .order("month", { ascending: false })
      .limit(36);
    if (error) throw error;
    return data ?? [];
  });

export const upsertGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => goalSchema.parse(v))
  .handler(async ({ data, context }) => {
    const payload = {
      month: data.month,
      sales_target: data.sales_target,
      orders_target: data.orders_target,
      profit_target: data.profit_target,
      notes: data.notes || null,
      created_by: context.userId,
    };
    const { error } = await context.supabase
      .from("goals")
      .upsert(payload, { onConflict: "month" });
    if (error) throw error;
    return { ok: true };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("goals").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getGoalStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
    const [ordersRes, goalsRes] = await Promise.all([
      context.supabase
        .from("orders")
        .select("id, sale_price, profit, status, created_at, order_number, brand, model, clients(name)")
        .is("deleted_at", null)
        .neq("status", "cancelled")
        .gte("created_at", yearStart)
        .order("sale_price", { ascending: false }),
      context.supabase
        .from("goals")
        .select("month, sales_target, orders_target, profit_target")
        .order("month", { ascending: false })
        .limit(24),
    ]);
    if (ordersRes.error) throw ordersRes.error;
    if (goalsRes.error) throw goalsRes.error;

    const orders = ordersRes.data ?? [];
    const goals = goalsRes.data ?? [];

    // monthly aggregation
    const monthly = new Map<string, { sales: number; orders: number; profit: number }>();
    for (const o of orders) {
      const k = String(o.created_at).slice(0, 7);
      const cur = monthly.get(k) ?? { sales: 0, orders: 0, profit: 0 };
      cur.sales += Number(o.sale_price ?? 0);
      cur.orders += 1;
      cur.profit += Number(o.profit ?? 0);
      monthly.set(k, cur);
    }

    const monthKey = now.toISOString().slice(0, 7);
    const current = monthly.get(monthKey) ?? { sales: 0, orders: 0, profit: 0 };
    const currentGoal =
      goals.find((g) => String(g.month).slice(0, 7) === monthKey) ?? null;

    // records
    const biggestSale = orders[0]
      ? {
          id: orders[0].id,
          order_number: orders[0].order_number,
          amount: Number(orders[0].sale_price ?? 0),
          brand: orders[0].brand,
          model: orders[0].model,
          client: (orders[0].clients as { name?: string } | null)?.name ?? null,
        }
      : null;

    const salesRecord = Array.from(monthly.entries()).sort((a, b) => b[1].sales - a[1].sales)[0];
    const profitRecord = Array.from(monthly.entries()).sort((a, b) => b[1].profit - a[1].profit)[0];

    // goals hit
    const goalsHit = goals
      .map((g) => {
        const k = String(g.month).slice(0, 7);
        const m = monthly.get(k) ?? { sales: 0, orders: 0, profit: 0 };
        const salesPct = g.sales_target ? m.sales / Number(g.sales_target) : 0;
        const ordersPct = g.orders_target ? m.orders / Number(g.orders_target) : 0;
        const profitPct = g.profit_target ? m.profit / Number(g.profit_target) : 0;
        const hit =
          (!g.sales_target || salesPct >= 1) &&
          (!g.orders_target || ordersPct >= 1) &&
          (!g.profit_target || profitPct >= 1);
        return { month: k, salesPct, ordersPct, profitPct, hit, actual: m };
      })
      .sort((a, b) => b.month.localeCompare(a.month));

    return {
      current: {
        month: monthKey,
        actual: current,
        target: currentGoal,
      },
      biggestSale,
      salesRecord: salesRecord ? { month: salesRecord[0], ...salesRecord[1] } : null,
      profitRecord: profitRecord ? { month: profitRecord[0], ...profitRecord[1] } : null,
      goalsHit,
      totalHit: goalsHit.filter((g) => g.hit).length,
    };
  });
