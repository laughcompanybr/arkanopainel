import { test, expect } from "@playwright/test";

/**
 * E2E: quando a tax_percent persistida está fora de 0–100, o backend deve
 * clampar o valor antes de calcular o imposto e o dashboard precisa exibir
 * lucro bruto, imposto e lucro líquido consistentes com esse clamp — além
 * de mostrar o aviso "corrigido automaticamente".
 *
 * Interceptamos a chamada do server fn `getDashboardStats` para simular o
 * cenário sem depender de sessão real ou de mutação no banco.
 */

const DASHBOARD_FN = /\/_serverFn\/.*getDashboardStats/;

// Formata como o dashboard (Intl BRL) — usado para casar valores exibidos.
const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function mockStats(rawTax: number, clampedTax: number) {
  const grossProfit = 10_000;
  const expenses = 1_500;
  const taxAmount = Math.max(grossProfit, 0) * (clampedTax / 100);
  const netProfit = grossProfit - expenses - taxAmount;
  return {
    revenueMonth: 20_000,
    profitMonth: netProfit,
    profitGrossMonth: grossProfit,
    taxAmountMonth: taxAmount,
    taxRate: clampedTax,
    taxRateClamped: true,
    taxRateRaw: rawTax,
    expensesMonth: expenses,
    receivable: 0,
    payable: expenses,
    ordersMonth: 3,
    clientsTotal: 5,
    avgTicket: 5_000,
    avgProfit: 2_000,
    commissionMonth: 0,
    cardFeesMonth: 0,
    shippingMonth: 0,
    receivedMonth: 0,
    pendingMonth: 0,
    watchesSoldMonth: 3,
    monthComparison: { revenuePrev: 0, profitPrev: 0, revenueDelta: 0, profitDelta: 0 },
    topProducts: [],
    pipeline: { awaitingPayment: 0, inTransit: 0, delivered: 0 },
    monthly: [],
    activity: [],
  };
}

test.describe("Dashboard — clamp visual da tax_percent", () => {
  test("tax_percent > 100 é clampada para 100 e valores batem", async ({ page }) => {
    const payload = mockStats(250, 100);
    await page.route(DASHBOARD_FN, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: payload } }),
      }),
    );

    await page.goto("/dashboard");
    // Se não estiver autenticado, o gate manda pra /auth — nesse caso o teste
    // não pode validar a UI e é marcado como skipped.
    await page.waitForLoadState("networkidle");
    if (!/\/dashboard/.test(page.url())) test.skip(true, "Sem sessão autenticada no ambiente E2E");

    const warn = page.getByTestId("tax-clamp-warning");
    await expect(warn).toBeVisible();
    await expect(warn).toContainText("250");
    await expect(warn).toContainText("100");

    await expect(page.getByTestId("pb-gross")).toHaveText(brl(10_000));
    await expect(page.getByTestId("pb-expenses")).toHaveText(`−${brl(1_500)}`);
    // 10_000 * 100% = 10_000 de imposto
    await expect(page.getByTestId("pb-tax")).toHaveText(`−${brl(10_000)}`);
    // 10_000 - 1_500 - 10_000 = -1_500
    await expect(page.getByTestId("pb-net")).toHaveText(brl(-1_500));
  });

  test("tax_percent < 0 é clampada para 0 (nenhum imposto abatido)", async ({ page }) => {
    const payload = mockStats(-25, 0);
    await page.route(DASHBOARD_FN, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: payload } }),
      }),
    );

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    if (!/\/dashboard/.test(page.url())) test.skip(true, "Sem sessão autenticada no ambiente E2E");

    const warn = page.getByTestId("tax-clamp-warning");
    await expect(warn).toBeVisible();
    await expect(warn).toContainText("-25");

    await expect(page.getByTestId("pb-tax")).toHaveText(`−${brl(0)}`);
    // 10_000 - 1_500 - 0 = 8_500
    await expect(page.getByTestId("pb-net")).toHaveText(brl(8_500));
  });

  test("botão de exportar PDF do detalhamento existe", async ({ page }) => {
    const payload = mockStats(6, 6);
    payload.taxRateClamped = false;
    payload.taxRateRaw = 6;
    await page.route(DASHBOARD_FN, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: payload } }),
      }),
    );
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    if (!/\/dashboard/.test(page.url())) test.skip(true, "Sem sessão autenticada no ambiente E2E");
    await expect(page.getByTestId("export-breakdown-pdf")).toBeVisible();
  });
});
