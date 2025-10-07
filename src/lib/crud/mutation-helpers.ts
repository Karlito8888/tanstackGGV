/**
 * Mutation helpers for optimistic updates following TanStack Query patterns
 * Based on: https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates
 */

import type { QueryClient } from '@tanstack/react-query'

/**
 * Generic optimistic update helper for single item mutations
 */
export function createOptimisticUpdate<T>(
  queryClient: QueryClient,
  queryKey: ReadonlyArray<unknown>,
  updateFn: (oldData: T | undefined) => T,
) {
  return {
    onMutate: async (newData: Partial<T>) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey })

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<T>(queryKey)

      // Optimistically update to the new value
      queryClient.setQueryData<T>(queryKey, (old) =>
        updateFn(old ? { ...old, ...newData } : (newData as T)),
      )

      // Return a context object with the snapshotted value
      return { previousData }
    },

    onError: (err: any, _newData: Partial<T>, context: any) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData)
      }

      // Handle RLS (Row Level Security) errors specifically
      if (
        err?.code === '42501' ||
        err?.message?.includes('row-level security')
      ) {
        console.warn('RLS permission denied:', err.message)
      }
    },

    onSettled: () => {
      // Always refetch after error or success to ensure server state
      queryClient.invalidateQueries({ queryKey })
    },
  }
}

/**
 * Optimistic update helper for adding items to a list
 */
export function createOptimisticListAdd<T>(
  queryClient: QueryClient,
  listQueryKey: ReadonlyArray<unknown>,
  newItem: T,
) {
  return {
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: listQueryKey })

      const previousData = queryClient.getQueryData<Array<T>>(listQueryKey)

      queryClient.setQueryData<Array<T>>(listQueryKey, (old = []) => [
        ...old,
        newItem,
      ])

      return { previousData }
    },

    onError: (err: any, _variables: any, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(listQueryKey, context.previousData)
      }

      if (
        err?.code === '42501' ||
        err?.message?.includes('row-level security')
      ) {
        console.warn('RLS permission denied:', err.message)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listQueryKey })
    },
  }
}

/**
 * Optimistic update helper for updating items in a list
 */
export function createOptimisticListUpdate<T>(
  queryClient: QueryClient,
  listQueryKey: ReadonlyArray<unknown>,
  itemId: string | number,
  updateFn: (item: T) => T,
) {
  return {
    onMutate: async (updates: Partial<T>) => {
      await queryClient.cancelQueries({ queryKey: listQueryKey })

      const previousData = queryClient.getQueryData<Array<T>>(listQueryKey)

      queryClient.setQueryData<Array<T>>(listQueryKey, (old = []) =>
        old.map((item) => {
          const itemKey = typeof itemId === 'string' ? 'id' : itemId
          if ((item as any)[itemKey] === itemId) {
            return updateFn({ ...item, ...updates })
          }
          return item
        }),
      )

      return { previousData }
    },

    onError: (err: any, _variables: any, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(listQueryKey, context.previousData)
      }

      if (
        err?.code === '42501' ||
        err?.message?.includes('row-level security')
      ) {
        console.warn('RLS permission denied:', err.message)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listQueryKey })
    },
  }
}

/**
 * Optimistic update helper for removing items from a list
 */
export function createOptimisticListRemove<T>(
  queryClient: QueryClient,
  listQueryKey: ReadonlyArray<unknown>,
  itemId: string | number,
) {
  return {
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: listQueryKey })

      const previousData = queryClient.getQueryData<Array<T>>(listQueryKey)

      queryClient.setQueryData<Array<T>>(listQueryKey, (old = []) =>
        old.filter((item) => {
          const itemKey = typeof itemId === 'string' ? 'id' : itemId
          return (item as any)[itemKey] !== itemId
        }),
      )

      return { previousData }
    },

    onError: (err: any, _variables: any, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(listQueryKey, context.previousData)
      }

      if (
        err?.code === '42501' ||
        err?.message?.includes('row-level security')
      ) {
        console.warn('RLS permission denied:', err.message)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listQueryKey })
    },
  }
}
