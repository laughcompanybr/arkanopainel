import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { orderSchema, ORDER_STATUS, STATUS_LABEL, type OrderInput, type OrderPayload } from "./schemas";
import { listClientOptions, listSupplierOptions } from "./orders.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, TrendingUp } from "lucide-react";
import { formatBRL } from "@/lib/format";

interface Props {
  defaultValues?: Partial<OrderInput>;
  submitLabel?: string;
  onSubmit: (values: OrderPayload) => Promise<void> | void;
  onCancel?: () => void;
}

export function OrderForm({ defaultValues, submitLabel = "Salvar", onSubmit, onCancel }: Props) {
  const clientsFn = useServerFn(listClientOptions);
  const suppliersFn = useServerFn(listSupplierOptions);
  const clientsQ = useQuery({ queryKey: ["client-options"], queryFn: () => clientsFn(), staleTime: 60_000 });
  const suppliersQ = useQuery({ queryKey: ["supplier-options"], queryFn: () => suppliersFn(), staleTime: 60_000 });

  const form = useForm<OrderInput, unknown, OrderPayload>({
    resolver: zodResolver(orderSchema) as never,
    defaultValues: {
      client_id: "",
      supplier_id: "",
      brand: "",
      model: "",
      reference: "",
      sale_price: 0,
      cost_price: 0,
      amount_received: 0,
      payment_method: "",
      purchase_date: "",
      expected_delivery: "",
      tracking_code: "",
      status: "new",
      notes: "",
      ...defaultValues,
    },
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = form;

  const sale = Number(useWatch({ control, name: "sale_price" }) ?? 0);
  const cost = Number(useWatch({ control, name: "cost_price" }) ?? 0);
  const received = Number(useWatch({ control, name: "amount_received" }) ?? 0);
  const profit = sale - cost;
  const balance = sale - received;
  const margin = sale > 0 ? (profit / sale) * 100 : 0;

  const err = (name: keyof OrderInput) =>
    errors[name] ? <p className="text-xs text-destructive">{errors[name]?.message as string}</p> : null;

  const selectCls =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <form onSubmit={handleSubmit(async (v) => { await onSubmit(v); })} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="client_id">Cliente</Label>
          <select id="client_id" {...register("client_id")} className={selectCls}>
            <option value="">—</option>
            {(clientsQ.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {err("client_id")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="supplier_id">Fornecedor</Label>
          <select id="supplier_id" {...register("supplier_id")} className={selectCls}>
            <option value="">—</option>
            {(suppliersQ.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {err("supplier_id")}
        </div>
        <div className="space-y-1.5"><Label htmlFor="brand">Marca</Label><Input id="brand" {...register("brand")} />{err("brand")}</div>
        <div className="space-y-1.5"><Label htmlFor="model">Modelo</Label><Input id="model" {...register("model")} />{err("model")}</div>
        <div className="space-y-1.5"><Label htmlFor="reference">Referência</Label><Input id="reference" {...register("reference")} />{err("reference")}</div>
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <select id="status" {...register("status")} className={selectCls}>
            {ORDER_STATUS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Financeiro</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="sale_price">Preço de venda</Label>
            <Input id="sale_price" type="number" step="0.01" min="0" {...register("sale_price")} />
            {err("sale_price")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cost_price">Custo</Label>
            <Input id="cost_price" type="number" step="0.01" min="0" {...register("cost_price")} />
            {err("cost_price")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amount_received">Valor recebido</Label>
            <Input id="amount_received" type="number" step="0.01" min="0" {...register("amount_received")} />
            {err("amount_received")}
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="payment_method">Forma de pagamento</Label>
            <Input id="payment_method" placeholder="PIX, cartão, boleto..." {...register("payment_method")} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg border border-border/60 bg-background/60 p-3 text-xs">
          <div>
            <p className="uppercase tracking-wider text-muted-foreground">Lucro</p>
            <p className={`mt-1 flex items-center gap-1 font-display text-base ${profit >= 0 ? "text-emerald-500" : "text-destructive"}`}>
              <TrendingUp className="size-3.5" /> {formatBRL(profit)}
            </p>
          </div>
          <div>
            <p className="uppercase tracking-wider text-muted-foreground">Margem</p>
            <p className="mt-1 font-display text-base">{margin.toFixed(1)}%</p>
          </div>
          <div>
            <p className="uppercase tracking-wider text-muted-foreground">Saldo a receber</p>
            <p className={`mt-1 font-display text-base ${balance > 0 ? "text-amber-500" : "text-emerald-500"}`}>{formatBRL(balance)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="purchase_date">Data da compra</Label>
          <Input id="purchase_date" type="date" {...register("purchase_date")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expected_delivery">Previsão de entrega</Label>
          <Input id="expected_delivery" type="date" {...register("expected_delivery")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tracking_code">Código de rastreio</Label>
          <Input id="tracking_code" placeholder="LB123456789BR" {...register("tracking_code")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Observações</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
