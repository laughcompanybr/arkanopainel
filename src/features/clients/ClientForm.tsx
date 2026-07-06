import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientSchema, type ClientInput, type ClientPayload } from "./schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface Props {
  defaultValues?: Partial<ClientInput>;
  submitLabel?: string;
  onSubmit: (values: ClientPayload) => Promise<void> | void;
  onCancel?: () => void;
}

const UF = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export function ClientForm({ defaultValues, submitLabel = "Salvar", onSubmit, onCancel }: Props) {
  const form = useForm<ClientInput, unknown, ClientPayload>({
    resolver: zodResolver(clientSchema) as never,
    defaultValues: {
      name: "",
      cpf: "",
      phone: "",
      whatsapp: "",
      instagram: "",
      city: "",
      state: "",
      notes: "",
      ...defaultValues,
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const field = (name: keyof ClientInput, label: string, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} {...register(name)} {...extra} />
      {errors[name] ? <p className="text-xs text-destructive">{errors[name]?.message as string}</p> : null}
    </div>
  );

  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        await onSubmit(v);
      })}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", "Nome completo *")}
        {field("cpf", "CPF", { placeholder: "000.000.000-00", inputMode: "numeric" })}
        {field("phone", "Telefone", { placeholder: "(11) 99999-9999", inputMode: "tel" })}
        {field("whatsapp", "WhatsApp", { placeholder: "(11) 99999-9999", inputMode: "tel" })}
        {field("instagram", "Instagram", { placeholder: "@usuario" })}
        {field("city", "Cidade")}
        <div className="space-y-1.5">
          <Label htmlFor="state">UF</Label>
          <select
            id="state"
            {...register("state")}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">—</option>
            {UF.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          {errors.state ? <p className="text-xs text-destructive">{errors.state.message}</p> : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Observações</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
        {errors.notes ? <p className="text-xs text-destructive">{errors.notes.message}</p> : null}
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
