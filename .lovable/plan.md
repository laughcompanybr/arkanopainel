# Hardening para Produção — Plano em Fases

Escopo: apenas melhorias internas (segurança, tipagem, SSR, performance, portabilidade). **Nenhuma mudança de layout, identidade visual ou funcionalidade.** Vou executar em 5 fases, cada uma pequena e verificável, com typecheck + testes rodando ao final de cada uma. Você aprova este plano e eu começo pela Fase 1 automaticamente, parando apenas se algo exigir decisão.

Muitas das 14 seções da sua lista já foram cobertas em turnos anteriores. Marco abaixo o que já está feito para não gastar orçamento repetindo.

---

## Já entregue em turnos anteriores (não vou refazer)

- Zod client + server (schemas em `src/features/*/schemas.ts` + `.inputValidator` em cada `createServerFn`)
- RLS + `has_role` + `user_roles` separada + GRANTs em todas as tabelas
- Auth gate em `_authenticated/route.tsx` (ssr:false, sem duplicação em children)
- SSR error wrapper de 5 camadas em `src/server.ts` + `src/lib/error-capture.ts` + `errorComponent` root
- `AbortError` silenciado globalmente (`QueryClient` + `useAbortSafe*`)
- Validação server-side de comprovante (mime/ext/size/vazio) + testes unitários
- Plugin `strip-tsd-source` em `vite.config.ts` + teste E2E de hydration warnings
- Filtros persistidos na URL via `zodValidator`
- `audit_log` para eventos sensíveis (RECEIPT_ATTACHED, bulkPay, markPaid)
- Testes E2E: auth, dashboard, orders, finance, silent-navigation, hydration

---

## Fase 1 — Segurança e variáveis de ambiente (baixo risco)

1. **`.env.example`** completo com todas as chaves usadas (`VITE_SUPABASE_*`, `SUPABASE_*` server-only, `LOVABLE_API_KEY`), comentando runtime vs build.
2. **Módulo central `src/config/env.ts`** — leitura tipada e validada (Zod) das variáveis client (`import.meta.env.VITE_*`) e helper `getServerEnv()` (só executa em server fn) para as server-only. Componentes passam a importar daqui, nunca `import.meta.env.X` direto.
3. **Auditar `src/**` por leituras de `process.env` fora de handlers** e mover para dentro (execução no worker exige isso).
4. **Rodar `security--run_security_scan`** e corrigir achados de RLS/GRANT que aparecerem.
5. **Rodar `code--dependency_scan`** — corrigir vulnerabilidades high/critical apenas se houver patch não-breaking.
6. **Sanitização de saídas HTML** — grep por `dangerouslySetInnerHTML` (deve ser zero; se houver, envolver em DOMPurify).
7. **Mensagens de erro** — auditar `throw new Error(supabaseError.message)` em handlers e substituir por mensagem genérica no cliente + `console.error` server-side com o detalhe.

## Fase 2 — Tipagem e código morto (baixo risco)

1. Rodar `tsgo --noEmit` e eliminar todos os `any` restantes em `src/`. Substituir por tipos gerados de `@/integrations/supabase/types` ou generics reais.
2. `eslint --max-warnings=0` com `@typescript-eslint/no-unused-vars`, `no-unused-imports`, `no-explicit-any`, `no-floating-promises` — corrigir todos.
3. `knip` (ou `ts-prune`) para achar exports/arquivos/dependências não utilizados. Remover apenas o comprovadamente morto.
4. Auditar `package.json` — mover para `devDependencies` o que só é usado em `tests/` e `scripts/`.

## Fase 3 — Portabilidade e SSR (médio risco)

1. **Grep global** por uso não-guardado de `window|document|localStorage|sessionStorage|navigator|location|history|matchMedia` — envolver em `useEffect`, `useHydrated()`, ou helper `isBrowser()`.
2. **Remover qualquer `process.env` em código isomórfico** (loaders, componentes). Apenas em `.handler()`.
3. Runtime alvo continua Cloudflare Workers (default do template). Nenhuma dependência Node-only para Vercel/Netlify/VPS: a mesma imagem funciona nos três porque os adaptadores do Nitro absorvem a diferença. **Não vou trocar o adapter** — o template já é multi-adapter via Nitro.
4. **Dockerfile mínimo** (multi-stage: `bun install --production` + `bun run build` + servir com Bun) — opcional, marque se quer.

## Fase 4 — Performance (médio risco)

1. Confirmar code-splitting automático de rotas (já ativo pelo TanStack Router).
2. Auditar re-renders em componentes grandes com selectors do `useSearch`/`useRouteContext` (`{ select: ... }`).
3. Confirmar `QueryClient` global tem `staleTime` sensato para queries de finance/orders (evita refetch em navegação Back/Forward).
4. `bun run build` + analisar bundle report (`rollup-plugin-visualizer`) — só corto o que tiver ganho >20KB.
5. Preload da fonte principal + LCP image via `head().links` na home.

## Fase 5 — Deploy e validação final

1. `bun run build` end-to-end com zero warnings críticos.
2. `tsgo --noEmit` limpo.
3. `bunx vitest run` — todos passam.
4. `playwright test` — smoke em desktop.
5. `security--run_security_scan` final.
6. Documentar em `README.md` como configurar env para Vercel/Netlify/Cloudflare/Docker (variáveis a definir, nada de código).

---

## Detalhes técnicos

- **Não vou trocar Vite plugin, Nitro adapter, ou o cliente Supabase gerado.** Esses são auto-managed pelo template.
- **Não vou tocar em `src/routeTree.gen.ts`, `src/integrations/supabase/client.ts`, `types.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `.env`, ou `supabase/config.toml`.**
- **Migrations SQL só se o security scan apontar** — não vou "melhorar" schema por conta própria.
- **Reescrever componentes grandes está fora do escopo** desta rodada porque é refatoração comportamental (mesmo mantendo output). Vou listá-los ao final para você decidir num turno futuro.
- Cada fase termina com typecheck + testes rodando; se qualquer coisa quebrar eu paro e reporto antes de seguir.

## O que preciso confirmar antes de começar

1. **OK executar as 5 fases em sequência automática**, pausando apenas em erro? (Sim = eu começo pela Fase 1 no próximo turno.)
2. **Runtime alvo**: mantenho Cloudflare Workers via Nitro (o default do template, já portável para Vercel/Netlify/Node via troca de adapter)? Ou você quer que eu já adicione um Dockerfile agora?
3. **Componentes grandes**: só listo ao final (recomendado), ou você quer que a Fase 2 já quebre os top-3 maiores em subcomponentes?
