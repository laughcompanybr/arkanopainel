import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { shouldSilenceQueryError } from "./lib/abort-safe";

export const getRouter = () => {
  const queryClient = new QueryClient({
    // Swallow AbortError from cancelled queries/mutations when a user
    // closes a dialog or navigates away — those are expected, not bugs.
    queryCache: new QueryCache({
      onError: (error) => {
        if (shouldSilenceQueryError(error)) return;
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        if (shouldSilenceQueryError(error)) return;
      },
    }),
    defaultOptions: {
      queries: {
        // Smart cache: keep data fresh for 60s, GC after 10 minutes,
        // avoid noisy background refetches while still catching real changes.
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: (failureCount, error) => {
          if (shouldSilenceQueryError(error)) return false;
          return failureCount < 1;
        },
      },
      mutations: { retry: 0 },
    },
  });


  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPreload: "intent",
  });

  return router;
};
