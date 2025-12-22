import { createTRPCReact } from "@trpc/react-query";
import { createTRPCProxyClient, httpLink, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";


export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  const rorkApi = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || process.env['rork'] || process.env['rork api'];

  if (rorkApi) {
    console.log('[tRPC] Using rork api variable:', rorkApi);
    return rorkApi;
  }

  if (typeof window !== 'undefined') {
    console.log('[tRPC] Using window.location.origin:', window.location.origin);
    return window.location.origin;
  }

  console.warn('[tRPC] rork api variable not set, using fallback');
  return 'http://localhost:8081';
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/trpc`,
      transformer: superjson,
      async fetch(url, options) {
        console.log('[tRPC] Fetching:', url);

        const requestInit = {
          ...options,
          headers: {
            ...options?.headers,
            'Content-Type': 'application/json',
          },
        };

        try {
          const response = await fetch(url, requestInit);

          console.log('[tRPC] Response status:', response.status);
          console.log('[tRPC] Response headers:', {
            contentType: response.headers.get('content-type'),
            contentLength: response.headers.get('content-length'),
          });

          // IMPORTANT: Clone the response before reading the body for logging
          // This fixes the "body stream already read" error
          if (!response.ok) {
            const clonedResponse = response.clone();
            try {
              const text = await clonedResponse.text();
              console.error('[tRPC] Error response body (first 500 chars):', text.substring(0, 500));

              if (text.includes('<!DOCTYPE') || text.includes('<html')) {
                throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}. This usually means the API endpoint is not found or there's a server error.`);
              }
            } catch (logError) {
              // Ignore errors from logging - the original response is still intact
              console.error('[tRPC] Could not read error body for logging');
            }
          }

          // Return the original response (not the clone) so tRPC can read it
          return response;
        } catch (error: any) {
          console.error('[tRPC] Fetch error:', error.message);
          throw error;
        }
      },

    }),
  ],
});

// Vanilla tRPC client for imperative calls (outside of React components)
export const vanillaClient = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [
    httpLink({
      url: `${getBaseUrl()}/trpc`,
      async fetch(url, options) {
        console.log('[tRPC Vanilla] Fetching:', url);

        const requestInit = {
          ...options,
          headers: {
            ...options?.headers,
            'Content-Type': 'application/json',
          },
        };

        try {
          const response = await fetch(url, requestInit);

          console.log('[tRPC Vanilla] Response status:', response.status);

          // Clone the response before reading for error logging
          if (!response.ok) {
            const clonedResponse = response.clone();
            try {
              const text = await clonedResponse.text();
              console.error('[tRPC Vanilla] Error response (first 500 chars):', text.substring(0, 500));

              if (text.includes('<!DOCTYPE') || text.includes('<html')) {
                throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}. API endpoint may not be found.`);
              }
            } catch (logError) {
              console.error('[tRPC Vanilla] Could not read error body');
            }
          }

          return response;
        } catch (error: any) {
          console.error('[tRPC Vanilla] Fetch error:', error.message);
          throw error;
        }
      },
    }),
  ],
});
