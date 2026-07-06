import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { reportError } from "../../src/lib/error-reporting";

type CaptureExceptionCall = [unknown, Record<string, unknown> | undefined, Record<string, unknown> | undefined];

describe("reportError", () => {
  const captureException = vi.fn<(...args: CaptureExceptionCall) => void>();
  const originalPathname = window.location.pathname;

  beforeEach(() => {
    captureException.mockReset();
    (window as unknown as Record<string, unknown>).__lovableEvents = { captureException };
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__lovableEvents;
  });

  it("forwards the error and context to the host bridge", () => {
    const boom = new Error("boom");
    reportError(boom, { boundary: "unit_test" });

    expect(captureException).toHaveBeenCalledTimes(1);
    const [err, ctx, opts] = captureException.mock.calls[0];
    expect(err).toBe(boom);
    expect(ctx).toMatchObject({
      source: "react_error_boundary",
      boundary: "unit_test",
      route: originalPathname,
    });
    expect(opts).toMatchObject({
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    });
  });

  it("is a no-op when the host bridge is missing", () => {
    delete (window as unknown as Record<string, unknown>).__lovableEvents;
    expect(() => reportError(new Error("silent"))).not.toThrow();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("does not export a legacy reportLovableError symbol", async () => {
    const mod = await import("../../src/lib/error-reporting");
    expect(mod).toHaveProperty("reportError");
    expect((mod as Record<string, unknown>).reportLovableError).toBeUndefined();
  });
});
