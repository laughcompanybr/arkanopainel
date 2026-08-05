import { z } from "zod";

export const taskInputSchema = z.object({
  title: z.string().min(1, "O título é obrigatório"),
  description: z.string().nullable().optional(),
  client_id: z.string().uuid("Cliente inválido").nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  due_time: z.string().nullable().optional().refine(
    (value) => !value || /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value),
    { message: "Horário inválido (deve ser HH:mm)" },
  ),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  type: z.enum(["call", "meeting", "return", "follow_up", "proposal", "other"]),
});

export const updateTaskSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  data: taskInputSchema.partial(),
});

export const updateTaskStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
});