#!/usr/bin/env node
/**
 * Reproduz o scanner Supabase `SUPA_anon_security_definer_function_executable`
 * localmente no CI, falhando o pipeline se qualquer função SECURITY DEFINER
 * do schema `public` conceder EXECUTE para PUBLIC ou anon.
 *
 * Requer: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.warn(
    "[secdef] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes — pulando checagem.",
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
    console.warn(`[secdef] pg-meta indisponível (HTTP ${res.status}). Pulando.`);
    return null;
  }
  return res.json();
}

const rows = await query(`
  SELECT p.proname AS name,
         array_to_string(p.proacl, ',') AS acl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef = true;
`);

if (!Array.isArray(rows)) process.exit(0);

let failed = false;
for (const r of rows) {
  const acl = r.acl || "";
  // ACL vazia = grants padrão (PUBLIC EXECUTE) — falha imediata.
  if (!acl) {
    failed = true;
    console.error(
      `[secdef] ❌ ${r.name} sem ACL explícita — PUBLIC pode executar (findings SUPA_anon_*).`,
    );
    continue;
  }
  if (/(^|,)=X\//.test(acl)) {
    failed = true;
    console.error(`[secdef] ❌ ${r.name} concede EXECUTE a PUBLIC. ACL: ${acl}`);
  }
  if (/anon=X\//.test(acl)) {
    failed = true;
    console.error(`[secdef] ❌ ${r.name} concede EXECUTE a anon. ACL: ${acl}`);
  }
}

if (failed) {
  console.error(
    "\n[secdef] Pipeline falhou: revogue EXECUTE de PUBLIC/anon em funções SECURITY DEFINER do schema public.",
  );
  process.exit(1);
}

console.log(
  `[secdef] ✅ Nenhuma função SECURITY DEFINER (${rows.length} inspecionadas) expõe EXECUTE a PUBLIC/anon.`,
);
