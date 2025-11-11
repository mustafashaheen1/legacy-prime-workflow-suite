import { createTRPCReact } from "@trpc/react-query";
import { httpLink, TRPCClientError } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";


export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  }

  throw new Error(
    "No base url found, please set EXPO_PUBLIC_RORK_API_BASE_URL"
  );
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      async fetch(url, options) {
        try {
          const response = await fetch(url, {
            ...options,
            headers: {
              ...options?.headers,
              'Content-Type': 'application/json',
            },
          });
          
          if (!response.ok) {
            console.error('[tRPC] HTTP error:', response.status, response.statusText);
          }
          
          return response;
        } catch (error) {
          console.error('[tRPC] Network error:', error);
          throw new Error('No se pudo conectar al servidor. Por favor verifica tu conexión a internet.');
        }
      },
    }),
  ],
});
