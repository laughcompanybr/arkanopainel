import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Plus,
  Search,
  ArrowUpDown,
  MoreVertical,
  Trash2,
  Undo2,
  MessageCircle,
  Truck,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Mail,
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
import { SupplierForm } from "@/features/suppliers/SupplierForm";
import { SupplierDetailSheet } from "@/features/suppliers/SupplierDetailSheet";
import {
  listSuppliers,
  createSupplier,
  softDeleteSupplier,
  restoreSupplier,
} from "@/features/suppliers/suppliers.functions";
import { formatDate } from "@/lib/format";

type SortKey = "name" | "created_at" | "updated_at" | "avg_delivery_days";

function FornecedoresPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSuppliers);
  const createFn = useServerFn(createSupplier);
  const delFn = useServerFn(softDeleteSupplier);
  const restoreFn = useServerFn(restoreSupplier);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pageSize = 20;

  const filter = useMemo(
    () => ({
      search: search.trim() || undefined,
      sort,
      order,
      includeDeleted,
      page,
      pageSize,
    }),
    [search, sort, order, includeDeleted, page],
  );

  const query = useQuery({
    queryKey: ["suppliers", filter],
    queryFn: () => listFn({ data: filter }),
    placeholderData: (prev) => prev,
  });

  const createMut = useMutation({
    mutationFn: (v: Record<string, unknown>) => createFn({ data: v as never }),
    onSuccess: () => {
      toast.success("Fornecedor criado");
      setOpenCreate(false);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Fornecedor removido");
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => restoreFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Fornecedor restaurado");
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const toggleSort = (key: SortKey) => {
    if (sort === key) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSort(key); setOrder("asc"); }
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Gestão"
        title="Fornecedores"
        description="Rede de fornecedores com prazos, contatos e pedidos vinculados."
        actions={
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 size-4" /> Novo fornecedor</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Novo fornecedor</DialogTitle>
              </DialogHeader>
              <SupplierForm
                submitLabel="Criar fornecedor"
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
              placeholder="Nome, empresa, e-mail, telefone..."
              className="pl-9"
            />
          </div>
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
            icon={Truck}
            title="Nenhum fornecedor encontrado"
            description="Ajuste os filtros ou cadastre um novo fornecedor."
            action={<Button onClick={() => setOpenCreate(true)}><Plus className="mr-2 size-4" /> Novo fornecedor</Button>}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("name")}>
                      Nome <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>
                    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("avg_delivery_days")}>
                      Prazo médio <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("created_at")}>
                      Criado em <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow
                    key={s.id}
                    className={s.deleted_at ? "opacity-50" : "cursor-pointer"}
                    onClick={() => !s.deleted_at && setSelectedId(s.id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {s.name}
                        {s.deleted_at ? <Badge variant="outline" className="text-[10px]">removido</Badge> : null}
                      </div>
                      {s.instagram ? <p className="text-xs text-muted-foreground">@{s.instagram}</p> : null}
                    </TableCell>
                    <TableCell className="text-sm">{s.company ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">
                      {s.whatsapp ?? s.phone ?? <span className="text-muted-foreground">—</span>}
                      {s.email ? <p className="text-xs text-muted-foreground">{s.email}</p> : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.avg_delivery_days ? <Badge variant="outline">{s.avg_delivery_days} dias</Badge> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(s.created_at)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost"><MoreVertical className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {s.whatsapp ? (
                            <DropdownMenuItem asChild>
                              <a href={`https://wa.me/55${s.whatsapp}`} target="_blank" rel="noopener">
                                <MessageCircle className="mr-2 size-4" /> WhatsApp
                              </a>
                            </DropdownMenuItem>
                          ) : null}
                          {s.email ? (
                            <DropdownMenuItem asChild>
                              <a href={`mailto:${s.email}`}>
                                <Mail className="mr-2 size-4" /> E-mail
                              </a>
                            </DropdownMenuItem>
                          ) : null}
                          {s.deleted_at ? (
                            <DropdownMenuItem onClick={() => restoreMut.mutate(s.id)}>
                              <Undo2 className="mr-2 size-4" /> Restaurar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => { if (confirm(`Remover ${s.name}?`)) delMut.mutate(s.id); }}
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
                {total} fornecedor{total === 1 ? "" : "es"} · página {page} de {totalPages}
              </p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <SupplierDetailSheet
        supplierId={selectedId}
        open={!!selectedId}
        onOpenChange={(o) => { if (!o) setSelectedId(null); }}
      />
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/fornecedores")({
  component: FornecedoresPage,
});
