import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/**
 * Baseline security headers applied to every SSR response.
 * We deliberately do not set a strict CSP here because the app relies on
 * inline styles / hashed script bundles from Vite and third-party fonts;
 * a mis-configured CSP breaks the whole app. What we DO set are the
 * low-cost mitigations that reduce XSS/clickjacking/MIME-sniffing risk
 * without runtime coordination:
 *   - X-Content-Type-Options: nosniff
 *   - X-Frame-Options: SAMEORIGIN (defense-in-depth with frame-ancestors)
 *   - Referrer-Policy: strict-origin-when-cross-origin
 *   - Permissions-Policy: minimal allow-list
 *   - Strict-Transport-Security in production only
 */
const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const res = await next();
  const response = res.response;
  const isHtml = response.headers.get("content-type")?.includes("text/html");
  if (!isHtml) return res;

  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  if (!headers.has("X-Frame-Options")) headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") {
    headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, securityHeadersMiddleware],
}));
