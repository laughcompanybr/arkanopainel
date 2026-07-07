import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Undo2,
  MessageCircle,
  Mail,
  Loader2,
  ChevronLeft,
  ChevronRight,
  UsersRound,
  Pencil,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmployeeForm, EMPLOYEE_STATUS_LABEL } from "@/features/employees/EmployeeForm";
import {
  listEmployees,
  createEmployee,
  updateEmployee,
  softDeleteEmployee,
  restoreEmployee,
} from "@/features/employees/employees.functions";
import { formatDate } from "@/lib/format";
import type { EmployeeInput, EmployeeStatus } from "@/features/employees/schemas";

type Row = {
  id: string;
  full_name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  hire_date: string | null;
  base_salary: number | null;
  commission_percent: number | null;
  status: string;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

function FuncionariosPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listEmployees);
  const createFn = useServerFn(createEmployee);
  const updateFn = useServerFn(updateEmployee);
  const delFn = useServerFn(softDeleteEmployee);
  const restoreFn = useServerFn(restoreEmployee);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | EmployeeStatus>("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const pageSize = 20;

  const filter = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: statusFilter || undefined,
      includeDeleted,
      page,
      pageSize,
      sort: "created_at" as const,
      order: "desc" as const,
    }),
    [search, statusFilter, includeDeleted, page],
  );

  const query = useQuery({
    queryKey: ["employees", filter],
    queryFn: () => listFn({ data: filter }),
    placeholderData: (prev) => prev,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["employees"] });

  const createMut = useMutation({
    mutationFn: (v: Record<string, unknown>) => createFn({ data: v as never }),
    onSuccess: () => { toast.success("Funcionário criado"); setOpenCreate(false); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (v: Record<string, unknown>) => updateFn({ data: v as never }),
    onSuccess: () => { toast.success("Funcionário atualizado"); setEditing(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Funcionário removido"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => restoreFn({ data: { id } }),
    onSuccess: () => { toast.success("Funcionário restaurado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (query.data?.rows ?? []) as Row[];
  const total = query.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const editingDefaults: Partial<EmployeeInput> | undefined = editing
    ? {
        full_name: editing.full_name,
        role: editing.role ?? "",
        email: editing.email ?? "",
        phone: editing.phone ?? "",
        whatsapp: editing.whatsapp ?? "",
        hire_date: editing.hire_date ?? "",
        base_salary: editing.base_salary != null ? String(editing.base_salary) : "",
        commission_percent:
          editing.commission_percent != null ? String(editing.commission_percent) : "",
        status: (editing.status === "inactive" ? "inactive" : "active") as EmployeeStatus,
        notes: editing.notes ?? "",
      }
    : undefined;

  return (
    <div>
      <PageHeader
        eyebrow="Gestão"
        title="Funcionários"
        description="Cadastre e acompanhe a equipe. Cada comissão pode ser atribuída a um funcionário."
        actions={
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 size-4" /> Novo funcionário</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl" description="Cadastro de novo funcionário">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Novo funcionário</DialogTitle>
              </DialogHeader>
              <EmployeeForm
                submitLabel="Criar funcionário"
                onSubmit={async (v) => { await createMut.mutateAsync(v as never); }}
                onCancel={() => setOpenCreate(false)}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card/40 p-4">
        <div className="min-w-[240px] flex-1">
          <Label htmlFor="search" className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
            Pesquisar
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Nome, cargo, e-mail, telefone..."
              className="pl-9"
            />
          </div>
        </div>
        <div className="min-w-[180px]">
          <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as "" | EmployeeStatus); setPage(1); }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="deleted" checked={includeDeleted} onCheckedChange={(v) => { setIncludeDeleted(v); setPage(1); }} />
          <Label htmlFor="deleted" className="text-sm">Incluir removidos</Label>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
        {query.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-gold" /></div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title="Nenhum funcionário encontrado"
            description="Cadastre a equipe para atribuir comissões e acompanhar performance."
            action={<Button onClick={() => setOpenCreate(true)}><Plus className="mr-2 size-4" /> Novo funcionário</Button>}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Contratação</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e.id} className={e.deleted_at ? "opacity-50" : ""}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {e.full_name}
                        {e.deleted_at ? <Badge variant="outline" className="text-[10px]">removido</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{e.role ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">
                      {e.whatsapp ?? e.phone ?? <span className="text-muted-foreground">—</span>}
                      {e.email ? <p className="text-xs text-muted-foreground">{e.email}</p> : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {e.hire_date ? formatDate(e.hire_date) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.commission_percent != null ? `${e.commission_percent}%` : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.status === "active" ? "default" : "outline"}>
                        {EMPLOYEE_STATUS_LABEL[e.status as keyof typeof EMPLOYEE_STATUS_LABEL] ?? e.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" aria-label="Ações"><MoreVertical className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!e.deleted_at ? (
                            <DropdownMenuItem onClick={() => setEditing(e)}>
                              <Pencil className="mr-2 size-4" /> Editar
                            </DropdownMenuItem>
                          ) : null}
                          {e.whatsapp ? (
                            <DropdownMenuItem asChild>
                              <a href={`https://wa.me/55${e.whatsapp}`} target="_blank" rel="noopener">
                                <MessageCircle className="mr-2 size-4" /> WhatsApp
                              </a>
                            </DropdownMenuItem>
                          ) : null}
                          {e.email ? (
                            <DropdownMenuItem asChild>
                              <a href={`mailto:${e.email}`}>
                                <Mail className="mr-2 size-4" /> E-mail
                              </a>
                            </DropdownMenuItem>
                          ) : null}
                          {e.deleted_at ? (
                            <DropdownMenuItem onClick={() => restoreMut.mutate(e.id)}>
                              <Undo2 className="mr-2 size-4" /> Restaurar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => { if (confirm(`Remover ${e.full_name}?`)) delMut.mutate(e.id); }}
                            >
                              <Trash2 className="mr-2 size-4" /> Remover
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
              <p className="text-muted-foreground">
                {total} funcionário{total === 1 ? "" : "s"} · página {page} de {totalPages}
              </p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior">
                  <ChevronLeft className="size-4" />
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Próxima página">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl" description="Editar funcionário">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Editar funcionário</DialogTitle>
          </DialogHeader>
          {editing ? (
            <EmployeeForm
              submitLabel="Salvar alterações"
              defaultValues={editingDefaults}
              onSubmit={async (v) => { await updateMut.mutateAsync({ id: editing.id, ...(v as object) } as never); }}
              onCancel={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/funcionarios")({
  component: FuncionariosPage,
});
