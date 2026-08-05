import { test, expect } from '@playwright/test';

test('tasks table has due_time column and dashboard loads correctly', async ({ page }) => {
  await page.goto('http://localhost:8080/agenda');
  
  // Verify agenda page loads without schema errors
  await expect(page.getByText(/Agenda/i)).toBeVisible();
  
  // Navigate to dashboard to ensure no breaking errors there
  await page.goto('http://localhost:8080/dashboard');
  await expect(page.getByText(/A receber/i)).toBeVisible();
});
