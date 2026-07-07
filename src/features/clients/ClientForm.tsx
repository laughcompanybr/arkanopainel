import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientSchema, type ClientInput, type ClientPayload } from "./schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MapPin } from "lucide-react";

interface Props {
  defaultValues?: Partial<ClientInput>;
  submitLabel?: string;
  onSubmit: (values: ClientPayload) => Promise<void> | void;
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

export function ClientForm({ defaultValues, submitLabel = "Salvar", onSubmit, onCancel }: Props) {
  const form = useForm<ClientInput, unknown, ClientPayload>({
    resolver: zodResolver(clientSchema) as never,
    defaultValues: {
      name: "",
      cpf: "",
      phone: "",
      whatsapp: "",
      instagram: "",
      zip: "",
      street: "",
      number: "",
      complement: "",
      district: "",
      reference: "",
      city: "",
      state: "",
      notes: "",
      ...defaultValues,
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = form;

  const [cepLoading, setCepLoading] = useState(false);

  async function lookupCep() {
    const raw = String(getValues("zip") ?? "").replace(/\D/g, "");
    if (raw.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      if (!res.ok) return;
      const d = (await res.json()) as ViaCep;
      if (d.erro) return;
      if (d.logradouro) setValue("street", d.logradouro, { shouldValidate: false });
      if (d.bairro) setValue("district", d.bairro, { shouldValidate: false });
      if (d.localidade) setValue("city", d.localidade, { shouldValidate: false });
      if (d.uf) setValue("state", d.uf, { shouldValidate: false });
    } catch {
      // silencioso
    } finally {
      setCepLoading(false);
    }
  }

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
        {field("name", "Nome completo")}
        {field("cpf", "CPF", { placeholder: "000.000.000-00", inputMode: "numeric" })}
        {field("phone", "Telefone", { placeholder: "(11) 99999-9999", inputMode: "tel" })}
        {field("whatsapp", "WhatsApp", { placeholder: "(11) 99999-9999", inputMode: "tel" })}
        <div className="space-y-1.5">
          <Label htmlFor="instagram">Instagram</Label>
          <Input id="instagram" placeholder="@usuario" {...register("instagram")} />
          {errors.instagram ? <p className="text-xs text-destructive">{errors.instagram.message}</p> : null}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <MapPin className="size-3.5" /> Endereço
        </p>
        <div className="grid gap-4 sm:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="zip">CEP</Label>
            <div className="flex gap-2">
              <Input
                id="zip"
                placeholder="00000-000"
                inputMode="numeric"
                {...register("zip")}
                onBlur={lookupCep}
              />
              <Button type="button" variant="outline" size="icon" onClick={lookupCep} disabled={cepLoading} title="Buscar CEP">
                {cepLoading ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
              </Button>
            </div>
            {errors.zip ? <p className="text-xs text-destructive">{errors.zip.message}</p> : null}
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="street">Rua</Label>
            <Input id="street" {...register("street")} />
          </div>
          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="number">Número</Label>
            <Input id="number" {...register("number")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="complement">Complemento</Label>
            <Input id="complement" {...register("complement")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="district">Bairro</Label>
            <Input id="district" {...register("district")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="city">Cidade</Label>
            <Input id="city" {...register("city")} />
          </div>
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
          <div className="space-y-1.5 sm:col-span-6">
            <Label htmlFor="reference">Referência</Label>
            <Input id="reference" {...register("reference")} />
          </div>
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
