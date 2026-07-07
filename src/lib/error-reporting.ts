/**
 * Error reporting utility.
 * Developed by Laugh Company
 *
 * Forwards uncaught errors to the runtime host bridge when available.
 */

type ErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type HostBridge = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: ErrorOptions,
  ) => void;
};

const HOST_BRIDGE_KEY = "__lovableEvents"; // runtime contract with the host platform — do not rename.

export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const bridge = (window as unknown as Record<string, HostBridge | undefined>)[HOST_BRIDGE_KEY];
  bridge?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
}
