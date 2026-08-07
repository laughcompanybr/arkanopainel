import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMonthlyReport, updateMonthlyReport } from "@/features/reports/monthly.functions";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL, formatDate } from "@/lib/format";
import { 
  TrendingUp, 
  CircleDollarSign, 
  ReceiptText, 
  Package,
  FileText,
  ArrowLeft,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  ArrowUpRight,
  TrendingDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, Suspense } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/mensais/$year/$month")({
  component: MonthlyReportDetailPage,
});

const reportQueryOptions = (year: number, month: number, fetchFn: any) =>
  queryOptions({
    queryKey: ["monthly-report", year, month],
    queryFn: () => fetchFn({ data: { year, month } }),
  });

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function MonthlyReportDetailPage() {
  const { year, month } = Route.useParams();
  const y = parseInt(year);
  const m = parseInt(month);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/mensais">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <PageHeader
            eyebrow="Relatório Detalhado"
            title={`${MONTH_NAMES[m - 1]} ${y}`}
            description={`Painel operacional completo do período de ${MONTH_NAMES[m - 1]}.`}
          />
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" asChild>
             <Link to="/pedidos">
               <Plus className="mr-2 size-4" /> Novo Pedido
             </Link>
           </Button>
           <Button variant="outline" size="sm" asChild>
             <Link to="/financeiro">
               <ReceiptText className="mr-2 size-4" /> Novo Lançamento
             </Link>
           </Button>
        </div>
      </div>

      <Suspense key={`${y}-${m}`} fallback={<ReportSkeleton />}>
        <ReportContent key={`${y}-${m}`} year={y} month={m} />
      </Suspense>
    </div>
  );
}

