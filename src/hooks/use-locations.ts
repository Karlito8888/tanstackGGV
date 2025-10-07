// Locations CRUD hooks with mobile-first optimizations and geospatial queries
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/query-keys'
import { createCRUDHooks } from '../lib/crud/create-crud-hooks'
import { handleMutationError } from '../lib/crud/error-handling'
import type { Database, TableName } from '../lib/database-types'

type Location = Database['locations']
type LocationUpdate = Partial<
  Omit<Location, 'id' | 'created_at' | 'updated_at'>
>

// Create base CRUD hooks for locations
const locationCRUD = createCRUDHooks<TableName>({
  tableName: 'locations',
  queryKeys: {
    all: queryKeys.locations.all,
    lists: queryKeys.locations.lists,
    list: queryKeys.locations.list,
    details: queryKeys.locations.details,
    detail: queryKeys.locations.detail,
  },
})

// Export basic CRUD hooks from the factory
export const useLocationsList = locationCRUD.useList
export const useLocation = locationCRUD.useById
export const useCreateLocation = locationCRUD.useCreate
export const useUpdateLocation = locationCRUD.useUpdate
export const useDeleteLocation = locationCRUD.useDelete

// Location queries with mobile-first optimizations
export function useLocationsListWithFilters(filters?: {
  is_locked?: boolean
  block?: string
  lot?: string
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: queryKeys.locations.list(filters),
    queryFn: async () => {
      let query = supabase.from('locations').select('*', { count: 'exact' })

      // Apply filters
      if (filters?.is_locked !== undefined) {
        query = query.eq('is_locked', filters.is_locked)
      }
      if (filters?.block) {
        query = query.eq('block', filters.block)
      }
      if (filters?.lot) {
        query = query.eq('lot', filters.lot)
      }

      // Apply pagination
      if (filters?.limit) {
        query = query.limit(filters.limit)
      }
      if (filters?.offset) {
        query = query.range(
          filters.offset,
          filters.offset + (filters.limit || 10) - 1,
        )
      }

      // Order by block, then lot
      query = query
        .order('block', { ascending: true })
        .order('lot', { ascending: true })

      const { data, error, count } = await query
      if (error) throw error

      return { data: data as Array<Location>, count }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes for location lists
  })
}

export function useLocationsByBlock(block: string) {
  return useQuery({
    queryKey: queryKeys.locations.byBlock(block),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('block', block)
        .order('lot', { ascending: true })

      if (error) throw error
      return data as Array<Location>
    },
    enabled: !!block,
    staleTime: 10 * 60 * 1000, // 10 minutes for block locations
  })
}

export function useSearchLocations(searchQuery: string) {
  return useQuery({
    queryKey: queryKeys.locations.search(searchQuery),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .or(`block.ilike.%${searchQuery}%,lot.ilike.%${searchQuery}%`)
        .order('block', { ascending: true })
        .order('lot', { ascending: true })
        .limit(50) // Limit search results

      if (error) throw error
      return data as Array<Location>
    },
    enabled: !!searchQuery && searchQuery.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes for search results
  })
}

// Admin-only hooks (same as regular ones but with admin-specific error handling)
export function useAdminUpdateLocation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...updateData
    }: LocationUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('locations')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Location
    },
    onMutate: async ({ id, ...updateData }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.locations.lists() })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<Array<Location>>(
        queryKeys.locations.lists(),
      )

      // Optimistically update the location
      queryClient.setQueryData<Array<Location>>(
        queryKeys.locations.lists(),
        (old = []) =>
          old.map((location) =>
            location.id === id
              ? {
                  ...location,
                  ...updateData,
                  updated_at: new Date().toISOString(),
                }
              : location,
          ),
      )

      // Also update detail cache if exists
      const detailQueryKey = queryKeys.locations.detail(id)
      const previousDetail = queryClient.getQueryData<Location>(detailQueryKey)
      if (previousDetail) {
        queryClient.setQueryData(detailQueryKey, {
          ...previousDetail,
          ...updateData,
          updated_at: new Date().toISOString(),
        })
      }

      return { previousData, previousDetail }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.locations.lists(),
          context.previousData,
        )
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(
          queryKeys.locations.detail(variables.id),
          context.previousDetail,
        )
      }
      handleMutationError(error, 'update')
    },
    onSettled: (_data, _error, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.locations.lists() })
      queryClient.invalidateQueries({
        queryKey: queryKeys.locations.detail(variables.id),
      })
    },
  })
}
