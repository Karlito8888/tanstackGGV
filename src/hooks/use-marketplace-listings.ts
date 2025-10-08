// Marketplace Listings CRUD hooks with mobile-first optimizations
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/query-keys'
import { handleMutationError } from '../lib/crud/error-handling'
import { MarketplaceService } from '../services/marketplace.service'
import type { Row } from '../lib/database-types'

type MarketplaceListing = Row<'marketplace_listings'>

const marketplaceService = new MarketplaceService()

// Create base CRUD hooks for marketplace listings using MarketplaceService
export const useMarketplaceListingList = (filters?: any) => {
  return useQuery({
    queryKey: queryKeys.marketplaceListings.list(filters),
    queryFn: () => marketplaceService.getListings(filters),
  })
}

export const useMarketplaceListingById = (id?: string) => {
  return useQuery({
    queryKey: queryKeys.marketplaceListings.detail(id || ''),
    queryFn: () => marketplaceService.getListing(id!),
    enabled: !!id,
  })
}

export const useMarketplaceListingCreate = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: any) => marketplaceService.createListing(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.marketplaceListings.lists(),
      })
      queryClient.setQueryData(
        queryKeys.marketplaceListings.detail(data.id),
        data,
      )
    },
    onError: (error) => handleMutationError(error, 'create'),
  })
}

export const useMarketplaceListingUpdate = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...updates }: any) =>
      marketplaceService.updateListing(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.marketplaceListings.lists(),
      })
    },
    onError: (error) => handleMutationError(error, 'update'),
  })
}

export const useMarketplaceListingDelete = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => marketplaceService.deleteListing(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.marketplaceListings.lists(),
      })
    },
    onError: (error) => handleMutationError(error, 'delete'),
  })
}

// Marketplace queries with mobile-first optimizations
export function useMarketplaceListing(id?: string) {
  return useQuery({
    queryKey: queryKeys.marketplaceListings.detail(id || ''),
    queryFn: () => marketplaceService.getListing(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes for listing details
  })
}

export function useMarketplaceListingsList(filters?: {
  profileId?: string
  category?: string
  listingType?: 'selling' | 'buying'
  status?: 'available' | 'pending' | 'sold' | 'expired'
  featured?: boolean
  active?: boolean
  priceMin?: number
  priceMax?: number
  search?: string
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: queryKeys.marketplaceListings.list(filters),
    queryFn: () => marketplaceService.getListings(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes for listings list
  })
}

export function useMarketplaceListingsByProfile(profileId?: string) {
  return useQuery({
    queryKey: queryKeys.marketplaceListings.byProfile(profileId || ''),
    queryFn: () => marketplaceService.getListingsByProfile(profileId!),
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000, // 5 minutes for profile listings
  })
}

export function useFeaturedMarketplaceListings() {
  return useQuery({
    queryKey: queryKeys.marketplaceListings.featured(),
    queryFn: () => marketplaceService.getFeaturedListings(),
    staleTime: 10 * 60 * 1000, // 10 minutes for featured listings
  })
}

export function useActiveMarketplaceListings() {
  return useQuery({
    queryKey: queryKeys.marketplaceListings.active(),
    queryFn: () => marketplaceService.getActiveListings(),
    staleTime: 3 * 60 * 1000, // 3 minutes for active listings
  })
}

// Specialized mutations for marketplace operations
export function useCreateMarketplaceListing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (
      newData: Omit<MarketplaceListing, 'id' | 'created_at' | 'updated_at'>,
    ) => marketplaceService.createListing(newData),
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.marketplaceListings.lists(),
      })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<{
        data: Array<MarketplaceListing>
        count?: number
      }>(queryKeys.marketplaceListings.list())

      // Optimistically add the new item
      const optimisticItem: MarketplaceListing = {
        ...newData,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as MarketplaceListing

      queryClient.setQueryData(
        queryKeys.marketplaceListings.list(),
        (
          old: { data: Array<MarketplaceListing>; count?: number } | undefined,
        ) => ({
          data: [...(old?.data || []), optimisticItem],
          count: (old?.count || 0) + 1,
        }),
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.marketplaceListings.list(),
          context.previousData,
        )
      }
      handleMutationError(error, 'create')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: queryKeys.marketplaceListings.lists(),
      })
    },
    onSuccess: (data) => {
      // Update the detail cache
      queryClient.setQueryData(
        queryKeys.marketplaceListings.detail(data.id),
        data,
      )

      // Invalidate profile listings cache
      if (data.profile_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.marketplaceListings.byProfile(data.profile_id),
        })
      }
    },
  })
}

export function useUpdateMarketplaceListingStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string
      status: 'available' | 'pending' | 'sold' | 'expired'
    }) => marketplaceService.updateListingStatus(id, status),
    onMutate: async ({ id, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.marketplaceListings.lists(),
      })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<{
        data: Array<MarketplaceListing>
        count?: number
      }>(queryKeys.marketplaceListings.list())

      // Optimistically update the item
      queryClient.setQueryData(
        queryKeys.marketplaceListings.list(),
        (
          old: { data: Array<MarketplaceListing>; count?: number } | undefined,
        ) => ({
          data:
            old?.data.map((item) =>
              item.id === id
                ? { ...item, status, updated_at: new Date().toISOString() }
                : item,
            ) || [],
          count: old?.count,
        }),
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.marketplaceListings.list(),
          context.previousData,
        )
      }
      handleMutationError(error, 'update')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: queryKeys.marketplaceListings.lists(),
      })
    },
    onSuccess: (data) => {
      // Update the detail cache
      queryClient.setQueryData(
        queryKeys.marketplaceListings.detail(data.id),
        data,
      )
    },
  })
}

export function useToggleMarketplaceListingFeatured() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, is_featured }: { id: string; is_featured: boolean }) =>
      marketplaceService.toggleFeatured(id, is_featured),
    onMutate: async ({ id, is_featured }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.marketplaceListings.lists(),
      })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<{
        data: Array<MarketplaceListing>
        count?: number
      }>(queryKeys.marketplaceListings.list())

      // Optimistically update the item
      queryClient.setQueryData(
        queryKeys.marketplaceListings.list(),
        (
          old: { data: Array<MarketplaceListing>; count?: number } | undefined,
        ) => ({
          data:
            old?.data.map((item) =>
              item.id === id
                ? { ...item, is_featured, updated_at: new Date().toISOString() }
                : item,
            ) || [],
          count: old?.count,
        }),
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.marketplaceListings.list(),
          context.previousData,
        )
      }
      handleMutationError(error, 'update')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: queryKeys.marketplaceListings.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.marketplaceListings.featured(),
      })
    },
    onSuccess: (data) => {
      // Update the detail cache
      queryClient.setQueryData(
        queryKeys.marketplaceListings.detail(data.id),
        data,
      )
    },
  })
}
