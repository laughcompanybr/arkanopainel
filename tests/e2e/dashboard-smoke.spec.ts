import { test, expect } from "@playwright/test";

/**
 * Smoke test: quando `is_staff_or_admin` (ou `has_role`) nega acesso via
 * PostgREST, o dashboard não pode ficar em blank screen — precisa renderizar
 * uma mensagem controlada ou redirecionar para `/access-denied`.
 *
 * Interceptamos o server fn para simular o erro de permissão sem depender
 * de sessão real.
 */

const DASHBOARD_FN = /\/_serverFn\/.*getDashboardStats/;

test("dashboard trata graciosamente erro de is_staff_or_admin (sem blank screen)", async ({
  page,
}) => {
  await page.route(DASHBOARD_FN, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          message: "permission denied for function is_staff_or_admin",
          code: "42501",
        },
      }),
    }),
  );

  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto("/dashboard");

  // Aceita 3 estados finais válidos: redirect para /auth (gate), redirect
  // para /access-denied ou renderização do fallback controlado.
  await page.waitForLoadState("networkidle");
  const url = page.url();
  const body = (await page.locator("body").innerText()).trim();

  expect(body.length, "página não pode ficar em branco").toBeGreaterThan(0);

  if (!url.includes("/auth")) {
    const denied = url.includes("/access-denied");
    const controlled = /Acesso restrito|Não foi possível carregar/i.test(body);
    expect(denied || controlled, `URL=${url} body=${body.slice(0, 120)}`).toBe(true);
  }

  // Nenhum erro não capturado deve escapar para o console.
  expect(consoleErrors.filter((e) => /Cannot read|undefined/.test(e))).toEqual([]);
});
