/**
 * Generic CRUD Hooks Factory
 *
 * This file creates a factory that generates standardized CRUD hooks
 * following TanStack Query best practices with optimistic updates.
 *
 * Features:
 * - Optimistic updates with rollback
 * - Proper cache invalidation
 * - Type-safe with Supabase database types
 * - RLS-aware error handling
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { handleMutationError } from './error-handling'
import type { UseQueryOptions } from '@tanstack/react-query'
import type { InsertRow, Row, TableName, UpdateRow } from '../database-types'

export interface CRUDHooksConfig<T extends TableName> {
  tableName: T
  queryKeys: {
    all: ReadonlyArray<unknown>
    lists: () => ReadonlyArray<unknown>
    list: (filters?: any) => ReadonlyArray<unknown>
    details: () => ReadonlyArray<unknown>
    detail: (id: string) => ReadonlyArray<unknown>
  }
}

export function createCRUDHooks<T extends TableName>(
  config: CRUDHooksConfig<T>,
) {
  const { tableName, queryKeys } = config

  /**
   * Hook for listing items with optional filters
   */
  function useList(
    filters?: Record<string, any>,
    options?: Omit<UseQueryOptions<Array<Row<T>>>, 'queryKey' | 'queryFn'>,
  ) {
    return useQuery({
      queryKey: queryKeys.list(filters),
      queryFn: async () => {
        let query = supabase.from(tableName).select('*')

        // Apply filters dynamically
        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              if (Array.isArray(value)) {
                query = query.in(key, value)
              } else if (typeof value === 'object' && value !== null) {
                // Handle range filters like { gte: 10, lte: 100 }
                if ('gte' in value) {
                  query = query.gte(key, value.gte)
                }
                if ('lte' in value) {
                  query = query.lte(key, value.lte)
                }
                if ('gt' in value) {
                  query = query.gt(key, value.gt)
                }
                if ('lt' in value) {
                  query = query.lt(key, value.lt)
                }
                if ('like' in value) {
                  query = query.like(key, value.like)
                }
                if ('ilike' in value) {
                  query = query.ilike(key, value.ilike)
                }
              } else {
                query = query.eq(key, value)
              }
            }
          })
        }

        const { data, error } = await query
        if (error) throw error
        return data as Array<Row<T>>
      },
      ...options,
    })
  }

  /**
   * Hook for fetching a single item by ID
   */
  function useById(
    id: string | undefined,
    options?: Omit<UseQueryOptions<Row<T>>, 'queryKey' | 'queryFn'>,
  ) {
    return useQuery({
      queryKey: queryKeys.detail(id || ''),
      queryFn: async () => {
        if (!id) throw new Error('ID is required')

        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error
        return data as Row<T>
      },
      enabled: !!id,
      ...options,
    })
  }

  /**
   * Hook for creating a new item with optimistic update
   */
  function useCreate() {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async (newData: InsertRow<T>) => {
        const { data, error } = await supabase
          .from(tableName)
          .insert(newData)
          .select()
          .single()

        if (error) throw error
        return data as Row<T>
      },
      onMutate: async (newData: InsertRow<T>) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries({ queryKey: queryKeys.lists() })

        // Snapshot previous state
        const previousData = queryClient.getQueryData<Array<Row<T>>>(
          queryKeys.lists(),
        )

        // Optimistically add the new item
        const optimisticItem: Row<T> = {
          ...newData,
          id: `temp-${Date.now()}`,
          created_at: new Date().toISOString(),
        } as Row<T>

        queryClient.setQueryData<Array<Row<T>>>(
          queryKeys.lists(),
          (old = []) => [...old, optimisticItem],
        )

        return { previousData }
      },
      onError: (error, _variables, context) => {
        // Rollback on error
        if (context?.previousData) {
          queryClient.setQueryData(queryKeys.lists(), context.previousData)
        }
        handleMutationError(error, 'create')
      },
      onSettled: () => {
        // Always refetch after error or success
        queryClient.invalidateQueries({ queryKey: queryKeys.lists() })
      },
      onSuccess: (data) => {
        // Update the detail cache with the real data
        queryClient.setQueryData(queryKeys.detail(String(data.id)), data)
      },
    })
  }

  /**
   * Hook for updating an existing item with optimistic update
   */
  function useUpdate() {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async ({
        id,
        ...updateData
      }: UpdateRow<T> & { id: string }) => {
        const { data, error } = await supabase
          .from(tableName)
          .update({ ...updateData, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single()

        if (error) throw error
        return data as Row<T>
      },
      onMutate: async (variables: UpdateRow<T> & { id: string }) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries({ queryKey: queryKeys.lists() })

        // Snapshot previous state
        const previousData = queryClient.getQueryData<Array<Row<T>>>(
          queryKeys.lists(),
        )

        // Optimistically update the item
        queryClient.setQueryData<Array<Row<T>>>(queryKeys.lists(), (old = []) =>
          old.map((item) =>
            (item as any).id === variables.id
              ? { ...item, ...variables, updated_at: new Date().toISOString() }
              : item,
          ),
        )

        return { previousData }
      },
      onError: (error, _variables, context) => {
        // Rollback on error
        if (context?.previousData) {
          queryClient.setQueryData(queryKeys.lists(), context.previousData)
        }
        handleMutationError(error, 'update')
      },
      onSettled: () => {
        // Always refetch after error or success
        queryClient.invalidateQueries({ queryKey: queryKeys.lists() })
      },
      onSuccess: (data) => {
        // Update the detail cache
        queryClient.setQueryData(queryKeys.detail(String(data.id)), data)
      },
    })
  }

  /**
   * Hook for deleting an item with optimistic update
   */
  function useDelete() {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from(tableName).delete().eq('id', id)
        if (error) throw error
        return id
      },
      onMutate: async (id: string) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries({ queryKey: queryKeys.lists() })

        // Snapshot previous state
        const previousData = queryClient.getQueryData<Array<Row<T>>>(
          queryKeys.lists(),
        )

        // Optimistically remove the item
        queryClient.setQueryData<Array<Row<T>>>(queryKeys.lists(), (old = []) =>
          old.filter((item) => (item as any).id !== id),
        )

        return { previousData }
      },
      onError: (error, _variables, context) => {
        // Rollback on error
        if (context?.previousData) {
          queryClient.setQueryData(queryKeys.lists(), context.previousData)
        }
        handleMutationError(error, 'delete')
      },
      onSettled: () => {
        // Always refetch after error or success
        queryClient.invalidateQueries({ queryKey: queryKeys.lists() })
      },
      onSuccess: (deletedId) => {
        // Remove from detail cache
        queryClient.removeQueries({
          queryKey: queryKeys.detail(String(deletedId)),
        })
      },
    })
  }

  /**
   * Hook for bulk operations (optional extension)
   */
  function useBulkUpdate() {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async (updates: Array<{ id: string } & UpdateRow<T>>) => {
        const promises = updates.map(({ id, ...updateData }) =>
          supabase
            .from(tableName)
            .update({ ...updateData, updated_at: new Date().toISOString() })
            .eq('id', id),
        )

        const results = await Promise.all(promises)
        const errors = results.filter((result) => result.error)

        if (errors.length > 0) {
          throw new Error(`Bulk update failed for ${errors.length} items`)
        }

        return updates
      },
      onMutate: async (updates) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries({ queryKey: queryKeys.lists() })

        // Snapshot previous state
        const previousData = queryClient.getQueryData<Array<Row<T>>>(
          queryKeys.lists(),
        )

        // Optimistically update
        queryClient.setQueryData<Array<Row<T>>>(
          queryKeys.lists(),
          (old = []) => {
            const updatedMap = new Map(updates.map((u) => [u.id, u]))
            return old.map((item) => {
              const update = updatedMap.get((item as any).id)
              return update
                ? { ...item, ...update, updated_at: new Date().toISOString() }
                : item
            })
          },
        )

        return { previousData }
      },
      onError: (error, _variables, context) => {
        // Rollback on error
        if (context?.previousData) {
          queryClient.setQueryData(queryKeys.lists(), context.previousData)
        }
        handleMutationError(error, 'update')
      },
      onSettled: () => {
        // Always refetch after error or success
        queryClient.invalidateQueries({ queryKey: queryKeys.lists() })
      },
    })
  }

  return {
    useList,
    useById,
    useCreate,
    useUpdate,
    useDelete,
    useBulkUpdate,
  }
}

/**
 * Type helper for creating CRUD hooks with proper typing
 */
export type CRUDHooks<T extends TableName> = ReturnType<
  typeof createCRUDHooks<T>
>
