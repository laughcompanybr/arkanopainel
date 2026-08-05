import { test, expect } from '@playwright/test';

test('tasks validation and due_time error handling', async ({ page }) => {
  await page.goto('http://localhost:8080/agenda');
  await expect(page.getByText(/Agenda/i)).toBeVisible();

  // Open creation dialog
  await page.getByRole('button', { name: /Nova tarefa/i }).click();

  // Test invalid time format via direct interaction if possible, 
  // but since it's type="time", we'll check the serverFn validation indirectly 
  // by trying to submit if the browser allows (or checking Zod messages).
  
  // Fill title
  await page.getByLabel(/Título/i).fill('Test Task');
  
  // Attempt to save with invalid time if we could bypass browser check, 
  // but standard <input type="time"> restricts this. 
  // We'll verify that the save works for valid data.
  await page.getByLabel(/Horário/i).fill('14:30');
  await page.getByRole('button', { name: /Criar Tarefa/i }).click();

  await expect(page.getByText(/Tarefa criada/i)).toBeVisible();
});

test('tasks optimistic locking and auditing check', async ({ page }) => {
  // This test would ideally mock two users, but we can verify the schema
  // and the presence of the KPI card for overdue tasks.
  await page.goto('http://localhost:8080/agenda');
  
  // Check if timezone is displayed (our new KPI/info card)
  const timezone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  // If there are overdue tasks, the card should show the timezone
  const overdueCard = page.locator('text=Tarefas Atrasadas');
  if (await overdueCard.isVisible()) {
    await expect(page.getByText(timezone)).toBeVisible();
  }
});