function ReportContent({ year, month }: { year: number; month: number }) {
  const qc = useQueryClient();
  const fetchReport = useServerFn(getMonthlyReport);
  const saveReport = useServerFn(updateMonthlyReport);
  const { data } = useSuspenseQuery(reportQueryOptions(year, month, fetchReport));

  const [obs, setObs] = useState(data.observations ?? "");
  const [revenueOv, setRevenueOv] = useState(
    data.overrides.revenue_override != null ? String(data.overrides.revenue_override) : "",
  );
  const [expensesOv, setExpensesOv] = useState(
    data.overrides.expenses_override != null ? String(data.overrides.expenses_override) : "",
  );
  const [profitOv, setProfitOv] = useState(
    data.overrides.profit_override != null ? String(data.overrides.profit_override) : "",
  );
  const [ordersOv, setOrdersOv] = useState(
    data.overrides.orders_count_override != null ? String(data.overrides.orders_count_override) : "",
  );

  const saveMut = useMutation({
    mutationFn: () =>
      saveReport({
        data: {
          year,
          month,
          observations: obs.trim() === "" ? null : obs,
          revenue_override: revenueOv,
          expenses_override: expensesOv,
          profit_override: profitOv,
          orders_count_override: ordersOv,
        },
      }),
    onSuccess: async () => {
      toast.success("Relatório do mês salvo!");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["monthly-report", year, month] }),
        qc.invalidateQueries({ queryKey: ["monthly-summary"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao salvar o relatório."),
  });

  const isSaving = saveMut.isPending;
  const handleSaveObs = () => saveMut.mutate();


  return (
    <div className="space-y-6">
      {/* Overview KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Receita Total" value={formatBRL(data.revenue)} icon={TrendingUp} color="text-blue-500" />
        <KpiCard label="Lucro Líquido" value={formatBRL(data.profit)} icon={CircleDollarSign} color={data.profit >= 0 ? "text-emerald-500" : "text-rose-500"} />
        <KpiCard label="Despesas" value={formatBRL(data.expenses)} icon={ReceiptText} color="text-rose-500" />
        <KpiCard label="Novos Clientes" value={data.newClients.toString()} icon={Users} color="text-amber-500" />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-background/60 border">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="orders">Pedidos ({data.ordersCount})</TabsTrigger>
          <TabsTrigger value="finance">Financeiro</TabsTrigger>
          <TabsTrigger value="products">Produtos</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Pipeline Status */}
            <Card className="p-6">
              <h3 className="mb-6 font-display text-lg font-semibold">Funil de Pedidos</h3>
              <div className="space-y-4">
                <StatusRow label="Concluídos" count={data.ordersCompleted} icon={CheckCircle2} color="text-emerald-500" />
                <StatusRow label="Pendentes" count={data.ordersPending} icon={Clock} color="text-amber-500" />
                <StatusRow label="Cancelados" count={data.ordersCancelled} icon={XCircle} color="text-rose-500" />
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between font-medium">
                    <span>Total de Pedidos</span>
                    <span>{data.ordersCount}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Financial Summary */}
            <Card className="p-6">
              <h3 className="mb-6 font-display text-lg font-semibold">Resumo Financeiro</h3>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Lucro Bruto (Pedidos)</span>
                  <span className="font-medium">{formatBRL(data.profitGross)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Despesas & Saídas</span>
                  <span className="font-medium text-rose-500">-{formatBRL(data.expenses)}</span>
                </div>
                <div className="border-t pt-4 flex justify-between font-bold text-lg">
                  <span>Lucro Líquido</span>
                  <span className={data.profit >= 0 ? "text-emerald-500" : "text-rose-500"}>
                    {formatBRL(data.profit)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>Valor Efetivamente Recebido</span>
                  <span>{formatBRL(data.received)}</span>
                </div>
              </div>
            </Card>

            {/* Edição do mês */}
            <Card className="p-6">
              <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
                <FileText className="size-5" />
                Editar mês
              </h3>
              <Textarea
                placeholder="Notas operacionais sobre este mês..."
                className="min-h-[100px] resize-none border-dashed bg-muted/20"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
              />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="revenue-ov" className="text-xs">Receita</Label>
                  <Input id="revenue-ov" inputMode="decimal" placeholder="automático" value={revenueOv} onChange={(e) => setRevenueOv(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expenses-ov" className="text-xs">Despesas</Label>
                  <Input id="expenses-ov" inputMode="decimal" placeholder="automático" value={expensesOv} onChange={(e) => setExpensesOv(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="profit-ov" className="text-xs">Lucro</Label>
                  <Input id="profit-ov" inputMode="decimal" placeholder="automático" value={profitOv} onChange={(e) => setProfitOv(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="orders-ov" className="text-xs">Pedidos</Label>
                  <Input id="orders-ov" inputMode="numeric" placeholder="automático" value={ordersOv} onChange={(e) => setOrdersOv(e.target.value)} />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Deixe em branco para usar os valores calculados automaticamente.
              </p>
              <Button className="mt-4 w-full" onClick={handleSaveObs} disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar mês"}
              </Button>
            </Card>

          </div>
        </TabsContent>

        <TabsContent value="orders">
          <Card className="overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-foreground">Relatório de Pedidos</h3>
              <Button variant="outline" size="sm" asChild>
                <Link to="/pedidos">Gerenciar todos os pedidos</Link>
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-6 py-3 font-medium">Pedido</th>
                    <th className="px-6 py-3 font-medium">Data</th>
                    <th className="px-6 py-3 font-medium">Cliente</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.orders.map((order: any) => (
                    <tr key={order.id} className="hover:bg-accent/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs">#{order.order_number}</td>
                      <td className="px-6 py-4 text-muted-foreground">{formatDate(order.created_at)}</td>
                      <td className="px-6 py-4">{order.clients?.name || "—"}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {order.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right font-medium">{formatBRL(order.sale_price * (order.quantity || 1))}</td>
                    </tr>
                  ))}
                  {data.orders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground">
                        Nenhum pedido registrado neste mês.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="finance">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <h3 className="mb-4 font-display text-lg font-semibold">Detalhamento de Despesas</h3>
              <div className="space-y-3">
                {data.expenses_list.length > 0 ? (
                  data.expenses_list.map((exp: any) => (
                    <div key={exp.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/30 transition-colors">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{exp.description}</p>
                        <p className="text-xs text-muted-foreground">{exp.category || "Outros"} · {formatDate(exp.incurred_at)}</p>
                      </div>
                      <span className="font-medium text-rose-500">-{formatBRL(exp.amount)}</span>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma despesa lançada.</p>
                )}
              </div>
            </Card>
            <Card className="p-6 flex flex-col justify-center items-center text-center">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <CircleDollarSign className="size-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Fluxo de Caixa Mensal</h3>
              <p className="text-sm text-muted-foreground max-w-xs mb-6">
                Para um controle detalhado de entradas e saídas, acesse o módulo financeiro principal.
              </p>
              <Button asChild>
                <Link to="/financeiro">Acessar Financeiro</Link>
              </Button>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products">
          <Card className="p-6">
            <h3 className="mb-6 font-display text-lg font-semibold">Produtos & Serviços Mais Vendidos</h3>
            <div className="space-y-4">
              {data.topProducts.length > 0 ? (
                data.topProducts.map((p: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-4 rounded-xl border p-4 hover:bg-accent/30 transition-colors">
                    <div className="grid size-10 place-items-center rounded-lg bg-primary/10 font-mono text-sm font-bold text-primary">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{p.label}</p>
                      <p className="text-xs text-muted-foreground">{p.quantity} unidades vendidas</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatBRL(p.revenue)}</p>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-500">
                        <ArrowUpRight className="size-3" /> em receita
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-12 text-center text-muted-foreground">Nenhuma venda realizada neste período.</p>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <Card className="p-6 relative overflow-hidden group">
      <div className="flex items-center justify-between relative z-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className={`p-2 rounded-lg bg-background border shadow-sm ${color}`}>
          <Icon className="size-4" />
        </div>
      </div>
      <p className={`mt-4 font-display text-2xl font-bold relative z-10 ${color}`}>{value}</p>
      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon className="size-24" />
      </div>
    </Card>
  );
}

function StatusRow({ label, count, icon: Icon, color }: { label: string; count: number; icon: any; color: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <Icon className={`size-4 ${color}`} />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <span className="font-bold">{count}</span>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-[300px]" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-[300px] lg:col-span-2" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    </div>
  );
}