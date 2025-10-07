// Additional utility hooks for marketplace listings with RLS compliance
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/query-keys'
import { handleMutationError } from '../lib/crud/error-handling'
import type { Row } from '../lib/database-types'

type MarketplaceListing = Row<'marketplace_listings'>

/**
 * Hook to get current user's marketplace listings (all statuses)
 * RLS Compliant: Users can see their own listings regardless of status
 */
export function useMyMarketplaceListings() {
  return useQuery({
    queryKey: ['my-marketplace-listings'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('marketplace_listings')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Array<MarketplaceListing>
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
    queryFn: async () => {
      let query = supabase.from('marketplace_listings').select(
        `
          *,
          profiles (
            id,
            username,
            full_name,
            avatar_url,
            profile_location_associations (
              locations (
                id,
                block,
                lot
              )
            )
          )
        `,
        { count: 'exact' },
      )

      // RLS will automatically filter to is_active = true for public viewing
      // Apply additional filters
      if (filters?.category) {
        query = query.eq('category', filters.category)
      }
      if (filters?.listingType) {
        query = query.eq('listing_type', filters.listingType)
      }
      if (filters?.priceMin !== undefined) {
        query = query.gte('price', filters.priceMin)
      }
      if (filters?.priceMax !== undefined) {
        query = query.lte('price', filters.priceMax)
      }
      if (filters?.search) {
        query = query.or(
          `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,category.ilike.%${filters.search}%`,
        )
      }

      query = query
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })

      if (filters?.limit) {
        query = query.limit(filters.limit)
      }
      if (filters?.offset) {
        query = query.range(
          filters.offset,
          filters.offset + (filters.limit || 10) - 1,
        )
      }

      const { data, error, count } = await query
      if (error) throw error

      return { data, count }
    },
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
    queryFn: async () => {
      if (!listingId) return false

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return false

      // Check if user owns the listing or is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (profile?.is_admin) return true

      const { data: listing } = await supabase
        .from('marketplace_listings')
        .select('profile_id')
        .eq('id', listingId)
        .single()

      return listing?.profile_id === user.id
    },
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
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Ensure profile_id matches authenticated user
      const listingData = {
        ...newData,
        profile_id: user.id,
      }

      const { data, error } = await supabase
        .from('marketplace_listings')
        .insert(listingData)
        .select()
        .single()

      if (error) throw error
      return data as MarketplaceListing
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
