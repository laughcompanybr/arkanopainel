/**
 * Hook wrappers around TanStack Query that treat AbortError (from route
 * navigation, dialog close, unmount) as a benign resolved-empty state
 * instead of a rejected promise. Global QueryCache/MutationCache handlers
 * already silence AbortError reporting; these hooks additionally coerce
 * `throwOnError`/retry behavior so component-level try/catch and error
 * boundaries never see AbortError bubbling from navigation.
 */
import {
  useMutation,
  useQuery,
  type DefaultError,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { isAbortError } from "./abort-safe";

export function useAbortSafeQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
>(
  options: UseQueryOptions<TQueryFnData, TError, TData>,
): UseQueryResult<TData, TError> {
  return useQuery({
    ...options,
    throwOnError: (err) => {
      if (isAbortError(err)) return false;
      const orig = options.throwOnError;
      if (typeof orig === "function") return (orig as (e: unknown) => boolean)(err);
      return Boolean(orig);
    },
    retry: (failureCount, err) => {
      if (isAbortError(err)) return false;
      const orig = options.retry;
      if (typeof orig === "function") return (orig as (n: number, e: unknown) => boolean)(failureCount, err);
      if (typeof orig === "number") return failureCount < orig;
      return failureCount < 1;
    },
  });
}

export function useAbortSafeMutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
): UseMutationResult<TData, TError, TVariables, TContext> {
  return useMutation({
    ...options,
    throwOnError: (err) => {
      if (isAbortError(err)) return false;
      const orig = options.throwOnError;
      if (typeof orig === "function") return (orig as (e: unknown) => boolean)(err);
      return Boolean(orig);
    },
    onError: (err, vars, ctx) => {
      if (isAbortError(err)) return;
      // @ts-expect-error — TS overload wants a non-null context; forward as-is
      options.onError?.(err, vars, ctx);
    },
  });
}
