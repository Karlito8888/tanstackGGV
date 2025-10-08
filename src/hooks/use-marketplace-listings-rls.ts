// Additional utility hooks for marketplace listings with RLS compliance
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/query-keys'
import { handleMutationError } from '../lib/crud/error-handling'
import { MarketplaceService } from '../services/marketplace.service'
import type { Row } from '../lib/database-types'

type MarketplaceListing = Row<'marketplace_listings'>

const marketplaceService = new MarketplaceService()

/**
 * Hook to get current user's marketplace listings (all statuses)
 * RLS Compliant: Users can see their own listings regardless of status
 */
export function useMyMarketplaceListings() {
  return useQuery({
    queryKey: ['my-marketplace-listings'],
    queryFn: async () => {
      const user = await marketplaceService.getCurrentUser()
      if (!user) throw new Error('User not authenticated')

      return marketplaceService.getListingsByProfile(user.id)
    },
    enabled: true, // Will be handled by RLS if not authenticated
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to get public marketplace listings (active only, any status)
 * RLS Compliant: Only shows active listings to public
 */
export function usePublicMarketplaceListings(filters?: {
  category?: string
  listingType?: 'selling' | 'buying'
  priceMin?: number
  priceMax?: number
  search?: string
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: ['public-marketplace-listings', filters],
    queryFn: () =>
      marketplaceService.getListings({
        ...filters,
        active: true, // Ensure only active listings
      }),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

/**
 * Hook to check if user can manage a specific listing
 * RLS Compliant: Verifies ownership or admin status
 */
export function useCanManageListing(listingId?: string) {
  return useQuery({
    queryKey: ['can-manage-listing', listingId],
    queryFn: () => marketplaceService.canManageListing(listingId!),
    enabled: !!listingId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to safely create a marketplace listing with RLS validation
 */
export function useSafeCreateMarketplaceListing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      newData: Omit<MarketplaceListing, 'id' | 'created_at' | 'updated_at'>,
    ) => {
      const user = await marketplaceService.getCurrentUser()
      if (!user) throw new Error('User not authenticated')

      // Ensure profile_id matches authenticated user
      const listingData = {
        ...newData,
        profile_id: user.id,
      }

      return marketplaceService.createListing(listingData)
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['my-marketplace-listings'] })
      await queryClient.cancelQueries({
        queryKey: queryKeys.marketplaceListings.lists(),
      })

      const previousMyListings = queryClient.getQueryData<
        Array<MarketplaceListing>
      >(['my-marketplace-listings'])
      const previousListings = queryClient.getQueryData<{
        data: Array<MarketplaceListing>
        count?: number
      }>(queryKeys.marketplaceListings.list())

      // Optimistic update
      const optimisticItem: MarketplaceListing = {
        ...newData,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as MarketplaceListing

      queryClient.setQueryData(
        ['my-marketplace-listings'],
        (old: Array<MarketplaceListing> = []) => [...old, optimisticItem],
      )

      queryClient.setQueryData(
        queryKeys.marketplaceListings.list(),
        (
          old: { data: Array<MarketplaceListing>; count?: number } | undefined,
        ) => ({
          data: [...(old?.data || []), optimisticItem],
          count: (old?.count || 0) + 1,
        }),
      )

      return { previousMyListings, previousListings }
    },
    onError: (error, _variables, context) => {
      if (context?.previousMyListings) {
        queryClient.setQueryData(
          ['my-marketplace-listings'],
          context.previousMyListings,
        )
      }
      if (context?.previousListings) {
        queryClient.setQueryData(
          queryKeys.marketplaceListings.list(),
          context.previousListings,
        )
      }
      handleMutationError(error, 'create')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-marketplace-listings'] })
      queryClient.invalidateQueries({
        queryKey: queryKeys.marketplaceListings.lists(),
      })
    },
  })
}
