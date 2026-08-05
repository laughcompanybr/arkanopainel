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
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  MoreVertical,
  AlertCircle,
  Phone,
  Users,
  MessageSquare,
  FileText,
  HelpCircle
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listTasks, createTask, updateTaskStatus, updateTask, getTaskKpis } from "@/features/agenda/agenda.functions";

import { toast } from "sonner";

const TASK_TYPE_ICONS = {
  call: Phone,
  meeting: Users,
  return: Clock,
  follow_up: MessageSquare,
  proposal: FileText,
  other: HelpCircle,
};

const TASK_TYPE_LABELS = {
  call: "Ligação",
  meeting: "Reunião",
  return: "Retorno",
  follow_up: "Follow-up",
  proposal: "Proposta",
  other: "Outro",
};

const PRIORITY_COLORS = {
  low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  urgent: "bg-red-500/10 text-red-500 border-red-500/20",
};

function AgendaPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTasks);
  const createFn = useServerFn(createTask);
  const updateStatusFn = useServerFn(updateTaskStatus);
  const kpisFn = useServerFn(getTaskKpis);


  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [openCreate, setOpenCreate] = useState(false);
  
  // Create form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [type, setType] = useState<"call" | "meeting" | "return" | "follow_up" | "proposal" | "other">("other");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => listFn(),
  });

  const { data: kpis } = useQuery({
    queryKey: ["tasks-kpis"],
    queryFn: () => kpisFn(),
  });


  const createMut = useMutation({
    mutationFn: (v: any) => createFn({ data: v }),
    onSuccess: () => {
      toast.success("Tarefa criada");
      setOpenCreate(false);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatusMut = useMutation({
    mutationFn: (v: any) => updateStatusFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDueDate(format(new Date(), "yyyy-MM-dd"));
    setDueTime("");
    setPriority("medium");
    setType("other");
  };

  const handlePrev = () => {
    if (view === "month") setCurrentDate(subMonths(currentDate, 1));
    // Week and day logic could be added
  };

  const handleNext = () => {
    if (view === "month") setCurrentDate(addMonths(currentDate, 1));
    // Week and day logic could be added
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const tasksByDay = tasks.reduce((acc: any, task: any) => {
    const day = format(new Date(task.due_date), "yyyy-MM-dd");
    if (!acc[day]) acc[day] = [];
    acc[day].push(task);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operação"
        title="Agenda"
        description="Gerencie seus compromissos e tarefas diárias."
        actions={
          <Button onClick={() => setOpenCreate(true)}>
            <Plus className="mr-2 size-4" /> Nova tarefa
          </Button>
        }
      />

      {kpis && kpis.overdueCount > 0 && (
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-full">
                <AlertCircle className="size-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium text-destructive">Tarefas Atrasadas</p>
                <p className="text-2xl font-bold">{kpis.overdueCount}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Fuso horário: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
            </div>
          </CardContent>
        </Card>
      )}


      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-display font-medium capitalize">
            {format(currentDate, "MMMM yyyy", { locale: ptBR })}
          </h2>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" onClick={handlePrev}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button size="icon" variant="outline" onClick={handleNext}>
              <ChevronRight className="size-4" />
            </Button>
            <Button variant="outline" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
          </div>
        </div>
        <div className="flex bg-muted rounded-lg p-1">
          <Button 
            variant={view === "month" ? "secondary" : "ghost"} 
            size="sm"
            onClick={() => setView("month")}
          >Mês</Button>
          <Button 
            variant={view === "week" ? "secondary" : "ghost"} 
            size="sm"
            onClick={() => setView("week")}
            disabled
          >Semana</Button>
          <Button 
            variant={view === "day" ? "secondary" : "ghost"} 
            size="sm"
            onClick={() => setView("day")}
            disabled
          >Dia</Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-t border-l border-border rounded-xl overflow-hidden shadow-sm">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="bg-muted/50 py-2 text-center text-xs font-medium text-muted-foreground border-b border-r border-border uppercase tracking-wider">
            {d}
          </div>
        ))}
        {days.map((day, i) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDay[dayKey] || [];
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());

          return (
            <div 
              key={i} 
              className={`min-h-[140px] p-2 border-b border-r border-border transition-colors ${!isCurrentMonth ? "bg-muted/20 opacity-40" : "bg-card/40"} ${isToday ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""}`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className={`text-sm font-medium size-7 flex items-center justify-center rounded-full ${isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  {format(day, "d")}
                </span>
                {dayTasks.length > 0 && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1">
                    {dayTasks.length}
                  </Badge>
                )}
              </div>
              <div className="space-y-1 overflow-hidden">
                {dayTasks.slice(0, 3).map((task: any) => {
                  const Icon = TASK_TYPE_ICONS[task.type as keyof typeof TASK_TYPE_ICONS] || HelpCircle;
                  return (
                    <div 
                      key={task.id} 
                      className={`group flex items-center gap-1.5 p-1 rounded border text-[10px] truncate cursor-pointer ${task.status === 'completed' ? "opacity-60 bg-muted/50 grayscale" : "bg-background border-border hover:border-primary/50"}`}
                      onClick={() => {
                        // View task logic
                      }}
                    >
                      <Icon className="size-3 shrink-0" />
                      <span className="truncate flex-1">{task.title}</span>
                      {task.due_time && (
                        <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
                          {task.due_time.substring(0, 5)}
                        </span>
                      )}
                    </div>
                  );
                })}
                {dayTasks.length > 3 && (
                  <p className="text-[10px] text-muted-foreground text-center">+ {dayTasks.length - 3} mais</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input 
                id="title" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder="Ex: Ligar para cliente João"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Data</Label>
                <Input 
                  id="date" 
                  type="date" 
                  value={dueDate} 
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Horário (Opcional)</Label>
                <Input 
                  id="time" 
                  type="time" 
                  value={dueTime} 
                  onChange={(e) => setDueTime(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <select 
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
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
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea 
                id="description" 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes da tarefa..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCreate(false)}>Cancelar</Button>
            <Button 
              onClick={() => createMut.mutate({ 
                title, 
                description, 
                due_date: dueDate, 
                due_time: dueTime || null, 
                priority, 
                type 
              })}
              disabled={createMut.isPending || !title}
            >
              Criar Tarefa
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
