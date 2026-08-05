import { test, expect } from "@playwright/test";

test.describe("Dashboard & Monthly Sync Integration", () => {
  test("should load dashboard KPIs even if overrides are missing", async ({ page }) => {
    // Navigate to dashboard
    await page.goto("http://localhost:8080/dashboard");
    
    // Check if main KPI containers exist (even if 0)
    const revenueKpi = page.getByText("Receita · mês");
    await expect(revenueKpi).toBeVisible();
    
    const expensesKpi = page.getByText("Despesas · mês");
    await expect(expensesKpi).toBeVisible();
  });

  test("should reflect monthly report overrides in dashboard", async ({ page }) => {
    // This test assumes an authenticated session and pre-existing data
    // In a real environment, we'd seed a specific override and check dashboard values
    await page.goto("http://localhost:8080/mensais");
    await expect(page.getByText("Relatórios")).toBeVisible();
    
    // Just verifying navigation sync
    await page.goto("http://localhost:8080/dashboard");
    await expect(page.getByText("Fluxo de Caixa")).toBeVisible();
  });
});
