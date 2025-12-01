import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";


export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    console.log('[tRPC] Using EXPO_PUBLIC_RORK_API_BASE_URL:', process.env.EXPO_PUBLIC_RORK_API_BASE_URL);
    return process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  }

  if (typeof window !== 'undefined') {
    console.log('[tRPC] Using window.location.origin:', window.location.origin);
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
          
          if (!response.ok) {
            const text = await response.text();
            console.error('[tRPC] Error response body (first 500 chars):', text.substring(0, 500));
            
            if (text.includes('<!DOCTYPE') || text.includes('<html')) {
              throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}. This usually means the API endpoint is not found or there's a server error.`);
            }
          }
          
          return response;
        } catch (error: any) {
          console.error('[tRPC] Fetch error:', error.message);
          throw error;
        }
      },

    }),
  ],
});
