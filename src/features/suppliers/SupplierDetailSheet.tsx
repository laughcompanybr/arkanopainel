import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getSupplier, updateSupplier } from "./suppliers.functions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, History, Package, Pencil, TrendingUp } from "lucide-react";
import { SupplierForm } from "./SupplierForm";
import { formatBRL, formatDate, formatNumber } from "@/lib/format";
import type { SupplierPayload } from "./schemas";

interface Props {
  supplierId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const operationLabel: Record<string, string> = {
  INSERT: "Criado",
  UPDATE: "Atualizado",
  DELETE: "Removido",
};

const IGNORE = new Set(["updated_at", "created_at", "id", "created_by", "deleted_at"]);
function diffFields(oldD: Record<string, unknown>, newD: Record<string, unknown>) {
  const out: Array<{ field: string; old: unknown; new: unknown }> = [];
  const keys = new Set([...Object.keys(oldD), ...Object.keys(newD)]);
  for (const k of keys) {
    if (IGNORE.has(k)) continue;
    if (JSON.stringify(oldD[k]) !== JSON.stringify(newD[k])) {
      out.push({ field: k, old: oldD[k], new: newD[k] });
    }
  }
  return out;
}

export function SupplierDetailSheet({ supplierId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const getFn = useServerFn(getSupplier);
  const updateFn = useServerFn(updateSupplier);
  const [editing, setEditing] = useState(false);

  const query = useQuery({
    queryKey: ["supplier", supplierId],
    queryFn: () => getFn({ data: { id: supplierId! } }),
    enabled: !!supplierId && open,
  });

  const updateMut = useMutation({
    mutationFn: (v: SupplierPayload) => updateFn({ data: { id: supplierId!, ...v } as never }),
    onSuccess: () => {
      toast.success("Fornecedor atualizado");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["supplier", supplierId] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const supplier = query.data?.supplier;
  const totals = query.data?.totals;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">
            {query.isLoading ? "Carregando..." : supplier?.name ?? "Fornecedor"}
          </SheetTitle>
          {supplier?.company ? <p className="text-sm text-muted-foreground">{supplier.company}</p> : null}
        </SheetHeader>

        {query.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-gold" /></div>
        ) : supplier ? (
          <>
            {totals && totals.count > 0 ? (
              <div className="mt-6 grid grid-cols-3 gap-3">
                <StatBox label="Pedidos" value={formatNumber(totals.count)} />
                <StatBox label="Receita gerada" value={formatBRL(totals.revenue)} />
                <StatBox label="Custo total" value={formatBRL(totals.cost)} />
              </div>
            ) : null}

            <Tabs defaultValue="info" className="mt-6">
              <TabsList className="w-full">
                <TabsTrigger value="info" className="flex-1">Dados</TabsTrigger>
                <TabsTrigger value="orders" className="flex-1">
                  <Package className="mr-1 size-3.5" /> Pedidos ({query.data?.orders.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1">
                  <History className="mr-1 size-3.5" /> Histórico
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4">
                {editing ? (
                  <SupplierForm
                    defaultValues={{
                      name: supplier.name,
                      company: supplier.company ?? "",
                      email: supplier.email ?? "",
                      phone: supplier.phone ?? "",
                      whatsapp: supplier.whatsapp ?? "",
                      instagram: supplier.instagram ?? "",
                      avg_delivery_days: supplier.avg_delivery_days ?? "",
                      notes: supplier.notes ?? "",
                    }}
                    submitLabel="Salvar alterações"
                    onSubmit={async (v) => { await updateMut.mutateAsync(v); }}
                    onCancel={() => setEditing(false)}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                        <Pencil className="mr-2 size-3.5" /> Editar
                      </Button>
                    </div>
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      <Info label="Empresa" value={supplier.company} />
                      <Info label="E-mail" value={supplier.email} />
                      <Info label="Telefone" value={supplier.phone} />
                      <Info label="WhatsApp" value={supplier.whatsapp} />
                      <Info label="Instagram" value={supplier.instagram ? `@${supplier.instagram}` : null} />
                      <Info label="Prazo médio" value={supplier.avg_delivery_days ? `${supplier.avg_delivery_days} dias` : null} />
                      <Info label="Criado em" value={formatDate(supplier.created_at)} />
                      <Info label="Atualizado em" value={formatDate(supplier.updated_at)} />
                    </dl>
                    {supplier.notes ? (
                      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Observações</p>
                        <p className="mt-1 whitespace-pre-wrap">{supplier.notes}</p>
                      </div>
                    ) : null}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="orders" className="mt-4">
                {query.data?.orders.length ? (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {query.data.orders.map((o) => {
                      const clientName = (o.clients as { name?: string } | null)?.name;
                      return (
                        <li key={o.id} className="flex items-center justify-between p-3 text-sm">
                          <div>
                            <p className="font-medium">Pedido #{o.order_number ?? "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {clientName ?? "Sem cliente"} · {formatDate(o.created_at)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatBRL(o.sale_price)}</p>
                            <Badge variant="outline" className="text-[10px]">{o.status}</Badge>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pedido vinculado.</p>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                {query.data?.history.length ? (
                  <ol className="space-y-2">
                    {query.data.history.map((h) => (
                      <li key={h.id} className="flex gap-3 rounded-lg border border-border bg-card/40 p-3 text-sm">
                        <Badge variant="outline" className="h-fit">{operationLabel[h.operation] ?? h.operation}</Badge>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">{formatDate(h.changed_at)}</p>
                          {h.operation === "UPDATE" && h.old_data && h.new_data ? (
                            <ul className="mt-1 space-y-0.5 text-xs">
                              {diffFields(h.old_data as Record<string, unknown>, h.new_data as Record<string, unknown>).map((d) => (
                                <li key={d.field}>
                                  <span className="font-medium">{d.field}:</span>{" "}
                                  <span className="text-muted-foreground line-through">{String(d.old ?? "—")}</span>{" "}
                                  → <span className="text-gold">{String(d.new ?? "—")}</span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Sem histórico.</p>
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value || "—"}</dd>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <TrendingUp className="size-3" /> {label}
      </div>
      <p className="font-display text-lg">{value}</p>
    </div>
  );
}
