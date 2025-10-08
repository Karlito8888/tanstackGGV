// Locations hooks refactored to use service layer pattern
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/query-keys'
import { handleMutationError } from '../lib/crud/error-handling'
import { locationService } from '../services/location.service'
import type { Location } from '../lib/database-types'

type LocationUpdate = Partial<
  Omit<Location, 'id' | 'created_at' | 'updated_at'>
>

// Location queries refactored to use service layer
export function useLocationsListWithFilters(filters?: {
  is_locked?: boolean
  block?: string
  lot?: string
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: queryKeys.locations.list(filters),
    queryFn: () => locationService.getLocationsList(filters),
    staleTime: 10 * 60 * 1000, // 10 minutes for location lists
  })
}

export function useLocationsByBlock(block: string) {
  return useQuery({
    queryKey: queryKeys.locations.byBlock(block),
    queryFn: () => locationService.getLocationsByBlock(block),
    enabled: !!block,
    staleTime: 10 * 60 * 1000, // 10 minutes for block locations
  })
}

export function useSearchLocations(searchQuery: string) {
  return useQuery({
    queryKey: queryKeys.locations.search(searchQuery),
    queryFn: () => locationService.searchLocations(searchQuery),
    enabled: !!searchQuery && searchQuery.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes for search results
  })
}

// Admin operations refactored to use service layer
export function useAdminUpdateLocation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...updateData
    }: LocationUpdate & { id: string }) => {
      return locationService.updateLocation(id, updateData)
    },
    onMutate: async ({ id, ...updateData }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.locations.lists() })

      // Snapshot previous state
      const previousData = queryClient.getQueryData(queryKeys.locations.lists())

      // Optimistically update the location
      queryClient.setQueryData(
        queryKeys.locations.lists(),
        (old: any = {}) => ({
          ...old,
          data: (old.data || []).map((location: Location) =>
            location.id === id
              ? {
                  ...location,
                  ...updateData,
                  updated_at: new Date().toISOString(),
                }
              : location,
          ),
        }),
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
