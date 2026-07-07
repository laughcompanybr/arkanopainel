/**
 * Utilities to safely swallow AbortError rejections that occur when the
 * user navigates away, closes a dialog, or a component unmounts before
 * an in-flight request resolves.
 */

export function isAbortError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err !== "object") return false;
  const e = err as { name?: unknown; code?: unknown; message?: unknown };
  if (e.name === "AbortError" || e.name === "CanceledError") return true;
  if (e.code === 20 || e.code === "ERR_CANCELED") return true;
  if (typeof e.message === "string" && /abort|cancel/i.test(e.message)) return true;
  return false;
}

/**
 * Wrap a promise so that AbortError rejections resolve to `undefined`
 * instead of surfacing as unhandled promise rejections. Any other
 * error is re-thrown normally.
 */
export async function ignoreAbort<T>(p: Promise<T>): Promise<T | undefined> {
  try {
    return await p;
  } catch (err) {
    if (isAbortError(err)) return undefined;
    throw err;
  }
}

/**
 * TanStack Query global error handler helper — returns true when
 * the error should be treated as user-cancelled and logged silently.
 */
export function shouldSilenceQueryError(err: unknown): boolean {
  return isAbortError(err);
}
