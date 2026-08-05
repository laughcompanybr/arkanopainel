import { test, expect } from "@playwright/test";

test.describe("Optional Client Registration", () => {
  test("should register a client with only name", async ({ page }) => {
    // Navigate to clients page (assuming logged in if environment allows, or handle login)
    await page.goto("http://localhost:8080/clientes");
    
    await page.getByRole("button", { name: /novo cliente/i }).click();
    
    await page.getByLabel(/nome completo/i).fill("Cliente Teste Apenas Nome");
    await page.getByRole("button", { name: /criar cliente/i }).click();
    
    await expect(page.getByText(/cliente criado/i)).toBeVisible();
    await expect(page.getByText("Cliente Teste Apenas Nome")).toBeVisible();
  });

  test("should register a client with NO fields filled", async ({ page }) => {
    await page.goto("http://localhost:8080/clientes");
    
    await page.getByRole("button", { name: /novo cliente/i }).click();
    
    // Explicitly don't fill anything
    await page.getByRole("button", { name: /criar cliente/i }).click();
    
    await expect(page.getByText(/cliente criado/i)).toBeVisible();
    await expect(page.getByText("Sem nome")).toBeVisible();
  });
});
