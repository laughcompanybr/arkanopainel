import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  getOrder,
  updateOrder,
  changeOrderStatus,
  addPayment,
  deletePayment,
  addOrderAttachment,
  deleteOrderAttachment,
  signOrderAttachment,
} from "./orders.functions";
import {
  paymentSchema,
  ORDER_STATUS,
  STATUS_LABEL,
  STATUS_TONE,
  type OrderPayload,
  type PaymentInput,
  type PaymentPayload,
} from "./schemas";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Paperclip,
  Upload,
  Download,
  Trash2,
  Activity,
  Wallet,
  Truck,
  Pencil,
  Copy,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  Package,
  ExternalLink,
} from "lucide-react";
import { OrderForm } from "./OrderForm";
import { formatBRL, formatDate } from "@/lib/format";

interface Props {
  orderId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function formatBytes(n: number | null | undefined) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const EVENT_LABEL: Record<string, string> = {
  created: "Pedido criado",
  status_changed: "Status alterado",
  payment: "Pagamento",
  attachment: "Anexo",
};

export function OrderDetailSheet({ orderId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const getFn = useServerFn(getOrder);
  const updateFn = useServerFn(updateOrder);
  const statusFn = useServerFn(changeOrderStatus);
  const addPayFn = useServerFn(addPayment);
  const delPayFn = useServerFn(deletePayment);
  const addAttachFn = useServerFn(addOrderAttachment);
  const delAttachFn = useServerFn(deleteOrderAttachment);
  const signFn = useServerFn(signOrderAttachment);

  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const query = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getFn({ data: { id: orderId! } }),
    enabled: !!orderId && open,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["order", orderId] });
    qc.invalidateQueries({ queryKey: ["orders"] });
  };

  const updateMut = useMutation({
    mutationFn: (v: OrderPayload) => updateFn({ data: { id: orderId!, ...v } as never }),
    onSuccess: () => { toast.success("Pedido atualizado"); setEditing(false); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (status: (typeof ORDER_STATUS)[number]) => statusFn({ data: { id: orderId!, status } }),
    onSuccess: () => { toast.success("Status atualizado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPayMut = useMutation({
    mutationFn: (v: PaymentPayload) => addPayFn({ data: { order_id: orderId!, ...v } as never }),
    onSuccess: () => { toast.success("Pagamento registrado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delPayMut = useMutation({
    mutationFn: (id: string) => delPayFn({ data: { id } }),
    onSuccess: () => { toast.success("Pagamento removido"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delAttachMut = useMutation({
    mutationFn: (v: { id: string; storage_path: string }) => delAttachFn({ data: v }),
    onSuccess: () => { toast.success("Anexo removido"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleUpload = useCallback(async (file: File) => {
    if (!orderId) return;
    if (file.size > 15 * 1024 * 1024) return toast.error("Arquivo excede 15MB");
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${orderId}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("order-files").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      await addAttachFn({
        data: { order_id: orderId, storage_path: path, filename: file.name, mime: file.type || null, size: file.size, kind: null },
      });
      toast.success("Anexo enviado");
      invalidate();
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }, [orderId, addAttachFn]); // eslint-disable-line

  const handleDownload = async (storage_path: string, filename: string | null) => {
    try {
      const { url } = await signFn({ data: { storage_path } });
      const a = document.createElement("a");
      a.href = url; a.download = filename ?? "arquivo"; a.target = "_blank"; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { toast.error((e as Error).message); }
  };

  const order = query.data?.order;
  const client = order?.clients as { name?: string; whatsapp?: string | null; instagram?: string | null } | null;
  const supplier = order?.suppliers as { name?: string; company?: string | null; whatsapp?: string | null } | null;
  const totals = query.data?.totals;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <SheetTitle className="font-display text-2xl">
              {query.isLoading ? "Carregando..." : `Pedido #${order?.order_number ?? "—"}`}
            </SheetTitle>
            {order ? (
              <Badge className={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
            ) : null}
          </div>
          {order ? (
            <p className="text-sm text-muted-foreground">
              {[order.brand, order.model].filter(Boolean).join(" ") || "Sem descrição"} · {client?.name ?? "Sem cliente"}
            </p>
          ) : null}
        </SheetHeader>

        {query.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-gold" /></div>
        ) : order && totals ? (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatBox label="Venda" value={formatBRL(order.sale_price)} />
              <StatBox label="Custo" value={formatBRL(order.cost_price)} />
              <StatBox label="Lucro" value={formatBRL(totals.profit)} tone={totals.profit >= 0 ? "positive" : "negative"} />
              <StatBox label="Saldo a receber" value={formatBRL(totals.balance)} tone={totals.balance > 0 ? "warning" : "positive"} />
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-card/40 p-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
              <Select value={order.status} onValueChange={(v) => statusMut.mutate(v as (typeof ORDER_STATUS)[number])}>
                <SelectTrigger className="max-w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORDER_STATUS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
              {statusMut.isPending ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
            </div>

            <Tabs defaultValue="info" className="mt-6">
              <TabsList className="w-full">
                <TabsTrigger value="info" className="flex-1">Dados</TabsTrigger>
                <TabsTrigger value="payments" className="flex-1">
                  <Wallet className="mr-1 size-3.5" /> Pagamentos ({query.data?.payments.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="tracking" className="flex-1">
                  <Truck className="mr-1 size-3.5" /> Rastreio
                </TabsTrigger>
                <TabsTrigger value="attachments" className="flex-1">
                  <Paperclip className="mr-1 size-3.5" /> Anexos ({query.data?.attachments.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="timeline" className="flex-1">
                  <Activity className="mr-1 size-3.5" /> Timeline
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4">
                {editing ? (
                  <OrderForm
                    defaultValues={{
                      client_id: order.client_id ?? "",
                      supplier_id: order.supplier_id ?? "",
                      brand: order.brand ?? "",
                      model: order.model ?? "",
                      reference: order.reference ?? "",
                      sale_price: order.sale_price,
                      cost_price: order.cost_price,
                      amount_received: order.amount_received,
                      payment_method: order.payment_method ?? "",
                      purchase_date: order.purchase_date ?? "",
                      expected_delivery: order.expected_delivery ?? "",
                      tracking_code: order.tracking_code ?? "",
                      status: order.status,
                      notes: order.notes ?? "",
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
                      <Info label="Cliente" value={client?.name} />
                      <Info label="Fornecedor" value={supplier?.name} />
                      <Info label="Marca" value={order.brand} />
                      <Info label="Modelo" value={order.model} />
                      <Info label="Referência" value={order.reference} />
                      <Info label="Forma de pagamento" value={order.payment_method} />
                      <Info label="Data da compra" value={formatDate(order.purchase_date)} />
                      <Info label="Previsão de entrega" value={formatDate(order.expected_delivery)} />
                      <Info label="Criado em" value={formatDate(order.created_at)} />
                      <Info label="Atualizado em" value={formatDate(order.updated_at)} />
                    </dl>
                    {order.notes ? (
                      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Observações</p>
                        <p className="mt-1 whitespace-pre-wrap">{order.notes}</p>
                      </div>
                    ) : null}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="payments" className="mt-4">
                <PaymentForm onSubmit={async (v) => { await addPayMut.mutateAsync(v); }} />
                <div className="mt-4">
                  {query.data?.payments.length ? (
                    <ul className="divide-y divide-border rounded-lg border border-border">
                      {query.data.payments.map((p) => (
                        <li key={p.id} className="flex items-center gap-3 p-3 text-sm">
                          {p.direction === "in" ? (
                            <ArrowDownCircle className="size-5 text-emerald-500" />
                          ) : (
                            <ArrowUpCircle className="size-5 text-destructive" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{formatBRL(p.amount)}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.method ?? "—"} · {formatDate(p.paid_at)}
                            </p>
                            {p.notes ? <p className="mt-0.5 text-xs text-muted-foreground">{p.notes}</p> : null}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { if (confirm("Remover pagamento?")) delPayMut.mutate(p.id); }}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="tracking" className="mt-4 space-y-4">
                <div className="rounded-xl border border-border bg-card/40 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Código de rastreio</p>
                  {order.tracking_code ? (
                    <div className="mt-2 flex items-center gap-2">
                      <code className="rounded bg-muted px-2 py-1 font-mono text-sm">{order.tracking_code}</code>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(order.tracking_code!);
                          toast.success("Copiado");
                        }}
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={`https://rastreamento.correios.com.br/app/index.php?objeto=${encodeURIComponent(order.tracking_code)}`}
                          target="_blank"
                          rel="noopener"
                        >
                          <ExternalLink className="mr-1 size-3.5" /> Correios
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Nenhum código informado.</p>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <Info label="Data da compra" value={formatDate(order.purchase_date)} />
                  <Info label="Previsão de entrega" value={formatDate(order.expected_delivery)} />
                </dl>
              </TabsContent>

              <TabsContent value="attachments" className="mt-4 space-y-3">
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full">
                  {uploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
                  Enviar anexo
                </Button>
                {query.data?.attachments.length ? (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {query.data.attachments.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 p-3">
                        <Paperclip className="size-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{a.filename ?? "arquivo"}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(a.size)} · {formatDate(a.created_at)}</p>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => handleDownload(a.storage_path, a.filename)}>
                          <Download className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { if (confirm("Remover anexo?")) delAttachMut.mutate({ id: a.id, storage_path: a.storage_path }); }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nenhum anexo enviado.</p>
                )}
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                {query.data?.events.length ? (
                  <ol className="relative ml-3 border-l border-border">
                    {query.data.events.map((e) => (
                      <li key={e.id} className="mb-4 ml-4">
                        <span className="absolute -left-1.5 mt-1.5 flex size-3 items-center justify-center rounded-full bg-gold" />
                        <p className="text-sm font-medium">
                          {EVENT_LABEL[e.type] ?? e.type} <span className="text-muted-foreground">· {formatDate(e.created_at)}</span>
                        </p>
                        {e.message ? <p className="text-sm text-muted-foreground">{e.message}</p> : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Sem eventos registrados.</p>
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

function StatBox({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "positive" | "negative" | "warning" }) {
  const cls =
    tone === "positive" ? "text-emerald-500" :
    tone === "negative" ? "text-destructive" :
    tone === "warning" ? "text-amber-500" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-base ${cls}`}>{value}</p>
    </div>
  );
}

function PaymentForm({ onSubmit }: { onSubmit: (v: PaymentPayload) => Promise<void> }) {
  const form = useForm<PaymentInput, unknown, PaymentPayload>({
    resolver: zodResolver(paymentSchema) as never,
    defaultValues: {
      direction: "in",
      amount: 0,
      method: "",
      paid_at: new Date().toISOString().slice(0, 10),
      notes: "",
    },
  });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = form;
  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        await onSubmit(v);
        reset();
      })}
      className="rounded-xl border border-border bg-card/40 p-4"
    >
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Registrar pagamento</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <select
            {...register("direction")}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="in">Entrada</option>
            <option value="out">Saída</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Valor</Label>
          <Input type="number" step="0.01" min="0" {...register("amount")} />
          {errors.amount ? <p className="text-xs text-destructive">{errors.amount.message as string}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label>Data</Label>
          <Input type="date" {...register("paid_at")} />
        </div>
        <div className="space-y-1.5">
          <Label>Método</Label>
          <Input placeholder="PIX, cartão..." {...register("method")} />
        </div>
        <div className="space-y-1.5 sm:col-span-3">
          <Label>Observações</Label>
          <Input {...register("notes")} />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
            Registrar
          </Button>
        </div>
      </div>
    </form>
  );
}

// unused-suppress: keep icon import used only if attachments empty
void Package;
