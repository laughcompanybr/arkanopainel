import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Accessibility smoke tests using axe-core. We assert zero WCAG 2.1 AA
 * violations for the primary user-facing surfaces. Runs in the two viewport
 * projects defined in playwright.config.ts (desktop 1440×900, Pixel 7).
 */

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test.describe("Accessibility — public surfaces", () => {
  test("/auth has no serious a11y violations", async ({ page }) => {
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    // Only fail on serious/critical impact — moderate items are logged.
    const blocking = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    if (blocking.length) {
      console.error(
        "axe violations at /auth:\n",
        blocking.map((v) => `- [${v.impact}] ${v.id}: ${v.description}`).join("\n"),
      );
    }
    expect(blocking, "no serious/critical a11y violations at /auth").toEqual([]);
  });

  test("/auth keyboard flow reaches the submit button", async ({ page }) => {
    await page.goto("/auth");
    await page.locator("#email").focus();
    await page.keyboard.type("teste@example.com");
    await page.keyboard.press("Tab");
    await page.keyboard.type("s3nh4-teste");
    // Submit button should be reachable via keyboard.
    const submit = page.getByRole("button", { name: /Entrar/i });
    await expect(submit).toBeVisible();
    await expect(submit).toBeEnabled();
  });
});

test.describe("Accessibility — private surfaces", () => {
  test.beforeEach(async ({ page }, info) => {
    const sess = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
    const key = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
    if (!sess || !key) {
      info.skip(true, "No injected Supabase session — skipping authenticated a11y checks.");
      return;
    }
    await page.goto("/");
    await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [key, sess]);
  });

  test("/dashboard has no serious a11y violations", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    const blocking = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    if (blocking.length) {
      console.error(
        "axe violations at /dashboard:\n",
        blocking.map((v) => `- [${v.impact}] ${v.id}: ${v.description}`).join("\n"),
      );
    }
    expect(blocking, "no serious/critical a11y violations at /dashboard").toEqual([]);
  });
});
