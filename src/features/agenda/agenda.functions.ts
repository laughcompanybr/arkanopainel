import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rateLimitMiddleware } from "@/lib/rate-limit.middleware";
import { taskInputSchema, updateTaskSchema, updateTaskStatusSchema } from "./agenda.schemas";

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth, rateLimitMiddleware])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("tasks")
      .select("*, client:clients(name)")
      .order("due_date", { ascending: true })
      .order("due_time", { ascending: true });
    if (error) throw error;
    return data;
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, rateLimitMiddleware])
  .inputValidator((v) => taskInputSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("tasks")
      .insert({ ...data, user_id: context.userId, responsible_id: context.userId });
    if (error) throw error;
    return { ok: true };
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, rateLimitMiddleware])
  .inputValidator((value) => updateTaskSchema.parse(value))
  .handler(async ({ data, context }) => {
    const { data: updatedRows, error } = await (context.supabase as any)
      .from("tasks")
      .update(data.data)
      .eq("id", data.id)
      .eq("version", data.version)
      .select("id");
    
    if (error) throw error;
    if (!updatedRows?.length) throw new Error("A tarefa foi modificada por outro usuário. Por favor, recarregue.");
    
    return { ok: true };
  });

export const updateTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, rateLimitMiddleware])
  .inputValidator((value) => updateTaskStatusSchema.parse(value))
  .handler(async ({ data, context }) => {
    const updates: any = { status: data.status };
    if (data.status === 'completed') updates.completed_at = new Date().toISOString();
    const { error } = await (context.supabase as any)
      .from("tasks")
      .update(updates)
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getTaskKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth, rateLimitMiddleware])
  .handler(async ({ context }) => {
    const { data: tasks, error } = await (context.supabase as any)
      .from("tasks")
      .select("status, due_date, due_time, completed_at")
      .neq("status", "cancelled");
    
    if (error) throw error;

    const now = new Date();
    let overdueCount = 0;
    
    tasks?.forEach((task: any) => {
      if (task.status !== 'completed') {
        const dueStr = `${task.due_date}T${task.due_time || '23:59:59'}`;
        const due = new Date(dueStr);
        if (due < now) overdueCount++;
      }
    });

    return { overdueCount, totalActive: tasks?.length || 0 };
  });
