import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format, startOfMonth, endOfMonth, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Plus,
  Trash2,
  Wallet,
  TrendingUp,
  Receipt,
  CalendarClock,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  createExpense,
  deleteExpense,
  getCashFlow,
  listExpenses,
  listPayables,
  listReceivables,
} from "@/features/finance/finance.functions";
import { EXPENSE_CATEGORIES, expenseSchema, type ExpenseInput } from "@/features/finance/schemas";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: FinancePage,
});

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2, 210 90% 60%))", "hsl(var(--chart-3, 30 90% 60%))", "hsl(var(--chart-4, 340 82% 62%))", "hsl(var(--chart-5, 160 70% 45%))", "hsl(var(--chart-6, 260 70% 65%))", "hsl(var(--muted-foreground))"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function FinancePage() {
  const [from, setFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [category, setCategory] = useState<string>("all");

  const granularity = useMemo<"day" | "month">(
    () => (differenceInDays(parseISO(to), parseISO(from)) > 90 ? "month" : "day"),
    [from, to],
  );

  const cashFlowFn = useServerFn(getCashFlow);
  const receivablesFn = useServerFn(listReceivables);
  const payablesFn = useServerFn(listPayables);
  const expensesFn = useServerFn(listExpenses);

  const cashQ = useQuery({
    queryKey: ["finance", "cashflow", from, to, granularity],
    queryFn: () => cashFlowFn({ data: { from, to, granularity } }),
  });
  const receivablesQ = useQuery({ queryKey: ["finance", "receivables"], queryFn: () => receivablesFn() });
  const payablesQ = useQuery({ queryKey: ["finance", "payables"], queryFn: () => payablesFn() });
  const expensesQ = useQuery({
    queryKey: ["finance", "expenses", from, to, category],
    queryFn: () =>
      expensesFn({
        data: {
          from,
          to,
          category: category !== "all" ? (category as (typeof EXPENSE_CATEGORIES)[number]) : undefined,
        },
      }),
  });

  const totals = cashQ.data?.totals;

  function setPreset(preset: "month" | "30d" | "90d" | "ytd") {
    const now = new Date();
    if (preset === "month") {
      setFrom(format(startOfMonth(now), "yyyy-MM-dd"));
      setTo(format(endOfMonth(now), "yyyy-MM-dd"));
    } else if (preset === "30d") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setFrom(format(d, "yyyy-MM-dd"));
      setTo(todayISO());
    } else if (preset === "90d") {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      setFrom(format(d, "yyyy-MM-dd"));
      setTo(todayISO());
    } else {
      setFrom(format(new Date(now.getFullYear(), 0, 1), "yyyy-MM-dd"));
      setTo(todayISO());
    }
  }

  function exportCSV() {
    if (!cashQ.data) return;
    const rows: string[][] = [["Data", "Tipo", "Descrição", "Categoria/Método", "Valor"]];
    for (const p of cashQ.data.payments) {
      rows.push([
        format(new Date(p.paid_at), "yyyy-MM-dd"),
        p.direction === "in" ? "Entrada" : "Saída",
        `Pedido #${p.orders?.order_number ?? "—"} ${(p.orders?.brand ?? "") + " " + (p.orders?.model ?? "")}`.trim(),
        p.method ?? "",
        String(Number(p.amount).toFixed(2)),
      ]);
    }
    for (const e of cashQ.data.expenses) {
      rows.push([e.incurred_at, "Saída", e.description ?? "Despesa", e.category ?? "", String(Number(e.amount).toFixed(2))]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro_${from}_a_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado");
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader
        eyebrow="Gestão"
        title="Financeiro"
        description="Fluxo de caixa, entradas, saídas e contas a receber e a pagar."
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setPreset("month")}>
                Mês
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPreset("30d")}>
                30d
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPreset("90d")}>
                90d
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPreset("ytd")}>
                Ano
              </Button>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <Label className="text-xs">De</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[140px]" />
              </div>
              <div>
                <Label className="text-xs">Até</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[140px]" />
              </div>
            </div>
            <Button size="sm" onClick={exportCSV} disabled={!cashQ.data}>
              <Download className="mr-1 h-4 w-4" /> Exportar
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Entradas" value={formatBRL(totals?.totalIn ?? 0)} icon={ArrowUpRight} accent="success" />
        <StatCard label="Saídas" value={formatBRL(totals?.totalOut ?? 0)} icon={ArrowDownRight} accent="warning" />
        <StatCard
          label="Resultado do período"
          value={formatBRL(totals?.net ?? 0)}
          icon={TrendingUp}
          accent={(totals?.net ?? 0) >= 0 ? "success" : "warning"}
        />
        <StatCard label="Despesas" value={formatBRL(totals?.totalExpenses ?? 0)} icon={Receipt} accent="gold" />
      </div>

      <Tabs defaultValue="cashflow" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="cashflow">Fluxo de caixa</TabsTrigger>
          <TabsTrigger value="entries">Entradas</TabsTrigger>
          <TabsTrigger value="exits">Saídas</TabsTrigger>
          <TabsTrigger value="receivables">A receber</TabsTrigger>
          <TabsTrigger value="payables">A pagar</TabsTrigger>
          <TabsTrigger value="expenses">Despesas</TabsTrigger>
        </TabsList>

        <TabsContent value="cashflow" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Evolução {granularity === "month" ? "mensal" : "diária"}</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                {cashQ.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : !cashQ.data?.chart.length ? (
                  <EmptyState title="Sem lançamentos" description="Nenhum movimento no período." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cashQ.data.chart}>
                      <defs>
                        <linearGradient id="g-in" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="g-out" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.55} />
                          <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                      <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v)} />
                      <Tooltip formatter={(v: number) => formatBRL(v)} labelClassName="text-foreground" contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Area type="monotone" dataKey="inflow" name="Entradas" stroke="hsl(var(--primary))" fill="url(#g-in)" strokeWidth={2} />
                      <Area type="monotone" dataKey="outflow" name="Saídas" stroke="hsl(var(--destructive))" fill="url(#g-out)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Despesas por categoria</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                {cashQ.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : !cashQ.data?.categories.length ? (
                  <EmptyState title="Sem despesas" description="Nada lançado no período." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={cashQ.data.categories} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                        {cashQ.data.categories.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Comparativo entradas x saídas</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {cashQ.data?.chart.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashQ.data.chart}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v)} />
                    <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="inflow" name="Entradas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="outflow" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="Sem lançamentos" description="Nada no período." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entries">
          <PaymentsTable
            loading={cashQ.isLoading}
            payments={(cashQ.data?.payments ?? []).filter((p) => p.direction === "in")}
            emptyLabel="Nenhuma entrada no período."
          />
        </TabsContent>

        <TabsContent value="exits">
          <PaymentsTable
            loading={cashQ.isLoading}
            payments={(cashQ.data?.payments ?? []).filter((p) => p.direction === "out")}
            emptyLabel="Nenhuma saída no período."
          />
        </TabsContent>

        <TabsContent value="receivables">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Contas a receber</CardTitle>
                <p className="text-sm text-muted-foreground">Pedidos com saldo em aberto de clientes.</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Total em aberto</div>
                <div className="text-lg font-semibold">{formatBRL(receivablesQ.data?.total ?? 0)}</div>
              </div>
            </CardHeader>
            <CardContent>
              {receivablesQ.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : !receivablesQ.data?.rows.length ? (
                <EmptyState icon={Wallet} title="Nada a receber" description="Todos os pedidos estão quitados." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Recebido</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receivablesQ.data.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">#{r.order_number}</TableCell>
                        <TableCell>{r.clients?.name ?? "—"}</TableCell>
                        <TableCell>
                          <DueBadge date={r.expected_delivery} />
                        </TableCell>
                        <TableCell className="text-right">{formatBRL(r.sale_price)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatBRL(r.amount_received)}</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-500">{formatBRL(r.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payables">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Contas a pagar</CardTitle>
                <p className="text-sm text-muted-foreground">Pedidos com custo em aberto junto a fornecedores.</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Total em aberto</div>
                <div className="text-lg font-semibold">{formatBRL(payablesQ.data?.total ?? 0)}</div>
              </div>
            </CardHeader>
            <CardContent>
              {payablesQ.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : !payablesQ.data?.rows.length ? (
                <EmptyState icon={Wallet} title="Nada a pagar" description="Nenhum saldo pendente com fornecedores." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Previsão</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payablesQ.data.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">#{r.order_number}</TableCell>
                        <TableCell>{r.suppliers?.name ?? "—"}</TableCell>
                        <TableCell>
                          <DueBadge date={r.expected_delivery ?? r.purchase_date} />
                        </TableCell>
                        <TableCell className="text-right">{formatBRL(r.cost_price)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatBRL(r.paid)}</TableCell>
                        <TableCell className="text-right font-semibold text-destructive">{formatBRL(r.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <ExpensesTab
            from={from}
            to={to}
            category={category}
            setCategory={setCategory}
            expenses={expensesQ.data ?? []}
            loading={expensesQ.isLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PaymentsTable({
  payments,
  loading,
  emptyLabel,
}: {
  payments: NonNullable<Awaited<ReturnType<typeof getCashFlow>>>["payments"];
  loading: boolean;
  emptyLabel: string;
}) {
  const total = payments.reduce((a, b) => a + Number(b.amount), 0);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{payments.length} lançamento(s)</CardTitle>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-lg font-semibold">{formatBRL(total)}</div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : !payments.length ? (
          <EmptyState title="Sem movimentos" description={emptyLabel} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Contraparte</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.paid_at)}</TableCell>
                  <TableCell className="font-medium">#{p.orders?.order_number ?? "—"}</TableCell>
                  <TableCell>
                    {p.direction === "in" ? p.orders?.clients?.name ?? "—" : p.orders?.suppliers?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.method ?? "—"}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold",
                      p.direction === "in" ? "text-emerald-500" : "text-destructive",
                    )}
                  >
                    {p.direction === "in" ? "+" : "-"} {formatBRL(p.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function DueBadge({ date }: { date: string | null | undefined }) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  const days = differenceInDays(parseISO(date), new Date());
  const label = format(parseISO(date), "dd MMM", { locale: ptBR });
  if (days < 0) return <Badge variant="destructive">{label} · atrasado</Badge>;
  if (days <= 7) return <Badge className="bg-amber-500/15 text-amber-500">{label} · {days}d</Badge>;
  return <Badge variant="outline">{label}</Badge>;
}

function ExpensesTab({
  from,
  to,
  category,
  setCategory,
  expenses,
  loading,
}: {
  from: string;
  to: string;
  category: string;
  setCategory: (v: string) => void;
  expenses: Array<{ id: string; description: string | null; amount: number; category: string | null; incurred_at: string }>;
  loading: boolean;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createExpense);
  const deleteFn = useServerFn(deleteExpense);
  const [open, setOpen] = useState(false);

  const form = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: "",
      amount: 0,
      category: "Operacional",
      incurred_at: todayISO(),
    },
  });

  const createMut = useMutation({
    mutationFn: (v: ExpenseInput) => createFn({ data: v }),
    onSuccess: () => {
      toast.success("Despesa registrada");
      setOpen(false);
      form.reset({ description: "", amount: 0, category: "Operacional", incurred_at: todayISO() });
      qc.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (e: unknown) => toast.error("Erro", { description: e instanceof Error ? e.message : "" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Despesa removida");
      qc.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (e: unknown) => toast.error("Erro", { description: e instanceof Error ? e.message : "" }),
  });

  const total = expenses.reduce((a, b) => a + Number(b.amount), 0);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Despesas do período</CardTitle>
          <p className="text-sm text-muted-foreground">
            {expenses.length} lançamento(s) · {formatBRL(total)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nova despesa</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar despesa</DialogTitle></DialogHeader>
              <form
                className="space-y-3"
                onSubmit={form.handleSubmit((v) => createMut.mutate(v))}
              >
                <div>
                  <Label>Descrição</Label>
                  <Input {...form.register("description")} placeholder="Ex.: Impulsionamento Instagram" />
                  {form.formState.errors.description && (
                    <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Valor (R$)</Label>
                    <Input type="number" step="0.01" {...form.register("amount")} />
                    {form.formState.errors.amount && (
                      <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Data</Label>
                    <Input type="date" {...form.register("incurred_at")} />
                  </div>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={form.watch("category")}
                    onValueChange={(v) => form.setValue("category", v as (typeof EXPENSE_CATEGORIES)[number])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createMut.isPending}>Salvar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : !expenses.length ? (
          <EmptyState icon={CalendarClock} title="Sem despesas" description={`De ${formatDate(from)} até ${formatDate(to)}.`} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{formatDate(e.incurred_at)}</TableCell>
                  <TableCell className="font-medium">{e.description ?? "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{e.category ?? "Outros"}</Badge></TableCell>
                  <TableCell className="text-right font-semibold text-destructive">- {formatBRL(e.amount)}</TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover despesa?</AlertDialogTitle>
                          <AlertDialogDescription>Essa ação é permanente.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMut.mutate(e.id)}>Remover</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
