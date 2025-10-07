// TanStack Query configuration optimized for mobile PWA
import { QueryClient } from '@tanstack/react-query'
import { handleQueryError } from './crud/error-handling'

/**
 * QueryClient configuration following TanStack best practices
 *
 * Features:
 * - Mobile-first approach with appropriate staleTime
 * - Intelligent retry logic (no retry on 4xx errors)
 * - Offline/online support
 * - Global error tracking using TanStack Query's cache events
 * - Optimized for PWA usage
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Mobile-first: stale data is better than no data
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (client errors)
        const status = (error as any)?.status
        if (typeof status === 'number' && status >= 400 && status < 500) {
          return false
        }
        // Retry up to 3 times for network errors
        return failureCount < 3
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false, // Mobile: don't refocus often
      refetchOnReconnect: true, // Important for offline/online transitions
      networkMode: 'online',
    },
    mutations: {
      retry: 1, // Mutations should be more conservative
      networkMode: 'online',
      // Note: Mutation errors should be handled individually in useMutation hooks
      // This allows for specific error handling per operation type
    },
  },
})

/**
 * Set up global error tracking using TanStack Query's cache events
 * This follows TanStack Query best practices for centralized error handling
 */

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.action.type === 'error') {
    // Handle query errors globally using TanStack Query's event system
    const error = event.query.state.error
    if (error) {
      handleQueryError(error)
    }
  }
})

queryClient.getMutationCache().subscribe((event) => {
  if (event.type === 'updated' && event.action.type === 'error') {
    // Log mutation errors globally (individual mutations should handle their own UI notifications)
    console.error('Global mutation error:', event.mutation.state.error)
  }
})
