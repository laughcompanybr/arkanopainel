import { expect, test } from "@playwright/test";

/**
 * Baseline security-header check for public + private routes.
 * The security-headers middleware in src/start.ts applies these on every
 * SSR HTML response; a regression here means the middleware got dropped
 * or the response bypassed it.
 */

const REQUIRED = {
  "x-content-type-options": /nosniff/i,
  "x-frame-options": /SAMEORIGIN|DENY/i,
  "referrer-policy": /strict-origin-when-cross-origin/i,
  "permissions-policy": /camera=\(\)/i,
  "cross-origin-opener-policy": /same-origin/i,
} as const;

const ROUTES = ["/auth", "/reset-password", "/dashboard", "/configuracoes"];

for (const route of ROUTES) {
  test(`${route} advertises baseline security headers`, async ({ request }) => {
    const res = await request.get(route);
    expect(res.status(), `${route} responded ${res.status()}`).toBeLessThan(500);
    const contentType = res.headers()["content-type"] ?? "";
    // We only enforce headers on HTML responses (the middleware skips others).
    if (!contentType.includes("text/html")) return;

    for (const [name, pattern] of Object.entries(REQUIRED)) {
      const value = res.headers()[name];
      expect(value, `${route} missing header ${name}`).toBeTruthy();
      expect(value, `${route} header ${name} = "${value}"`).toMatch(pattern);
    }
  });
}
