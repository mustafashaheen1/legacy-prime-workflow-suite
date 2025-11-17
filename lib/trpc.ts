import { createTRPCReact } from "@trpc/react-query";
import { httpLink, TRPCClientError } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";


export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  console.warn('[tRPC] EXPO_PUBLIC_RORK_API_BASE_URL not set, using fallback');
  return 'http://localhost:8081';
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      async fetch(url, options) {
        try {
          console.log('[tRPC] Fetching:', url);
          console.log('[tRPC] Base URL:', getBaseUrl());
          
          const response = await fetch(url, {
            ...options,
            headers: {
              ...options?.headers,
              'Content-Type': 'application/json',
            },
          });
          
          if (!response.ok) {
            const clonedResponse = response.clone();
            const text = await clonedResponse.text();
            console.error('[tRPC] HTTP error:', response.status, response.statusText, text);
          }
          
          return response;
        } catch (error) {
          console.error('[tRPC] Network error:', error);
          console.error('[tRPC] Base URL:', getBaseUrl());
          throw error;
        }
      },
    }),
  ],
});
