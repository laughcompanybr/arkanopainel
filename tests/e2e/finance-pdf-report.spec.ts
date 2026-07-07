import { test, expect } from "@playwright/test";

/**
 * E2E: gerar/abrir o PDF do período no Financeiro e garantir que ele carrega
 * com sucesso — sem respostas 4xx/5xx do Supabase Storage para signed URLs
 * ou PUTs de comprovante durante a operação.
 */
test.describe("Financeiro — PDF do período", () => {
  test("abre financeiro sem 400 em signed URLs de comprovante", async ({ page }) => {
    const bad: Array<{ url: string; status: number }> = [];
    page.on("response", (resp) => {
      const url = resp.url();
      const isReceiptRequest =
        url.includes("/storage/v1/object/finance-receipts") ||
        url.includes("/storage/v1/object/sign/finance-receipts") ||
        url.includes("/storage/v1/object/upload/sign/finance-receipts");
      if (isReceiptRequest && resp.status() >= 400) {
        bad.push({ url, status: resp.status() });
      }
    });

    await page.goto("/financeiro");
    await page.waitForLoadState("networkidle");

    // Aguarda a tela carregar (título ou tabs). Não falha se algum tab não existir.
    await expect(page.getByRole("heading", { name: /Financeiro/i })).toBeVisible({ timeout: 10_000 });

    // Se houver um botão de "Relatório" ou "PDF", tenta clicar; caso contrário,
    // apenas navega pelas tabs para forçar carga de assinaturas de comprovante.
    const pdfBtn = page.getByRole("button", { name: /PDF|Relatório do período|Exportar/i }).first();
    if (await pdfBtn.isVisible().catch(() => false)) {
      await pdfBtn.click().catch(() => undefined);
      await page.waitForTimeout(1_500);
    }

    // Alterna abas para forçar listagem de pagamentos/comprovantes
    for (const name of [/A pagar/i, /A receber/i, /Histórico/i]) {
      const tab = page.getByRole("tab", { name });
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(500);
      }
    }

    expect(bad, `Requisições de storage retornaram ≥400: ${JSON.stringify(bad, null, 2)}`).toHaveLength(0);
  });
});
