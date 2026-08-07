import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Trash2,
  Phone,
  Users,
  MessageSquare,
  FileText,
  HelpCircle,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listTasks, createTask, updateTask, deleteTask, updateTaskStatus } from "@/features/agenda/agenda.functions";
import { toast } from "sonner";

const TASK_TYPE_ICONS = {
  call: Phone,
  meeting: Users,
  return: Clock,
  follow_up: MessageSquare,
  proposal: FileText,
  other: HelpCircle,
};

const TASK_TYPE_LABELS: Record<string, string> = {
  call: "Ligação",
  meeting: "Reunião",
  return: "Retorno",
  follow_up: "Follow-up",
  proposal: "Proposta",
  other: "Outro",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  urgent: "bg-red-500/10 text-red-500 border-red-500/20",
};

/** due_date vem como 'YYYY-MM-DD' — nunca converter para Date (evita deslocar o dia por fuso). */
const dayKeyOf = (value: string) => String(value).slice(0, 10);

type FormState = {
  id: string | null;
  title: string;
  description: string;
  due_date: string;
  due_time: string;
  priority: "low" | "medium" | "high" | "urgent";
  type: "call" | "meeting" | "return" | "follow_up" | "proposal" | "other";
};

const emptyForm = (date: string): FormState => ({
  id: null,
  title: "",
  description: "",
  due_date: date,
  due_time: "",
  priority: "medium",
  type: "other",
});

function AgendaPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTasks);
  const createFn = useServerFn(createTask);
  const updateFn = useServerFn(updateTask);
  const deleteFn = useServerFn(deleteTask);
  const updateStatusFn = useServerFn(updateTaskStatus);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(format(new Date(), "yyyy-MM-dd")));

  const { data: tasks = [], isLoading } = useQuery<any[]>({
    queryKey: ["tasks"],
    queryFn: () => listFn() as any,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const saveMut = useMutation({
    mutationFn: async (v: FormState) => {
      const payload = {
        title: v.title,
        description: v.description,
        due_date: v.due_date,
        due_time: v.due_time,
        priority: v.priority,
        type: v.type,
      };
      return v.id ? updateFn({ data: { id: v.id, ...payload } }) : createFn({ data: payload });
    },
    onSuccess: (_r, v) => {
      toast.success(v.id ? "Tarefa atualizada" : "Tarefa criada");
      setOpenForm(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao salvar tarefa"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Tarefa excluída");
      setOpenForm(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao excluir tarefa"),
  });

  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: string }) => updateStatusFn({ data: v }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreateFor = (date: string) => {
    setForm(emptyForm(date));
    setOpenForm(true);
  };

  const openEdit = (task: any) => {
    setForm({
      id: task.id,
      title: task.title ?? "",
      description: task.description ?? "",
      due_date: dayKeyOf(task.due_date),
      due_time: task.due_time ? String(task.due_time).slice(0, 5) : "",
      priority: task.priority ?? "medium",
      type: task.type ?? "other",
    });
    setOpenForm(true);
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 0 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 0 }),
  });

  const tasksByDay = tasks.reduce((acc: Record<string, any[]>, task: any) => {
    const day = dayKeyOf(task.due_date);
    (acc[day] ??= []).push(task);
    return acc;
  }, {} as Record<string, any[]>);

  const selectedTasks = tasksByDay[selectedDay] ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operação"
        title="Agenda"
        description="Gerencie seus compromissos e tarefas diárias."
        actions={
          <Button onClick={() => openCreateFor(selectedDay)}>
            <Plus className="mr-2 size-4" /> Nova tarefa
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-display font-medium capitalize">
          {format(currentDate, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" aria-label="Mês anterior" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button size="icon" variant="outline" aria-label="Próximo mês" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const today = new Date();
              setCurrentDate(today);
              setSelectedDay(format(today, "yyyy-MM-dd"));
            }}
          >
            Hoje
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-t border-l border-border rounded-xl overflow-hidden shadow-sm">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="bg-muted/50 py-2 text-center text-[10px] sm:text-xs font-medium text-muted-foreground border-b border-r border-border uppercase tracking-wider">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDay[dayKey] ?? [];
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());
          const isSelected = dayKey === selectedDay;

          return (
            <button
              type="button"
              key={dayKey}
              onClick={() => setSelectedDay(dayKey)}
              onDoubleClick={() => openCreateFor(dayKey)}
              className={`min-h-[96px] sm:min-h-[130px] p-2 text-left border-b border-r border-border transition-colors ${!isCurrentMonth ? "bg-muted/20 opacity-50" : "bg-card/40"} ${isSelected ? "ring-1 ring-inset ring-primary" : ""} ${isToday ? "bg-primary/5" : ""} hover:bg-accent/40`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className={`text-sm font-medium size-7 flex items-center justify-center rounded-full ${isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  {format(day, "d")}
                </span>
                {dayTasks.length > 0 && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1">{dayTasks.length}</Badge>
                )}
              </div>
              <div className="space-y-1 overflow-hidden">
                {dayTasks.slice(0, 3).map((task: any) => {
                  const Icon = TASK_TYPE_ICONS[task.type as keyof typeof TASK_TYPE_ICONS] ?? HelpCircle;
                  return (
                    <span
                      key={task.id}
                      className={`flex items-center gap-1.5 p-1 rounded border text-[10px] truncate ${task.status === "completed" ? "opacity-60 bg-muted/50" : "bg-background border-border"}`}
                    >
                      <Icon className="size-3 shrink-0" />
                      <span className="truncate flex-1">{task.title}</span>
                    </span>
                  );
                })}
                {dayTasks.length > 3 && (
                  <p className="text-[10px] text-muted-foreground text-center">+ {dayTasks.length - 3} mais</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">
            {format(new Date(`${selectedDay}T12:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </h3>
          <Button size="sm" variant="outline" onClick={() => openCreateFor(selectedDay)}>
            <Plus className="mr-2 size-4" /> Adicionar
          </Button>
        </div>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : selectedTasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma tarefa para este dia.</p>
        ) : (
          <div className="space-y-2">
            {selectedTasks.map((task: any) => {
              const Icon = TASK_TYPE_ICONS[task.type as keyof typeof TASK_TYPE_ICONS] ?? HelpCircle;
              const done = task.status === "completed";
              return (
                <div key={task.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {TASK_TYPE_LABELS[task.type] ?? "Outro"}
                      {task.due_time ? ` · ${String(task.due_time).slice(0, 5)}` : ""}
                      {task.clients?.name ? ` · ${task.clients.name}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className={PRIORITY_COLORS[task.priority] ?? ""}>
                    {PRIORITY_LABELS[task.priority] ?? task.priority}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={done ? "Reabrir tarefa" : "Concluir tarefa"}
                      onClick={() => statusMut.mutate({ id: task.id, status: done ? "pending" : "completed" })}
                    >
                      <CheckCircle2 className={`size-4 ${done ? "text-emerald-500" : ""}`} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(task)}>Editar</Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Excluir tarefa"
                      onClick={() => deleteMut.mutate(task.id)}
                    >
                      <Trash2 className="size-4 text-rose-500" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
            <DialogDescription>Preencha os dados da tarefa da agenda.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Ligar para o cliente João" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Data</Label>
                <Input id="date" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Horário</Label>
                <Input id="time" type="time" value={form.due_time} onChange={(e) => setForm({ ...form, due_time: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <select
                  id="type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as FormState["type"] })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {Object.entries(TASK_TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Prioridade</Label>
                <select
                  id="priority"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as FormState["priority"] })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea id="description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalhes da tarefa..." />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {form.id && (
              <Button variant="outline" className="mr-auto text-rose-500" onClick={() => deleteMut.mutate(form.id!)} disabled={deleteMut.isPending}>
                <Trash2 className="mr-2 size-4" /> Excluir
              </Button>
            )}
            <Button variant="ghost" onClick={() => setOpenForm(false)}>Cancelar</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending || !form.title.trim() || !form.due_date}>
              {saveMut.isPending ? "Salvando..." : form.id ? "Salvar" : "Criar tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/agenda")({
  component: AgendaPage,
});
