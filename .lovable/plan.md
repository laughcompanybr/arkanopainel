# Arkano Club — Sistema de Gestão de Encomendas

Projeto de grande porte. Vou entregar em **fases incrementais**, cada uma revisável, priorizando fundação sólida (design system + banco + auth) antes de módulos.

## Stack (confirmada)
React + TypeScript + Vite + TanStack Router/Query + Tailwind v4 + shadcn/ui + Framer Motion + React Hook Form + Zod + Recharts + Lucide + Lovable Cloud (Supabase: Postgres, Auth, Storage, RLS).

> Observação: o template usa **TanStack Router** (não React Router DOM). Manterei o padrão da stack — funcionalmente equivalente e melhor tipado.

## Identidade visual
- Dark mode padrão, light opcional.
- Paleta Arkano: preto profundo `#0a0a0a`, off-white `#f5f3ee`, dourado `#c9a84c` (accent do logo), cinzas neutros.
- Tipografia: display serif refinada (Instrument Serif) + sans geométrica (Inter Tight) para UI.
- Glassmorphism sutil, sombras discretas, bordas 12–16px, micro-animações Framer Motion.
- Logo Arkano no topbar/sidebar/login.

## Arquitetura de pastas
```
src/
  routes/                 rotas TanStack (auth pública + _authenticated/*)
  components/
    ui/                   shadcn base
    layout/               AppShell, Sidebar, Topbar, CommandPalette
    common/               EmptyState, DataTable, StatCard, StatusBadge, Money
    orders/ clients/ suppliers/ finance/ dashboard/
  features/
    orders/ clients/ suppliers/ finance/ reports/
      (hooks, schemas zod, server-fns, tipos)
  lib/                    utils, formatters, currency, phone, cn
  integrations/supabase/  (gerado pelo Cloud)
```
Componentes pequenos e reutilizáveis; lazy loading por rota; code splitting automático via TanStack.

## Modelo de dados (Postgres + RLS)
Tabelas em `public`, todas com `GRANT` explícito, RLS ativo, `updated_at` triggers, `created_by uuid → auth.users`.

- `profiles` (id=auth.uid, full_name, avatar_url, theme)
- `user_roles` + enum `app_role` (`admin`,`staff`) + `has_role()` SECURITY DEFINER
- `clients` (name, phone, whatsapp, city, state, cpf, instagram, notes)
- `suppliers` (name, company, phone, whatsapp, instagram, email, avg_delivery_days, notes)
- `orders` (order_number serial, client_id, supplier_id, brand, model, reference, cost_price, sale_price, profit GENERATED, payment_method, amount_received, purchase_date, expected_delivery, tracking_code, notes, status enum)
  - enum `order_status`: `new`,`awaiting_deposit`,`paid`,`purchasing`,`in_transit`,`received`,`ready_delivery`,`delivered`,`cancelled`
- `order_events` (order_id, type, message, meta jsonb, created_at, actor) — timeline
- `order_attachments` (order_id, storage_path, kind, filename, mime, size)
- `payments` (order_id, direction in/out, amount, method, paid_at, notes) — financeiro
- `expenses` (category, amount, description, incurred_at) — saídas gerais
- Views: `v_order_financials`, `v_client_stats`, `v_supplier_stats`, `v_monthly_revenue`

RLS: usuários autenticados do workspace têm CRUD; `service_role` full. (Multi-tenant fica preparado via coluna `org_id` opcional em fase futura — não adicionado agora para não inchar.)

Triggers: `on_auth_user_created` cria profile + role `admin` para o primeiro usuário, `staff` para os demais. Trigger `on_order_status_change` insere `order_events` automaticamente.

Storage bucket privado `order-files` com policies por autenticação.

## Módulos (ordem de entrega)

**Fase 1 — Fundação** (esta entrega)
1. Habilitar Lovable Cloud.
2. Migração completa do schema + RLS + triggers + views + bucket.
3. Design system (tokens Arkano em `styles.css`, tema dark padrão, variantes shadcn).
4. AppShell: Sidebar + Topbar + Command Palette (⌘K busca global stub) + ThemeToggle.
5. Auth: `/auth` (login, cadastro, recuperar senha), `/reset-password`, layout `_authenticated` (já gerenciado pela integração), logout, sessão persistente.
6. Rota `/` (landing → redireciona pra dashboard se logado).

**Fase 2 — Núcleo operacional**
7. Clientes: lista (DataTable + busca + filtros), detalhe com histórico, form (RHF+Zod), botão WhatsApp.
8. Fornecedores: idem.
9. Pedidos: lista, form completo (upload fotos/comprovantes), detalhe com timeline automática, cálculo de lucro.
10. Kanban de pedidos com drag & drop (`@dnd-kit`), atualiza status + gera evento.

**Fase 3 — Inteligência**
11. Dashboard: StatCards + gráficos Recharts (receita/lucro/pedidos por mês, top produtos, top marcas) + atividades recentes.
12. Financeiro: entradas, saídas, fluxo de caixa, a receber, a pagar, filtros de período.
13. Busca global (Command Palette) — clientes, fornecedores, pedidos, telefone, modelo, referência.
14. Relatórios + exportação PDF (`jspdf`) e Excel (`xlsx`).

**Fase 4 — Configurações & polimento**
15. Configurações (perfil, senha, tema, preferências, export/import CSV).
16. Micro-animações finais, empty states, skeletons, toasts, revisão de acessibilidade.

## Segurança
RLS em todas as tabelas, `has_role` SECURITY DEFINER (sem recursão), validação Zod cliente+servidor via `createServerFn` para operações sensíveis, sanitização, sem chaves no frontend, headers padrão do host, logs sem PII. Rate limiting não é primitivo da plataforma — se necessário depois, discutimos abordagem ad-hoc.

## Nesta primeira mensagem entrego a Fase 1 completa
Fundação sólida (schema + auth + shell + design system + logo + tema) rodando de ponta a ponta. Ao aprovar, sigo direto para Fase 2 sem novas perguntas.

Confirma que sigo com esse plano e começo pela Fase 1?
