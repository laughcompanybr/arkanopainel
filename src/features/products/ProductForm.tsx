import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { productSchema, PRODUCT_STATUS, type ProductInput, type ProductPayload } from "./schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  defaultValues?: Partial<ProductInput>;
  submitLabel?: string;
  onSubmit: (values: ProductPayload) => Promise<void> | void;
  onCancel?: () => void;
}

const STATUS_LABEL: Record<(typeof PRODUCT_STATUS)[number], string> = {
  active: "Ativo",
  inactive: "Inativo",
  archived: "Arquivado",
};

const selectCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function ProductForm({ defaultValues, submitLabel = "Salvar", onSubmit, onCancel }: Props) {
  const form = useForm<ProductInput, unknown, ProductPayload>({
    resolver: zodResolver(productSchema) as never,
    defaultValues: {
      name: "",
      sku: "",
      category: "",
      description: "",
      cost_price: 0,
      sale_price: 0,
      stock_qty: 0,
      min_stock: 0,
      status: "active",
      
      notes: "",
      ...defaultValues,
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;


  const err = (name: keyof ProductInput) =>
    errors[name] ? <p className="text-xs text-destructive">{errors[name]?.message as string}</p> : null;

  return (
    <form onSubmit={handleSubmit(async (v) => { await onSubmit(v); })} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">Nome *</Label>
          <Input id="name" {...register("name")} />
          {err("name")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" {...register("sku")} placeholder="Ex: REL-001" />
          {err("sku")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category">Categoria</Label>
          <Input id="category" {...register("category")} placeholder="Ex: Relógios" />
          {err("category")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cost_price">Custo (R$)</Label>
          <Input id="cost_price" type="number" step="0.01" min="0" {...register("cost_price")} />
          {err("cost_price")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sale_price">Preço de venda (R$)</Label>
          <Input id="sale_price" type="number" step="0.01" min="0" {...register("sale_price")} />
          {err("sale_price")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stock_qty">Estoque atual</Label>
          <Input id="stock_qty" type="number" step="1" min="0" {...register("stock_qty")} />
          {err("stock_qty")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="min_stock">Estoque mínimo</Label>
          <Input id="min_stock" type="number" step="1" min="0" {...register("min_stock")} />
          {err("min_stock")}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="status">Status</Label>
          <select id="status" {...register("status")} className={selectCls}>
            {PRODUCT_STATUS.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
      </div>


      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" rows={3} {...register("description")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Observações internas</Label>
        <Textarea id="notes" rows={2} {...register("notes")} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
