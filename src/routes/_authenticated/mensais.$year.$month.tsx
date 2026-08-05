import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getMonthlyReport, updateMonthlyObservations, updateMonthlyOverrides } from "@/features/reports/monthly.functions";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/card";
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
import { useState, Suspense, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [isEditing, setIsEditing] = useState(false);

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
           <Button 
             variant={isEditing ? "default" : "secondary"} 
             size="sm" 
             onClick={() => setIsEditing(!isEditing)}
             className={!isEditing ? "bg-primary/10 text-primary hover:bg-primary/20" : ""}
           >
             {isEditing ? "Cancelar Edição" : "Editar Dados do Mês"}
           </Button>
           <Button variant="outline" size="sm" asChild>
             <Link to="/pedidos">
               <Plus className="mr-2 size-4" /> Novo Pedido
             </Link>
           </Button>
        </div>
      </div>

      <Suspense fallback={<ReportSkeleton />}>
        <ReportContent 
          year={y} 
          month={m} 
          isEditing={isEditing} 
          setIsEditing={setIsEditing} 
        />
      </Suspense>
    </div>
  );
}

function ReportContent({ 
  year, 
  month,
  isEditing,
  setIsEditing
}: { 
  year: number; 
  month: number;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
}) {
  const fetchReport = useServerFn(getMonthlyReport);
  const updateObs = useServerFn(updateMonthlyObservations);
  const updateOverrides = useServerFn(updateMonthlyOverrides);
  const { data, refetch, isRefetching, error } = useSuspenseQuery(reportQueryOptions(year, month, fetchReport));
  
  useEffect(() => {
    if (error) {
      toast.error("Erro ao carregar detalhes do mês. Tente novamente.");
    }
  }, [error]);
  const [obs, setObs] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  const [editForm, setEditForm] = useState({
    revenue: 0,
    expenses: 0,
    profit: 0,
    ordersCount: 0
  });

  useEffect(() => {
    if (data) {
      setObs(data.observations || "");
      // Safety: Ensure overrides property is handled if needed
      setEditForm({
        revenue: typeof data.revenue === 'number' ? data.revenue : 0,
        expenses: typeof data.expenses === 'number' ? data.expenses : 0,
        profit: typeof data.profit === 'number' ? data.profit : 0,
        ordersCount: typeof data.ordersCount === 'number' ? data.ordersCount : 0
      });
    } else {
      toast.error("Dados do relatório não encontrados para este período.");
    }
  }, [data]);

  const handleSaveOverrides = async () => {
    if (editForm.revenue < 0 || editForm.expenses < 0 || editForm.ordersCount < 0) {
      toast.error("Valores não podem ser negativos");
      return;
    }

    try {
      setIsSaving(true);
      await updateOverrides({ 
        data: { 
          year, 
          month, 
          revenue: editForm.revenue,
          expenses: editForm.expenses,
          profit: editForm.profit,
          ordersCount: editForm.ordersCount
        } 
      });
      toast.success("Dados do mês atualizados com sucesso!");
      setIsEditing(false);
      refetch();
    } catch (error) {
      toast.error("Erro ao atualizar dados do mês.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetOverrides = async () => {
    try {
      setIsSaving(true);
      await updateOverrides({ 
        data: { 
          year, 
          month, 
          revenue: null,
          expenses: null,
          profit: null,
          ordersCount: null
        } 
      });
      toast.success("Valores originais restaurados.");
      setIsEditing(false);
      refetch();
    } catch (error) {
      toast.error("Erro ao restaurar valores.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveObs = async () => {
    try {
      setIsSaving(true);
      await updateObs({ data: { year, month, observations: obs } });
      toast.success("Observações salvas com sucesso!");
      refetch();
    } catch (error) {
      toast.error("Erro ao salvar observações.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <Card className="p-6 border-primary/50 bg-primary/5">
              <div className="flex items-center gap-2 mb-4 text-primary font-display font-semibold">
                <FileText className="size-5" />
                Edição Manual de Metas & Realizados
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Receita Total</label>
                  <div className="relative">
                    <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input 
                      type="number" 
                      className="w-full bg-background border rounded-lg px-9 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                      value={editForm.revenue}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setEditForm(prev => ({ ...prev, revenue: isNaN(val) ? 0 : val }));
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Despesas</label>
                  <div className="relative">
                    <ReceiptText className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input 
                      type="number" 
                      className="w-full bg-background border rounded-lg px-9 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                      value={editForm.expenses}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setEditForm(prev => ({ ...prev, expenses: isNaN(val) ? 0 : val }));
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lucro Líquido</label>
                  <div className="relative">
                    <CircleDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input 
                      type="number" 
                      className="w-full bg-background border rounded-lg px-9 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                      value={editForm.profit}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setEditForm(prev => ({ ...prev, profit: isNaN(val) ? 0 : val }));
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Pedidos</label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input 
                      type="number" 
                      className="w-full bg-background border rounded-lg px-9 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                      value={editForm.ordersCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setEditForm(prev => ({ ...prev, ordersCount: isNaN(val) ? 0 : val }));
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t pt-4">
                <Button variant="ghost" size="sm" onClick={handleResetOverrides} disabled={isSaving}>
                  Restaurar Original
                </Button>
                <Button size="sm" onClick={handleSaveOverrides} disabled={isSaving} className="gap-2">
                  {isSaving ? "Salvando..." : <><TrendingUp className="size-4" /> Atualizar Dashboard</>}
                </Button>
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground italic">
                * Valores editados manualmente terão prioridade sobre os cálculos automáticos no Dashboard e Relatórios.
              </p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Overview KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Receita Total" value={formatBRL(data.revenue)} icon={TrendingUp} color="text-blue-500" loading={isRefetching} />
        <KpiCard label="Lucro Líquido" value={formatBRL(data.profit)} icon={CircleDollarSign} color={data.profit >= 0 ? "text-emerald-500" : "text-rose-500"} loading={isRefetching} />
        <KpiCard label="Despesas" value={formatBRL(data.expenses)} icon={ReceiptText} color="text-rose-500" loading={isRefetching} />
        <KpiCard label="Novos Clientes" value={data.newClients.toString()} icon={Users} color="text-amber-500" loading={isRefetching} />
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

            {/* Observations */}
            <Card className="p-6">
              <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
                <FileText className="size-5" />
                Observações
              </h3>
              <Textarea
                placeholder="Notas operacionais sobre este mês..."
                className="min-h-[140px] resize-none border-dashed bg-muted/20"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
              />
            <Button 
                className="mt-4 w-full" 
                onClick={handleSaveObs} 
                disabled={isSaving}
              >
                {isSaving ? "Salvando..." : "Salvar Notas do Mês"}
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

function KpiCard({ label, value, icon: Icon, color, loading }: { label: string; value: string; icon: any; color: string; loading?: boolean }) {
  if (loading) return <Skeleton className="h-32 w-full" />;
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