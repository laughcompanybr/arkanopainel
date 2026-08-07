import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  updateClient,
} from "./clients.functions";
import { getClientCRM, addInteraction } from "./crm.functions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  History,
  Package,
  Pencil,
  Calendar,
} from "lucide-react";
import { ClientForm } from "./ClientForm";
import { formatBRL, formatDate } from "@/lib/format";
import type { ClientPayload } from "./schemas";
import { STATUS_LABEL, STATUS_TONE, type OrderStatus } from "@/features/orders/schemas";

interface Props {
  clientId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ClientDetailSheet({ clientId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const getFn = useServerFn(getClientCRM);
  const addInteractionFn = useServerFn(addInteraction);
  const updateFn = useServerFn(updateClient);

  const [editing, setEditing] = useState(false);

  const query = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getFn({ data: { id: clientId! } }),
    enabled: !!clientId && open,
  });

  const updateMut = useMutation({
    mutationFn: (v: ClientPayload) => updateFn({ data: { id: clientId!, ...v } as any }),
    onSuccess: () => {
      toast.success("Cliente atualizado");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const client = query.data?.client;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">
            {query.isLoading ? "Carregando..." : client?.name ?? "Cliente"}
          </SheetTitle>
        </SheetHeader>

        {query.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-gold" />
          </div>
        ) : client ? (
          <Tabs defaultValue="info" className="mt-6">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">Dados</TabsTrigger>
              <TabsTrigger value="commercial" className="flex-1">Comercial</TabsTrigger>
              <TabsTrigger value="tasks" className="flex-1">
                <Calendar className="mr-1 size-3.5" /> Tarefas ({query.data?.tasks?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1">
                <History className="mr-1 size-3.5" /> Timeline
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-4">
              {editing ? (
                <ClientForm
                  defaultValues={{
                    name: client.name,
                    company_name: (client as any).company_name ?? "",
                    status: (client as any).status ?? "lead",
                    email: (client as any).email ?? "",
                    cpf: client.cpf ?? "",
                    phone: client.phone ?? "",
                    whatsapp: client.whatsapp ?? "",
                    instagram: client.instagram ?? "",
                    zip: client.zip ?? "",
                    street: client.street ?? "",
                    number: client.number ?? "",
                    complement: client.complement ?? "",
                    district: client.district ?? "",
                    reference: client.reference ?? "",
                    city: client.city ?? "",
                    state: client.state ?? "",
                    notes: client.notes ?? "",
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
                    <div className="col-span-2">
                      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</dt>
                      <dd className="mt-1">
                        <Badge variant={(client as any).status === 'active' ? 'default' : 'outline'}>
                          {(client as any).status?.toUpperCase() || 'LEAD'}
                        </Badge>
                      </dd>
                    </div>
                    <Info label="Empresa" value={(client as any).company_name} />
                    <Info label="E-mail" value={(client as any).email} />
                    <Info label="CPF" value={client.cpf} />
                    <Info label="Telefone" value={client.phone} />
                    <Info label="WhatsApp" value={client.whatsapp} />
                    <Info label="Instagram" value={client.instagram ? `@${client.instagram}` : null} />
                    <Info label="CEP" value={client.zip} />
                    <Info label="Cidade" value={client.city} />
                    <Info label="UF" value={client.state} />
                    <Info label="Criado em" value={formatDate(client.created_at)} />
                  </dl>
                </div>
              )}
            </TabsContent>

            <TabsContent value="commercial" className="mt-4 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-card/40 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Valor Comprado</p>
                  <p className="mt-1 font-display text-2xl">{formatBRL(query.data?.commercial?.totalSpent ?? 0)}</p>
                </div>
                <div className="rounded-xl border border-border bg-card/40 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pedidos Realizados</p>
                  <p className="mt-1 font-display text-2xl">{query.data?.orders?.length ?? 0}</p>
                </div>
              </div>

              {query.data?.orders?.length ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Histórico de Pedidos</h4>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Pedido</th>
                          <th className="px-3 py-2 text-left font-medium">Data</th>
                          <th className="px-3 py-2 text-right font-medium">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {query.data.orders.map((o: any) => (
                          <tr key={o.id} className="hover:bg-accent/50 transition-colors">
                            <td className="px-3 py-2 font-mono">#{o.order_number}</td>
                            <td className="px-3 py-2 text-muted-foreground">{formatDate(o.created_at)}</td>
                            <td className="px-3 py-2 text-right font-medium">{formatBRL(o.sale_price * (o.quantity || 1))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pedido realizado.</p>
              )}
            </TabsContent>

            <TabsContent value="tasks" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Tarefas Relacionadas</h4>
                <Button size="sm" variant="outline" asChild>
                  <a href="/agenda">Ir para Agenda</a>
                </Button>
              </div>
              {query.data?.tasks?.length ? (
                <div className="space-y-2">
                  {query.data.tasks.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                      <div>
                        <p className="font-medium">{t.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(t.due_date)} {t.due_time || ""}</p>
                      </div>
                      <Badge variant={t.status === 'completed' ? 'default' : 'outline'}>{t.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma tarefa agendada.</p>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Adicionar nota rápida..." 
                    className="flex-1"
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        const val = e.currentTarget.value;
                        if (!val) return;
                        try {
                          await addInteractionFn({ data: { client_id: clientId!, type: 'note', message: val } });
                          e.currentTarget.value = "";
                          qc.invalidateQueries({ queryKey: ["client", clientId] });
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }
                    }}
                  />
                </div>
                {query.data?.interactions?.length ? (
                  <div className="relative space-y-4 before:absolute before:left-[11px] before:top-2 before:h-[calc(100%-16px)] before:w-0.5 before:bg-border">
                    {query.data.interactions.map((i: any) => (
                      <div key={i.id} className="relative pl-8">
                        <div className="absolute left-0 top-1.5 size-[24px] rounded-full border border-border bg-background flex items-center justify-center">
                          <div className="size-2 rounded-full bg-primary" />
                        </div>
                        <div className="rounded-lg border border-border bg-card/40 p-3 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-xs uppercase tracking-wider text-muted-foreground">
                              {i.type === 'status_change' ? 'Status' : i.type === 'note' ? 'Nota' : 'Evento'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{formatDate(i.created_at)}</span>
                          </div>
                          <p>{i.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Sem histórico de atividades.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
