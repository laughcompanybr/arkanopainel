import { test, expect } from '@playwright/test';

test('clicar em Detalhes & Edição abre a tela correta', async ({ page }) => {
  // Navega para a página de mensais
  await page.goto('http://localhost:8080/mensais');
  
  // Espera os cards carregarem
  await page.waitForSelector('div[role="button"]', { timeout: 10000 });
  
  // Pega o primeiro card
  const firstCard = page.locator('div[role="button"]').first();
  
  // Hover para mostrar o botão (o botão está com opacity-0 group-hover:opacity-100)
  await firstCard.hover();
  
  // Clica no botão "DETALHES & EDIÇÃO"
  const editButton = firstCard.getByRole('button', { name: /DETALHES & EDIÇÃO/i });
  await expect(editButton).toBeVisible();
  
  // Clica e aguarda navegação
  await Promise.all([
    page.waitForURL(/\/mensais\/\d{4}\/\d{1,2}/),
    editButton.click(),
  ]);
  
  // Verifica se o título da página de detalhes está presente
  await expect(page.getByText('Relatório Detalhado')).toBeVisible();
});
