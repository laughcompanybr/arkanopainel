#!/usr/bin/env node
/**
 * Consolida os guards de segurança do banco em um único relatório JSON.
 * Reproduz localmente os scanners `SUPA_anon_security_definer_function_executable`
 * e `SUPA_authenticated_security_definer_function_executable` e materializa o
 * resultado em `security-scan-report.json` para upload como artifact de CI.
 *
 * Falha o processo (exit 1) se houver qualquer finding com level=error.
 * Warnings são reportados no relatório mas não falham o pipeline (contexto
 * de RLS pode exigir EXECUTE para `authenticated`).
 *
 * Requer: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { writeFileSync } from "node:fs";

const OUT = process.env.SECURITY_SCAN_OUT ?? "security-scan-report.json";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const report = {
  scanned_at: new Date().toISOString(),
  status: "unknown",
  findings: [],
  metadata: {},
};

if (!SUPABASE_URL || !SERVICE_KEY) {
  report.status = "skipped";
  report.reason = "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes";
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.warn(`[scan] pulado — credenciais ausentes. Relatório em ${OUT}`);
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
  if (!res.ok) throw new Error(`pg-meta HTTP ${res.status}`);
  return res.json();
}

try {
  const rows = await query(`
    SELECT p.proname AS name,
           array_to_string(p.proacl, ',') AS acl
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true;
  `);

  for (const r of rows) {
    const acl = r.acl || "";
    if (!acl || /(^|,)=X\//.test(acl)) {
      report.findings.push({
        id: "SUPA_anon_security_definer_function_executable",
        level: "error",
        function: r.name,
        detail: acl || "ACL vazia (PUBLIC pode executar)",
      });
    } else if (/anon=X\//.test(acl)) {
      report.findings.push({
        id: "SUPA_anon_security_definer_function_executable",
        level: "error",
        function: r.name,
        detail: `anon com EXECUTE (ACL: ${acl})`,
      });
    }
    if (/authenticated=X\//.test(acl)) {
      report.findings.push({
        id: "SUPA_authenticated_security_definer_function_executable",
        level: "warn",
        function: r.name,
        detail: `authenticated com EXECUTE — verifique se é necessário para RLS`,
      });
    }
  }

  report.metadata.inspected_functions = rows.length;
  const errors = report.findings.filter((f) => f.level === "error").length;
  const warns = report.findings.filter((f) => f.level === "warn").length;
  report.status = errors > 0 ? "failed" : "passed";
  report.summary = { errors, warns };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(
    `[scan] ${report.status.toUpperCase()} — ${errors} erro(s), ${warns} aviso(s). Relatório em ${OUT}`,
  );
  for (const f of report.findings) {
    const glyph = f.level === "error" ? "❌" : "⚠️";
    console.log(`  ${glyph} [${f.level}] ${f.id} · ${f.function} — ${f.detail}`);
  }
  process.exit(errors > 0 ? 1 : 0);
} catch (err) {
  report.status = "error";
  report.error = err?.message ?? String(err);
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.error(`[scan] falhou: ${report.error}`);
  process.exit(1);
}
