import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/card";
import { CalendarDays, ChevronRight, TrendingUp, ReceiptText, CircleDollarSign, Package, ArrowLeftRight } from "lucide-react";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMonthlySummary } from "@/features/reports/monthly.functions";
import { formatBRL } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/mensais/")({
  component: MensaisPage,
});

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function MensaisPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const fetchSummary = useServerFn(getMonthlySummary);
  
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
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeftRight className="size-4" />
            Comparar Meses
          </Button>
        </div>
      </div>

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
              <Link
                to="/mensais/$year/$month"
                params={{ year: selectedYear.toString(), month: (index + 1).toString() }}
                className="block"
              >
                <Card className="group relative overflow-hidden p-6 transition-all hover:border-primary/50 hover:bg-accent/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                        <CalendarDays className="size-5" />
                      </div>
                      <div>
                        <h3 className="font-display font-semibold">{month}</h3>
                        <p className="text-xs text-muted-foreground">{selectedYear}</p>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <Package className="size-3" /> Pedidos
                      </p>
                      <p className="font-display text-lg font-medium">
                        {isLoading ? <Skeleton className="h-6 w-12" /> : report?.ordersCount || 0}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <TrendingUp className="size-3" /> Receita
                      </p>
                      <p className="truncate font-display text-lg font-medium text-blue-500">
                        {isLoading ? <Skeleton className="h-6 w-20" /> : formatBRL(report?.revenue || 0)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <ReceiptText className="size-3" /> Despesas
                      </p>
                      <p className="truncate font-display text-lg font-medium text-rose-500">
                        {isLoading ? <Skeleton className="h-6 w-20" /> : formatBRL(report?.expenses || 0)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <CircleDollarSign className="size-3" /> Lucro
                      </p>
                      <p className={`truncate font-display text-lg font-medium ${report?.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isLoading ? <Skeleton className="h-6 w-20" /> : formatBRL(report?.profit || 0)}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
