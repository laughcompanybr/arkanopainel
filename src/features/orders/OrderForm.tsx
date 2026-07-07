import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { orderSchema, ORDER_STATUS, STATUS_LABEL, PAYMENT_METHODS, type OrderInput, type OrderPayload } from "./schemas";
import { listClientOptions, listSupplierOptions } from "./orders.functions";
import { listEmployeeOptions } from "@/features/employees/employees.functions";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, TrendingUp, MapPin, Upload, ImageIcon } from "lucide-react";
import { formatBRL } from "@/lib/format";

interface Props {
  defaultValues?: Partial<OrderInput>;
  submitLabel?: string;
  onSubmit: (values: OrderPayload) => Promise<void> | void;
  onCancel?: () => void;
}

const UF = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

interface ViaCep {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

export function OrderForm({ defaultValues, submitLabel = "Salvar", onSubmit, onCancel }: Props) {
  const clientsFn = useServerFn(listClientOptions);
  const suppliersFn = useServerFn(listSupplierOptions);
  const employeesFn = useServerFn(listEmployeeOptions);
  const clientsQ = useQuery({ queryKey: ["client-options"], queryFn: () => clientsFn(), staleTime: 60_000 });
  const suppliersQ = useQuery({ queryKey: ["supplier-options"], queryFn: () => suppliersFn(), staleTime: 60_000 });
  const employeesQ = useQuery({ queryKey: ["employee-options"], queryFn: () => employeesFn(), staleTime: 60_000 });


  const form = useForm<OrderInput, unknown, OrderPayload>({
    resolver: zodResolver(orderSchema) as never,
    defaultValues: {
      client_id: "",
      supplier_id: "",
      employee_id: "",
      brand: "",

      model: "",
      reference: "",
      photo_path: "",
      quantity: 1,
      sale_price: 0,
      cost_price: 0,
      commission: 0,
      card_fee: 0,
      shipping: 0,
      other_costs: 0,
      amount_received: 0,
      payment_method: "",
      purchase_date: "",
      expected_delivery: "",
      tracking_code: "",
      status: "new",
      ship_zip: "",
      ship_street: "",
      ship_number: "",
      ship_complement: "",
      ship_district: "",
      ship_city: "",
      ship_state: "",
      ship_reference: "",
      notes: "",
      ...defaultValues,
    },
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = form;

  const qty = Number(useWatch({ control, name: "quantity" }) ?? 1) || 1;
  const sale = Number(useWatch({ control, name: "sale_price" }) ?? 0);
  const cost = Number(useWatch({ control, name: "cost_price" }) ?? 0);
  const commission = Number(useWatch({ control, name: "commission" }) ?? 0);
  const cardFee = Number(useWatch({ control, name: "card_fee" }) ?? 0);
  const shipping = Number(useWatch({ control, name: "shipping" }) ?? 0);
  const otherCosts = Number(useWatch({ control, name: "other_costs" }) ?? 0);
  const received = Number(useWatch({ control, name: "amount_received" }) ?? 0);
  const photoPath = String(useWatch({ control, name: "photo_path" }) ?? "");

  const totalSale = sale * qty;
  const totalCost = cost * qty;
  const grossProfit = totalSale - totalCost;
  const netProfit = grossProfit - commission - cardFee - shipping - otherCosts;
  const pending = totalSale - received;
  const margin = totalSale > 0 ? (netProfit / totalSale) * 100 : 0;

  const [cepLoading, setCepLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function lookupShipCep() {
    const raw = String(getValues("ship_zip") ?? "").replace(/\D/g, "");
    if (raw.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      if (!res.ok) return;
      const d = (await res.json()) as ViaCep;
      if (d.erro) return;
      if (d.logradouro) setValue("ship_street", d.logradouro);
      if (d.bairro) setValue("ship_district", d.bairro);
      if (d.localidade) setValue("ship_city", d.localidade);
      if (d.uf) setValue("ship_state", d.uf);
    } catch {
      // silencioso
    } finally {
      setCepLoading(false);
    }
  }

  async function handlePhotoUpload(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Foto excede 8MB");
      return;
    }
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `watches/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from("order-files").upload(path, file, { contentType: file.type });
      if (error) throw error;
      setValue("photo_path", path, { shouldDirty: true });
      toast.success("Foto anexada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

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
          <Label htmlFor="quantity">Quantidade</Label>
          <Input id="quantity" type="number" min="1" step="1" {...register("quantity")} />
          {err("quantity")}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="status">Status do pedido</Label>
          <select id="status" {...register("status")} className={selectCls}>
            {ORDER_STATUS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <ImageIcon className="size-3.5" /> Foto do relógio
        </p>
        <div className="flex items-center gap-4">
          <div className="size-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40">
            {photoPath ? (
              <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
                <ImageIcon className="size-6" />
              </div>
            ) : (
              <div className="grid h-full w-full place-items-center text-muted-foreground">
                <ImageIcon className="size-6" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }}
            />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
              {photoPath ? "Trocar foto" : "Enviar foto"}
            </Button>
            {photoPath ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">{photoPath}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">JPG, PNG ou WEBP, até 8MB.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Financeiro</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="sale_price">Preço de venda (unit.)</Label>
            <Input id="sale_price" type="number" step="0.01" min="0" {...register("sale_price")} />
            {err("sale_price")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cost_price">Custo (unit.)</Label>
            <Input id="cost_price" type="number" step="0.01" min="0" {...register("cost_price")} />
            {err("cost_price")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amount_received">Entrada / valor já recebido</Label>
            <Input id="amount_received" type="number" step="0.01" min="0" {...register("amount_received")} />
            <p className="text-[11px] text-muted-foreground">
              Quanto o cliente já pagou no momento do pedido (ex.: sinal/entrada). Deixe 0 se ainda não pagou nada.
            </p>
            {err("amount_received")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="commission">Comissão</Label>
            <Input id="commission" type="number" step="0.01" min="0" {...register("commission")} />
          </div>
          {commission > 0 ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="employee_id">Funcionário que recebe a comissão</Label>
              <select id="employee_id" {...register("employee_id")} className={selectCls}>
                <option value="">— não atribuir —</option>
                {(employeesQ.data ?? []).map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name}{emp.role ? ` · ${emp.role}` : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Opcional. Vincule a comissão a um funcionário para acompanhar performance.
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="card_fee">Taxa do cartão</Label>
            <Input id="card_fee" type="number" step="0.01" min="0" {...register("card_fee")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shipping">Frete</Label>
            <Input id="shipping" type="number" step="0.01" min="0" {...register("shipping")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="other_costs">Outras despesas</Label>
            <Input id="other_costs" type="number" step="0.01" min="0" {...register("other_costs")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="payment_method">Forma de pagamento (principal)</Label>
            <select id="payment_method" {...register("payment_method")} className={selectCls}>
              <option value="">—</option>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Método usado para a entrada acima. Após salvar o pedido, você pode registrar
              pagamentos adicionais (mistos: PIX + cartão, parcelas, etc.) abrindo o pedido
              e acessando a aba <strong>Pagamentos</strong>.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-background/60 p-3 text-xs sm:grid-cols-5">
          <div>
            <p className="uppercase tracking-wider text-muted-foreground">Total venda</p>
            <p className="mt-1 font-display text-base">{formatBRL(totalSale)}</p>
          </div>
          <div>
            <p className="uppercase tracking-wider text-muted-foreground">Lucro bruto</p>
            <p className={`mt-1 flex items-center gap-1 font-display text-base ${grossProfit >= 0 ? "text-emerald-500" : "text-destructive"}`}>
              <TrendingUp className="size-3.5" /> {formatBRL(grossProfit)}
            </p>
          </div>
          <div>
            <p className="uppercase tracking-wider text-muted-foreground">Lucro líquido</p>
            <p className={`mt-1 font-display text-base ${netProfit >= 0 ? "text-emerald-500" : "text-destructive"}`}>{formatBRL(netProfit)}</p>
          </div>
          <div>
            <p className="uppercase tracking-wider text-muted-foreground">Margem</p>
            <p className="mt-1 font-display text-base">{margin.toFixed(1)}%</p>
          </div>
          <div>
            <p className="uppercase tracking-wider text-muted-foreground">Pendente</p>
            <p className={`mt-1 font-display text-base ${pending > 0 ? "text-amber-500" : "text-emerald-500"}`}>{formatBRL(pending)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <MapPin className="size-3.5" /> Endereço de entrega
        </p>
        <div className="grid gap-4 sm:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ship_zip">CEP</Label>
            <div className="flex gap-2">
              <Input id="ship_zip" placeholder="00000-000" inputMode="numeric" {...register("ship_zip")} onBlur={lookupShipCep} />
              <Button type="button" variant="outline" size="icon" onClick={lookupShipCep} disabled={cepLoading} title="Buscar CEP">
                {cepLoading ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="ship_street">Rua</Label>
            <Input id="ship_street" {...register("ship_street")} />
          </div>
          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="ship_number">Número</Label>
            <Input id="ship_number" {...register("ship_number")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ship_complement">Complemento</Label>
            <Input id="ship_complement" {...register("ship_complement")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ship_district">Bairro</Label>
            <Input id="ship_district" {...register("ship_district")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ship_city">Cidade</Label>
            <Input id="ship_city" {...register("ship_city")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ship_state">UF</Label>
            <select id="ship_state" {...register("ship_state")} className={selectCls}>
              <option value="">—</option>
              {UF.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-6">
            <Label htmlFor="ship_reference">Referência</Label>
            <Input id="ship_reference" {...register("ship_reference")} />
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
