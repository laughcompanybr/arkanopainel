import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { employeeSchema, EMPLOYEE_STATUS, type EmployeeInput, type EmployeePayload } from "./schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface Props {
  defaultValues?: Partial<EmployeeInput>;
  submitLabel?: string;
  onSubmit: (values: EmployeePayload) => Promise<void> | void;
  onCancel?: () => void;
}

const selectCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function EmployeeForm({ defaultValues, submitLabel = "Salvar", onSubmit, onCancel }: Props) {
  const form = useForm<EmployeeInput, unknown, EmployeePayload>({
    resolver: zodResolver(employeeSchema) as never,
    defaultValues: {
      full_name: "",
      role: "",
      email: "",
      phone: "",
      whatsapp: "",
      hire_date: "",
      base_salary: "",
      commission_percent: "",
      status: "active",
      notes: "",
      ...defaultValues,
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const err = (name: keyof EmployeeInput) =>
    errors[name] ? <p className="text-xs text-destructive">{errors[name]?.message as string}</p> : null;

  return (
    <form onSubmit={handleSubmit(async (v) => { await onSubmit(v); })} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="full_name">Nome completo *</Label>
          <Input id="full_name" {...register("full_name")} />
          {err("full_name")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role">Cargo</Label>
          <Input id="role" placeholder="Vendedor, Gerente..." {...register("role")} />
          {err("role")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <select id="status" {...register("status")} className={selectCls}>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" {...register("email")} />
          {err("email")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" placeholder="(11) 99999-9999" inputMode="tel" {...register("phone")} />
          {err("phone")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input id="whatsapp" placeholder="(11) 99999-9999" inputMode="tel" {...register("whatsapp")} />
          {err("whatsapp")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hire_date">Data de contratação</Label>
          <Input id="hire_date" type="date" {...register("hire_date")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="base_salary">Salário base (R$)</Label>
          <Input id="base_salary" type="number" step="0.01" min="0" {...register("base_salary")} />
          {err("base_salary")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="commission_percent">Comissão padrão (%)</Label>
          <Input
            id="commission_percent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            {...register("commission_percent")}
          />
          {err("commission_percent")}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Observações</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
        {err("notes")}
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

export const EMPLOYEE_STATUS_LABEL: Record<(typeof EMPLOYEE_STATUS)[number], string> = {
  active: "Ativo",
  inactive: "Inativo",
};
