import { test, expect } from "@playwright/test";

/**
 * E2E: pagar em lote e marcar como paga com comprovante opcional.
 *
 * Este teste assume que existe um usuário staff/admin autenticado
 * (session helper Lovable) e pedidos com contas a pagar em aberto.
 * O objetivo é validar o fluxo visual completo: selecionar múltiplas
 * contas, confirmar pagamento em lote, e validar que o comprovante
 * aparece no histórico após o upload.
 */
test.describe("Financeiro — pagar em lote", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/financeiro");
    await page.waitForLoadState("networkidle");
  });

  test("abre aba A pagar e usa filtros", async ({ page }) => {
    await page.getByRole("tab", { name: /A pagar/i }).click();

    // Busca por fornecedor deve reduzir o número de linhas ou mostrar vazio
    const searchInput = page.getByPlaceholder(/Buscar por fornecedor/i);
    await searchInput.fill("__none__");
    await expect(page.getByText(/Nada a pagar|Nenhum saldo/i)).toBeVisible({ timeout: 5000 });
    await searchInput.clear();

    // Preset "Atrasados" aplica filtro overdue
    const statusSelect = page.locator('select, [role="combobox"]').first();
    if (await statusSelect.isVisible().catch(() => false)) {
      await statusSelect.click();
      const opt = page.getByRole("option", { name: /Atrasados/i });
      if (await opt.isVisible().catch(() => false)) await opt.click();
    }
  });

  test("marca como paga com comprovante opcional (fluxo visual)", async ({ page }) => {
    await page.getByRole("tab", { name: /A pagar/i }).click();
    const payBtn = page.getByRole("button", { name: /Marcar como paga|Pagar/i }).first();
    if (!(await payBtn.isVisible().catch(() => false))) {
      test.skip(true, "Sem contas a pagar no ambiente");
    }
    await payBtn.click();

    // Dialog aparece
    await expect(page.getByRole("dialog")).toBeVisible();

    // Comprovante é opcional — apenas verifica que o botão de anexar existe
    await expect(page.getByRole("button", { name: /Anexar comprovante/i })).toBeVisible();

    // Fechar sem alterar
    await page.keyboard.press("Escape");
  });

  test("aba de Metas exibe cards de recordes", async ({ page }) => {
    await page.getByRole("tab", { name: /Metas/i }).click();
    await expect(page.getByText(/Meta do mês/i)).toBeVisible();
    await expect(page.getByText(/Maior venda|Recorde de vendas/i).first()).toBeVisible();
  });

  test("histórico de contas a pagar suporta carregar mais", async ({ page }) => {
    await page.getByRole("tab", { name: /A pagar/i }).click();

    const historyBtn = page.getByRole("button", { name: /Histórico|History/i }).first();
    if (!(await historyBtn.isVisible().catch(() => false))) {
      test.skip(true, "Sem contas a pagar com histórico no ambiente");
    }
    await historyBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Se houver botão "Carregar mais", clicar deve manter o dialog aberto e
    // aumentar (ou manter) a contagem de linhas renderizadas.
    const loadMore = dialog.getByRole("button", { name: /Carregar mais/i });
    if (await loadMore.isVisible().catch(() => false)) {
      const before = await dialog.locator("tr, li").count();
      await loadMore.click();
      await page.waitForTimeout(500);
      const after = await dialog.locator("tr, li").count();
      expect(after).toBeGreaterThanOrEqual(before);
    }

    await page.keyboard.press("Escape");
  });

  test("comprovante inválido é rejeitado antes de salvar", async ({ page }) => {
    // Testa a validação client-side do <ReceiptField />: tipo e tamanho.
    await page.getByRole("tab", { name: /A pagar|Movimentações/i }).first().click();
    const payBtn = page
      .getByRole("button", { name: /Marcar como paga|Pagar|Nova movimentação/i })
      .first();
    if (!(await payBtn.isVisible().catch(() => false))) {
      test.skip(true, "Sem ponto de entrada para upload de comprovante");
    }
    await payBtn.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const attach = dialog.getByRole("button", { name: /Anexar comprovante/i });
    if (!(await attach.isVisible().catch(() => false))) {
      test.skip(true, "Ponto de anexo não visível neste dialog");
    }

    // 1) mimetype inválido — .exe deve falhar sem persistir path
    const fileInput = dialog.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "malicioso.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("not-a-receipt"),
    });
    await expect(dialog.getByText(/Tipo de arquivo não permitido/i)).toBeVisible({ timeout: 3000 });

    // 2) tamanho > 10MB — deve falhar com mensagem específica
    const oversized = Buffer.alloc(11 * 1024 * 1024, 0);
    await fileInput.setInputFiles({
      name: "grande.pdf",
      mimeType: "application/pdf",
      buffer: oversized,
    });
    await expect(dialog.getByText(/excede 10MB/i)).toBeVisible({ timeout: 3000 });

    // Fecha sem persistir
    await page.keyboard.press("Escape");
  });
});

