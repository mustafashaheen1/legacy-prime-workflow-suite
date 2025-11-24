import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
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
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
              ...options?.headers,
              'Content-Type': 'application/json',
            },
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            console.error('[tRPC] HTTP error:', response.status, response.statusText);
            const text = await response.clone().text();
            console.error('[tRPC] Response body:', text.substring(0, 500));
          } else {
            const text = await response.clone().text();
            console.log('[tRPC] Response OK, preview:', text.substring(0, 300));
          }
          
          return response;
        } catch (error) {
          console.error('[tRPC] Fetch error:', error);
          console.error('[tRPC] Base URL:', getBaseUrl());
          console.error('[tRPC] Full URL:', url);
          
          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              console.error('[tRPC] Request timed out after 30 seconds');
            }
            console.error('[tRPC] Error details:', {
              name: error.name,
              message: error.message,
              stack: error.stack?.substring(0, 200)
            });
          }
          
          throw error;
        }
      },
    }),
  ],
});
