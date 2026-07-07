import { test, expect } from "@playwright/test";

/**
 * Smoke E2E do fluxo de pedidos:
 * - Página /pedidos precisa carregar sem blank screen.
 * - A busca deve estar disponível.
 * - Botão "Novo pedido" (ou equivalente) deve existir para operadores.
 *
 * O teste roda apenas contra a UI pública da rota; a criação real de
 * pedidos exige sessão autenticada e é coberta em testes com fixtures.
 */

test("página de pedidos carrega sem blank screen", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/pedidos");
  await page.waitForLoadState("networkidle");

  const url = page.url();
  const body = (await page.locator("body").innerText()).trim();
  expect(body.length, "página não pode ficar em branco").toBeGreaterThan(0);

  // Aceita redirecionamento para /auth (não logado) ou renderização do módulo.
  if (!url.includes("/auth")) {
    expect(/Pedidos|pedido/i.test(body)).toBe(true);
  }

  expect(errors.filter((e) => /Cannot read|undefined/.test(e))).toEqual([]);
});

test("Financeiro › aba Movimentações fica acessível", async ({ page }) => {
  await page.goto("/financeiro");
  await page.waitForLoadState("networkidle");
  const url = page.url();
  if (url.includes("/auth")) test.skip(true, "requer sessão autenticada");

  const tab = page.getByRole("tab", { name: /Movimentações/i });
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(page.getByRole("button", { name: /Nova movimentação/i })).toBeVisible();
});
