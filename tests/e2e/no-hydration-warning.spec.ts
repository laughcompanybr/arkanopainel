import { expect, test } from "@playwright/test";

/**
 * Guardrail: SSR-rendered routes must hydrate cleanly. Any hydration
 * mismatch warning surfaces as a console.error from React that starts
 * with "A tree hydrated but some attributes/text of the server rendered
 * HTML didn't match the client". This test opens every reachable route
 * (public + authenticated, when a session is injected) and asserts none
 * of them emit that warning.
 *
 * Runs against the running preview build (mode=development, but with
 * SSR enabled — the exact configuration where the previous
 * `data-tsd-source` mismatch appeared).
 */

const PUBLIC_ROUTES = ["/", "/auth"];
const AUTHENTICATED_ROUTES = [
  "/dashboard",
  "/pedidos",
  "/clientes",
  "/financeiro",
  "/configuracoes",
];

const HYDRATION_RE =
  /hydrat(ed|ion)|didn't match|did not match|Expected server HTML to contain|Text content does not match/i;

async function collectConsoleErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error" && msg.type() !== "warning") return;
    const text = msg.text();
    if (HYDRATION_RE.test(text)) errors.push(text);
  });
  page.on("pageerror", (err) => {
    if (HYDRATION_RE.test(err.message)) errors.push(err.message);
  });
  return errors;
}

test.describe("No hydration warnings on SSR routes", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`public route ${route} hydrates cleanly`, async ({ page }) => {
      const errors = await collectConsoleErrors(page);
      await page.goto(route, { waitUntil: "domcontentloaded" });
      // Give React time to hydrate and log any warning
      await page.waitForTimeout(600);
      expect(errors, `Hydration warnings on ${route}:\n${errors.join("\n---\n")}`).toEqual([]);
    });
  }

  test.describe("authenticated routes", () => {
    test.beforeEach(async ({ page }, info) => {
      const sess = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
      const key = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
      if (!sess || !key) {
        info.skip(true, "No injected Supabase session — skipping authenticated hydration checks.");
        return;
      }
      await page.goto("/");
      await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [key, sess]);
    });

    for (const route of AUTHENTICATED_ROUTES) {
      test(`authenticated route ${route} hydrates cleanly`, async ({ page }) => {
        const errors = await collectConsoleErrors(page);
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(800);
        expect(errors, `Hydration warnings on ${route}:\n${errors.join("\n---\n")}`).toEqual([]);
      });
    }
  });
});
