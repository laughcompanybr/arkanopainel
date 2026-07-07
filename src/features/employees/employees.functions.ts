import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { employeeSchema, employeeFilterSchema } from "./schemas";

const idInput = z.object({ id: z.string().uuid() });

export const listEmployees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => employeeFilterSchema.parse(v ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let q = supabase
      .from("employees")
      .select(
        "id, full_name, role, email, phone, whatsapp, hire_date, base_salary, commission_percent, status, notes, deleted_at, created_at, updated_at",
        { count: "exact" },
      );
    if (!data.includeDeleted) q = q.is("deleted_at", null);
    if (data.status) q = q.eq("status", data.status);
    if (data.search) {
      const s = data.search.replace(/[%,]/g, " ").trim();
      q = q.or(
        `full_name.ilike.%${s}%,role.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%,whatsapp.ilike.%${s}%`,
      );
    }
    q = q.order(data.sort, { ascending: data.order === "asc", nullsFirst: false }).range(from, to);

    const { data: rows, error, count } = await q;
    if (error) throw error;
    return { rows: rows ?? [], count: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => employeeSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("employees")
      .insert({ ...data, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const updateEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => employeeSchema.extend({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("employees").update(rest).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const softDeleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("employees")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const restoreEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("employees")
      .update({ deleted_at: null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/** Lightweight list for dropdowns (commission attribution etc.) */
export const listEmployeeOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("employees")
      .select("id, full_name, role, commission_percent, status")
      .is("deleted_at", null)
      .eq("status", "active")
      .order("full_name")
      .limit(500);
    if (error) throw error;
    return data ?? [];
  });

export const getEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [employeeRes, ordersRes] = await Promise.all([
      supabase.from("employees").select("*").eq("id", data.id).maybeSingle(),
      supabase
        .from("orders")
        .select("id, order_number, status, sale_price, commission, created_at, clients(name)")
        .eq("employee_id", data.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (employeeRes.error) throw employeeRes.error;
    if (!employeeRes.data) throw new Error("Funcionário não encontrado");
    const orders = ordersRes.data ?? [];
    const totals = orders.reduce(
      (acc, o) => {
        acc.count += 1;
        acc.commission += Number(o.commission ?? 0);
        acc.sales += Number(o.sale_price ?? 0);
        return acc;
      },
      { count: 0, commission: 0, sales: 0 },
    );
    return { employee: employeeRes.data, orders, totals };
  });
