import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Award, Target, TrendingUp, Trash2, Plus, Trophy, Crown, Pencil, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { listGoals, upsertGoal, deleteGoal, getGoalStats } from "./finance.functions";

const formatBRL = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));

const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-");
  return format(new Date(Number(y), Number(m) - 1, 1), "MMM/yyyy", { locale: ptBR });
};

export function GoalsPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listGoals);
  const statsFn = useServerFn(getGoalStats);
  const upsertFn = useServerFn(upsertGoal);
  const deleteFn = useServerFn(deleteGoal);

  const goalsQ = useQuery({ queryKey: ["finance", "goals"], queryFn: () => listFn() });
  const statsQ = useQuery({ queryKey: ["finance", "goal-stats"], queryFn: () => statsFn() });

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [salesTarget, setSalesTarget] = useState("");
  const [ordersTarget, setOrdersTarget] = useState("");
  const [profitTarget, setProfitTarget] = useState("");
  const [notes, setNotes] = useState("");

  function resetForm() {
    setEditingId(null);
    setMonth(new Date().toISOString().slice(0, 7));
    setSalesTarget("");
    setOrdersTarget("");
    setProfitTarget("");
    setNotes("");
  }

  function startEdit(g: {
    id: string;
    month: string;
    sales_target: number | string | null;
    orders_target: number | string | null;
    profit_target: number | string | null;
    notes: string | null;
  }) {
    setEditingId(g.id);
    setMonth(String(g.month).slice(0, 7));
    setSalesTarget(g.sales_target != null ? String(g.sales_target) : "");
    setOrdersTarget(g.orders_target != null ? String(g.orders_target) : "");
    setProfitTarget(g.profit_target != null ? String(g.profit_target) : "");
    setNotes(g.notes ?? "");
    setOpen(true);
  }

  const upsert = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          month,
          sales_target: salesTarget,
          orders_target: ordersTarget,
          profit_target: profitTarget,
          notes,
        },
      }),
    onSuccess: () => {
      toast.success(editingId ? "Meta atualizada" : "Meta salva");
      setOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["finance", "goals"] });
      qc.invalidateQueries({ queryKey: ["finance", "goal-stats"] });
    },
    onError: (e: unknown) => toast.error("Erro", { description: e instanceof Error ? e.message : "" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Meta removida");
      qc.invalidateQueries({ queryKey: ["finance", "goals"] });
      qc.invalidateQueries({ queryKey: ["finance", "goal-stats"] });
    },
  });

  const stats = statsQ.data;
  const currentPct = useMemo(() => {
    if (!stats?.current?.target) return 0;
    const t = Number(stats.current.target.sales_target ?? 0);
    if (!t) return 0;
    return Math.min(200, (Number(stats.current.actual.sales) / t) * 100);
  }, [stats]);
  const currentHit = currentPct >= 100;


  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Meta do mês (vendas)"
          value={formatBRL(stats?.current?.target?.sales_target ?? 0)}
          icon={currentHit ? CheckCircle2 : Target}
          accent={currentHit ? "success" : "gold"}
          hint={
            stats?.current?.target
              ? `${currentHit ? "✓ Meta batida · " : ""}${currentPct.toFixed(0)}% · ${formatBRL(stats.current.actual.sales)}`
              : "Nenhuma meta definida para este mês"
          }
        />
        <StatCard
          label="Metas batidas"
          value={String(stats?.totalHit ?? 0)}
          icon={Trophy}
          accent="success"
          hint={
            stats?.totalHit && stats.totalHit > 0
              ? `${stats.totalHit} mês${stats.totalHit === 1 ? "" : "es"} nos últimos 24`
              : "Nos últimos 24 meses"
          }
        />

        <StatCard
          label="Recorde de vendas (mês)"
          value={formatBRL(stats?.salesRecord?.sales ?? 0)}
          icon={Crown}
          accent="success"
          hint={stats?.salesRecord ? monthLabel(stats.salesRecord.month) : "—"}
        />
        <StatCard
          label="Maior venda"
          value={formatBRL(stats?.biggestSale?.amount ?? 0)}
          icon={Award}
          accent="gold"
          hint={
            stats?.biggestSale
              ? `#${stats.biggestSale.order_number} · ${stats.biggestSale.brand ?? ""} ${stats.biggestSale.model ?? ""}`.trim()
              : "—"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recordes</CardTitle>
              <p className="text-sm text-muted-foreground">Números que você superou até hoje.</p>
            </div>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <RecordRow
              label="Melhor mês em vendas"
              value={formatBRL(stats?.salesRecord?.sales ?? 0)}
              hint={stats?.salesRecord ? monthLabel(stats.salesRecord.month) : null}
            />
            <RecordRow
              label="Melhor mês em lucro"
              value={formatBRL(stats?.profitRecord?.profit ?? 0)}
              hint={stats?.profitRecord ? monthLabel(stats.profitRecord.month) : null}
            />
            <RecordRow
              label="Maior venda individual"
              value={formatBRL(stats?.biggestSale?.amount ?? 0)}
              hint={
                stats?.biggestSale
                  ? `${stats.biggestSale.client ?? "—"} · #${stats.biggestSale.order_number}`
                  : null
              }
            />
            <RecordRow
              label="Mês com mais pedidos"
              value={String(stats?.salesRecord?.orders ?? 0)}
              hint={stats?.salesRecord ? monthLabel(stats.salesRecord.month) : null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Metas do mês</CardTitle>
              <p className="text-sm text-muted-foreground">Defina metas mensais e acompanhe o desempenho.</p>
            </div>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => resetForm()}>
                  <Plus className="mr-1 h-4 w-4" /> Nova meta
                </Button>
              </DialogTrigger>
              <DialogContent description="Definir ou editar meta mensal">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar meta mensal" : "Definir meta mensal"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Mês</Label>
                    <Input
                      type="month"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      disabled={!!editingId}
                    />
                    {editingId ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        O mês não pode ser alterado. Remova e crie uma nova para outro mês.
                      </p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Meta de vendas (R$)</Label>
                      <Input
                        inputMode="decimal"
                        placeholder="0,00"
                        value={salesTarget}
                        onChange={(e) => setSalesTarget(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Meta de pedidos</Label>
                      <Input
                        inputMode="numeric"
                        placeholder="0"
                        value={ordersTarget}
                        onChange={(e) => setOrdersTarget(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Meta de lucro (R$)</Label>
                    <Input
                      inputMode="decimal"
                      placeholder="0,00"
                      value={profitTarget}
                      onChange={(e) => setProfitTarget(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
                  <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>
                    {editingId ? "Salvar alterações" : "Salvar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </CardHeader>
          <CardContent>
            {goalsQ.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !goalsQ.data?.length ? (
              <EmptyState
                icon={Target}
                title="Sem metas"
                description="Defina uma meta mensal para começar a acompanhar."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Lucro</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {goalsQ.data.map((g) => {
                    const key = String(g.month).slice(0, 7);
                    const hit = stats?.goalsHit.find((h) => h.month === key);
                    return (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium">{monthLabel(key)}</TableCell>
                        <TableCell className="text-right">
                          <div>{formatBRL(g.sales_target)}</div>
                          {hit ? (
                            <div className="text-xs text-muted-foreground">
                              {(hit.salesPct * 100).toFixed(0)}% · {formatBRL(hit.actual.sales)}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          <div>{g.orders_target}</div>
                          {hit ? (
                            <div className="text-xs text-muted-foreground">
                              {(hit.ordersPct * 100).toFixed(0)}% · {hit.actual.orders}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          <div>{formatBRL(g.profit_target)}</div>
                          {hit ? (
                            <div className="text-xs text-muted-foreground">
                              {(hit.profitPct * 100).toFixed(0)}% · {formatBRL(hit.actual.profit)}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {hit?.hit ? (
                            <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/40">
                              Batida
                            </Badge>
                          ) : (
                            <Badge variant="outline">Em andamento</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => g.id && startEdit(g)}
                              title="Editar"
                              aria-label="Editar meta"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => {
                                if (g.id && confirm(`Remover meta de ${monthLabel(key)}?`)) remove.mutate(g.id);
                              }}
                              title="Remover"
                              aria-label="Remover meta"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>

                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RecordRow({ label, value, hint }: { label: string; value: string; hint: string | null }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 py-2 last:border-0">
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {hint ? <div className="text-xs text-muted-foreground/70">{hint}</div> : null}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
