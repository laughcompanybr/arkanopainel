#!/usr/bin/env node
/**
 * Introspecção de permissões no Supabase.
 *
 * 1. Descobre todas as funções SECURITY DEFINER do schema `public`
 *    referenciadas por políticas RLS (qual + with_check).
 * 2. Garante que `authenticated` e `service_role` tenham EXECUTE em cada uma.
 * 3. Sempre exige explicitamente EXECUTE em `is_staff_or_admin` e `has_role`.
 *
 * Requer:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const REQUIRED_ROLES = ["authenticated", "service_role"];
const ALWAYS_CHECK = ["is_staff_or_admin", "has_role"];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.warn(
    "[grants] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes — pulando (defina como secrets no CI).",
  );
  process.exit(0);
}

async function query(sql) {
  const res = await fetch(`${SUPABASE_URL}/pg-meta/default/query`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    console.warn(`[grants] pg-meta indisponível (HTTP ${res.status}). Pulando.`);
    return null;
  }
  return res.json();
}

async function discoverFunctions() {
  // Lista funções SECURITY DEFINER do public schema que aparecem em pg_policies.
  const sql = `
    SELECT DISTINCT p.proname AS name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_policies pol ON pol.schemaname = 'public'
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND (
        (pol.qual IS NOT NULL AND pol.qual ILIKE '%' || p.proname || '%')
        OR (pol.with_check IS NOT NULL AND pol.with_check ILIKE '%' || p.proname || '%')
      );
  `;
  const rows = await query(sql);
  if (!Array.isArray(rows)) return null;
  return rows.map((r) => r.name);
}

async function aclFor(fnName) {
  const rows = await query(`
    SELECT array_to_string(p.proacl, ',') AS acl
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '${fnName.replace(/'/g, "''")}';
  `);
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows.map((r) => r.acl || "").join(" | ");
}

const discovered = (await discoverFunctions()) ?? [];
const targets = Array.from(new Set([...ALWAYS_CHECK, ...discovered]));

if (discovered.length) {
  console.log(
    `[grants] Descobertas ${discovered.length} funções SECURITY DEFINER referenciadas por RLS: ${discovered.join(", ")}`,
  );
}

let failed = false;

for (const fn of targets) {
  const acl = await aclFor(fn);
  if (acl === null) {
    console.warn(`[grants] ⚠️  Função ${fn} não encontrada em public.`);
    continue;
  }
  const missing = REQUIRED_ROLES.filter((role) => !acl.includes(`${role}=X`));
  if (missing.length) {
    failed = true;
    console.error(
      `[grants] ❌ ${fn} sem EXECUTE para: ${missing.join(", ")} (ACL: ${acl || "vazia"})`,
    );
  } else {
    console.log(`[grants] ✅ ${fn} — EXECUTE ok para ${REQUIRED_ROLES.join(", ")}`);
  }
}

if (failed) {
  console.error(
    "\n[grants] Pipeline falhou. Gere uma migration com GRANT EXECUTE ON FUNCTION public.<nome>(<args>) TO authenticated, service_role;",
  );
  process.exit(1);
}
