import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/card";
import { CalendarDays, ChevronRight, TrendingUp, ReceiptText, CircleDollarSign, Package, ArrowLeftRight, X, TrendingDown, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMonthlySummary } from "@/features/reports/monthly.functions";
import { formatBRL } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { lazy, Suspense, useState, memo } from "react";
import { Button } from "@/components/ui/button";

const MonthCard = memo(({ month, index, selectedYear, report, isLoading }: any) => {
  const navigate = useNavigate();
  
  const handleEdit = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate({
      to: "/mensais/$year/$month",
      params: { year: selectedYear.toString(), month: (index + 1).toString() }
    });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleEdit(e);
        }
      }}
      className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl transition-all"
      aria-label={`Ver detalhes de ${month} ${selectedYear}`}
    >
    <Card className="group relative overflow-hidden p-6 transition-all hover:border-primary/50 hover:bg-accent/50">
      {report?.ordersCount !== undefined && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="size-8 rounded-full bg-background/80 backdrop-blur shadow-sm">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
            <CalendarDays className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-semibold">{month}</h3>
              {report?.ordersCount !== undefined && (
                <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" title="Mês ativo" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">{selectedYear}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <Link
            to="/mensais/$year/$month"
            params={{ year: selectedYear.toString(), month: (index + 1).toString() }}
          >
            <Button size="sm" variant="secondary" className="text-[10px] font-bold h-7 px-2">
              DETALHES & EDIÇÃO
            </Button>
          </Link>
        </div>
        <div className="space-y-1">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Package className="size-3" /> Pedidos
          </p>
          <div className="font-display text-lg font-medium">
            {isLoading ? <Skeleton className="h-6 w-12" /> : report?.ordersCount || 0}
          </div>
        </div>

        <div className="space-y-1">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="size-3" /> Receita
          </p>
          <div className="truncate font-display text-lg font-medium text-blue-500">
            {isLoading ? <Skeleton className="h-6 w-20" /> : formatBRL(report?.revenue || 0)}
          </div>
        </div>

        <div className="space-y-1">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <ReceiptText className="size-3" /> Despesas
          </p>
          <div className="truncate font-display text-lg font-medium text-rose-500">
            {isLoading ? <Skeleton className="h-6 w-20" /> : formatBRL(report?.expenses || 0)}
          </div>
        </div>

        <div className="space-y-1">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <CircleDollarSign className="size-3" /> Lucro
          </p>
          <div className={`truncate font-display text-lg font-medium ${report?.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {isLoading ? <Skeleton className="h-6 w-20" /> : formatBRL(report?.profit || 0)}
          </div>
        </div>

      </div>
    </Card>
    </div>
  );
});
MonthCard.displayName = "MonthCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { compareMonthlyReports } from "@/features/reports/comparison.functions";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/mensais")({
  component: MensaisPage,
});

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function MensaisPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const fetchSummary = useServerFn(getMonthlySummary);
  const [showCompare, setShowCompare] = useState(false);
  
  const { data: reports, isLoading } = useQuery({
    queryKey: ["monthly-summary", selectedYear],
    queryFn: () => fetchSummary({ data: { year: selectedYear } }),
  });

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          eyebrow="Relatórios"
          title="Mensais"
          description="Gestão completa do histórico operacional por período."
        />
        <div className="flex items-center gap-2">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => setShowCompare(true)}
          >
            <ArrowLeftRight className="size-4" />
            Comparar Meses
          </Button>
        </div>
      </div>

      <Suspense fallback={null}>
        <ComparisonDialog 
          open={showCompare} 
          onOpenChange={setShowCompare} 
          year={selectedYear}
        />
      </Suspense>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MONTHS.map((month, index) => {
          const report = reports?.find(r => r.month === index + 1);
          
          return (
            <motion.div
              key={month}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Suspense fallback={<Skeleton className="h-[240px] w-full rounded-2xl" />}>
                <MonthCard 
                  month={month}
                  index={index}
                  selectedYear={selectedYear}
                  report={report}
                  isLoading={isLoading}
                />
              </Suspense>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

const ComparisonDialog = ({ open, onOpenChange, year }: { open: boolean, onOpenChange: (o: boolean) => void, year: number }) => {
  const [m1, setM1] = useState("1");
  const [m2, setM2] = useState("2");
  const compareFn = useServerFn(compareMonthlyReports);

  const { data, isLoading } = useQuery({
    queryKey: ["comparison", year, m1, m2],
    queryFn: () => compareFn({ data: { 
      m1: { month: parseInt(m1), year }, 
      m2: { month: parseInt(m2), year } 
    } }),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comparativo Mensal</DialogTitle>
          <DialogDescription>
            Selecione dois meses para comparar o desempenho operacional.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 pt-4">
          <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-xl border border-dashed">
            <div className="flex-1 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Mês Base</p>
              <Select value={m1} onValueChange={setM1}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ArrowLeftRight className="size-5 text-muted-foreground mt-5" />
            <div className="flex-1 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Mês Alvo</p>
              <Select value={m2} onValueChange={setM2}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-8">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : data ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CompareStat 
                  label="Receita" 
                  v1={data.m1.revenue} 
                  v2={data.m2.revenue} 
                  diff={data.diff.revenue} 
                  perc={data.diff.revenuePerc} 
                  isMoney 
                />
                <CompareStat 
                  label="Despesas" 
                  v1={data.m1.expenses} 
                  v2={data.m2.expenses} 
                  diff={data.diff.expenses} 
                  perc={data.diff.expensesPerc} 
                  isMoney 
                  inverse 
                />
                <CompareStat 
                  label="Lucro Líquido" 
                  v1={data.m1.profit} 
                  v2={data.m2.profit} 
                  diff={data.diff.profit} 
                  perc={data.diff.profitPerc} 
                  isMoney 
                />
                <CompareStat 
                  label="Pedidos" 
                  v1={data.m1.ordersCount} 
                  v2={data.m2.ordersCount} 
                  diff={data.diff.orders} 
                  perc={data.diff.ordersPerc} 
                />
              </div>

              <div className="bg-muted/20 p-6 rounded-2xl border">
                <h4 className="font-display font-semibold mb-4">Análise Comparativa</h4>
                <div className="space-y-3">
                  <AnalysisLine 
                    label="Receita" 
                    perc={data.diff.revenuePerc} 
                  />
                  <AnalysisLine 
                    label="Despesas" 
                    perc={data.diff.expensesPerc} 
                    inverse 
                  />
                  <AnalysisLine 
                    label="Lucro" 
                    perc={data.diff.profitPerc} 
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const CompareStat = ({ label, v1, v2, diff, perc, isMoney, inverse }: any) => {
  const isPos = diff >= 0;
  const isGood = inverse ? !isPos : isPos;
  
  return (
    <Card className="p-4 border-l-4 border-l-primary overflow-hidden relative">
      <div className="flex justify-between items-start mb-2">
        <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
        <Badge variant={isGood ? "default" : "destructive"} className="gap-1 px-1.5">
          {isPos ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
          {Math.abs(perc).toFixed(1)}%
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground">Mês Base</p>
          <p className="font-medium">{isMoney ? formatBRL(v1) : v1}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">Mês Alvo</p>
          <p className="font-bold text-lg">{isMoney ? formatBRL(v2) : v2}</p>
        </div>
      </div>
      <div className={`mt-2 text-xs flex items-center gap-1 ${isGood ? 'text-emerald-500' : 'text-rose-500'}`}>
        {isPos ? <ArrowUpRight className="size-3" /> : <TrendingDown className="size-3" />}
        <span>{isMoney ? formatBRL(Math.abs(diff)) : Math.abs(diff)} de diferença</span>
      </div>
    </Card>
  );
}

const AnalysisLine = ({ label, perc, inverse }: any) => {
  const isPos = perc >= 0;
  const isGood = inverse ? !isPos : isPos;
  
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className={isGood ? 'text-emerald-500' : 'text-rose-500'}>
          {isPos ? '+' : ''}{perc.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all ${isGood ? 'bg-emerald-500' : 'bg-rose-500'}`}
          style={{ width: `${Math.min(100, Math.max(0, 50 + (perc / 2)))}%` }}
        />
      </div>
    </div>
  );
}
