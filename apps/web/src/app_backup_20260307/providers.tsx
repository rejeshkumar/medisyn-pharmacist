'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 5 * 60 * 1000,       // data stays fresh for 5 minutes
            gcTime: 10 * 60 * 1000,          // keep unused data in cache for 10 minutes
            refetchOnWindowFocus: false,      // don't refetch when switching browser tabs
            refetchOnReconnect: false,        // don't refetch on network reconnect
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { borderRadius: '8px', fontSize: '14px' },
          success: { iconTheme: { primary: '#2D7D46', secondary: '#fff' } },
        }}
      />
    </QueryClientProvider>
  );
}
