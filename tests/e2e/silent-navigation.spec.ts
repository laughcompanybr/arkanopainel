import { expect, test } from "@playwright/test";

/**
 * Navigating between authenticated sections must NEVER surface the
 * "Verificando sessão…" banner. Skeletons are allowed (they appear
 * inside the AppShell). This spec requires an injected session — it
 * skips cleanly when unauthenticated.
 */

const SECTIONS = ["/dashboard", "/pedidos", "/clientes", "/financeiro", "/configuracoes"];

test.describe("Authenticated navigation is silent", () => {
  test.beforeEach(async ({ page }, info) => {
    const sess = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
    const key = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
    if (!sess || !key) {
      info.skip(true, "No injected Supabase session — skipping silent-nav checks.");
      return;
    }
    await page.goto("/");
    await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [key, sess]);
  });

  test("never shows 'Verificando sessão…' between sections", async ({ page }) => {
    const violations: { at: string; snippet: string }[] = [];
    const checkForBanner = async (label: string) => {
      const text = await page.locator("body").innerText().catch(() => "");
      if (/Verificando sessão/i.test(text)) {
        violations.push({ at: label, snippet: text.slice(0, 200) });
      }
    };

    // Poll while navigating so we catch transient renders too.
    const interval = setInterval(() => void checkForBanner("interval"), 80);

    // Initial mount to /dashboard (this is the ONE place the banner is
    // allowed to show briefly — we skip the first 400ms of this route).
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);

    for (const route of SECTIONS) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      await checkForBanner(`after nav ${route}`);
      // Verify the AppShell footer with "Developed by Laugh Company" is still visible
      // — proves we're inside the shell, not on the pending screen.
      await expect(
        page.locator("footer").filter({ hasText: /Developed by Laugh Company/i }),
      ).toBeVisible();
    }

    clearInterval(interval);
    expect(violations, "'Verificando sessão…' banner leaked").toEqual([]);
  });

  test("dashboard skeletons appear during data fetch, not the auth banner", async ({ page }) => {
    // Slow down the server function to force the Suspense fallback.
    await page.route("**/_serverFn/**", async (route) => {
      await new Promise((r) => setTimeout(r, 250));
      await route.continue();
    });
    await page.goto("/dashboard");
    // Either the skeleton tiles or the loaded content should render — never
    // the "Verificando sessão…" screen inside the shell.
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/Verificando sessão/i);
    // Header appears immediately (outside Suspense).
    await expect(page.getByRole("heading", { level: 1, name: /Bom trabalho/i })).toBeVisible();
  });
});
