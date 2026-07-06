import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supplierSchema, type SupplierInput, type SupplierPayload } from "./schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface Props {
  defaultValues?: Partial<SupplierInput>;
  submitLabel?: string;
  onSubmit: (values: SupplierPayload) => Promise<void> | void;
  onCancel?: () => void;
}

export function SupplierForm({ defaultValues, submitLabel = "Salvar", onSubmit, onCancel }: Props) {
  const form = useForm<SupplierInput, unknown, SupplierPayload>({
    resolver: zodResolver(supplierSchema) as never,
    defaultValues: {
      name: "",
      company: "",
      email: "",
      phone: "",
      whatsapp: "",
      instagram: "",
      avg_delivery_days: "",
      notes: "",
      ...defaultValues,
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const field = (name: keyof SupplierInput, label: string, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} {...register(name)} {...extra} />
      {errors[name] ? <p className="text-xs text-destructive">{errors[name]?.message as string}</p> : null}
    </div>
  );

  return (
    <form
      onSubmit={handleSubmit(async (v) => { await onSubmit(v); })}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", "Nome do contato *")}
        {field("company", "Empresa")}
        {field("email", "E-mail", { type: "email", placeholder: "contato@empresa.com" })}
        {field("phone", "Telefone", { placeholder: "(11) 99999-9999", inputMode: "tel" })}
        {field("whatsapp", "WhatsApp", { placeholder: "(11) 99999-9999", inputMode: "tel" })}
        {field("instagram", "Instagram", { placeholder: "@fornecedor" })}
        {field("avg_delivery_days", "Prazo médio (dias)", { type: "number", min: 0, max: 365, inputMode: "numeric" })}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Observações</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
        {errors.notes ? <p className="text-xs text-destructive">{errors.notes.message}</p> : null}
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
