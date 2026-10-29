import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: (failureCount, error) => {
          const status = (error as { status?: number })?.status;
          if (status === 401 || status === 403 || status === 404) return false;
          return failureCount < 1;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        networkMode: "online",
      },
      mutations: {
        retry: 0,
        networkMode: "online",
      },
    },
  });
}
