// Marketplace Listings CRUD hooks with mobile-first optimizations
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/query-keys'
import { createCRUDHooks } from '../lib/crud/create-crud-hooks'
import { handleMutationError } from '../lib/crud/error-handling'
import type { Row } from '../lib/database-types'

type MarketplaceListing = Row<'marketplace_listings'>

// Create base CRUD hooks for marketplace listings
const marketplaceHooks = createCRUDHooks<'marketplace_listings'>({
  tableName: 'marketplace_listings',
  queryKeys: {
    all: queryKeys.marketplaceListings.all,
    lists: queryKeys.marketplaceListings.lists,
    list: queryKeys.marketplaceListings.list,
    details: queryKeys.marketplaceListings.details,
    detail: queryKeys.marketplaceListings.detail,
  },
})

// Export the basic CRUD hooks from the factory
export const useMarketplaceListingList = marketplaceHooks.useList
export const useMarketplaceListingById = marketplaceHooks.useById
export const useMarketplaceListingCreate = marketplaceHooks.useCreate
export const useMarketplaceListingUpdate = marketplaceHooks.useUpdate
export const useMarketplaceListingDelete = marketplaceHooks.useDelete

// Marketplace queries with mobile-first optimizations
export function useMarketplaceListing(id?: string) {
  return useQuery({
    queryKey: queryKeys.marketplaceListings.detail(id || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select(
          `
          *,
          profiles (
            id,
            username,
            full_name,
            avatar_url,
            phone_number,
            viber_number,
            whatsapp_number,
            messenger_url,
            profile_location_associations (
              locations (
                id,
                block,
                lot,
                coordinates
              )
            )
          )
        `,
        )
        .eq('id', id || '')
        .single()

      if (error) throw error
      return data as MarketplaceListing & {
        profiles: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
          phone_number: string | null
          viber_number: string | null
          whatsapp_number: string | null
          messenger_url: string | null
          profile_location_associations: Array<{
            locations: {
              id: string
              block: string | null
              lot: string | null
              coordinates: any
            } | null
          }>
        }
      }
    },
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

      // RLS Compliance: Always ensure we can see the data
      // If no specific profile filter, ensure we only request active listings
      // RLS will automatically filter: (is_active = true) OR (auth.uid() = profile_id)
      if (!filters?.profileId) {
        // For public listings, we rely on RLS to show only active listings
        // and user's own listings regardless of status
      }

      // Apply filters
      if (filters?.profileId) {
        query = query.eq('profile_id', filters.profileId)
      }
      if (filters?.category) {
        query = query.eq('category', filters.category)
      }
      if (filters?.listingType) {
        query = query.eq('listing_type', filters.listingType)
      }
      // Note: status filter will only work for user's own listings due to RLS
      // For public listings, RLS restricts to is_active = true only
      if (filters?.status) {
        query = query.eq('status', filters.status)
      }
      if (filters?.featured !== undefined) {
        query = query.eq('is_featured', filters.featured)
      }
      if (filters?.active !== undefined) {
        query = query.eq('is_active', filters.active)
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

      // Order by created_at desc, featured first
      query = query
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })

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

      const { data, error, count } = await query
      if (error) throw error

      return { data, count }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for listings list
  })
}

export function useMarketplaceListingsByProfile(profileId?: string) {
  return useQuery({
    queryKey: queryKeys.marketplaceListings.byProfile(profileId || ''),
    queryFn: async () => {
      if (!profileId) return []

      // RLS Compliance: Users can only see their own listings
      // If requesting someone else's listings, only show active ones
      const { data: currentUser } = await supabase.auth.getUser()
      const isCurrentUser = currentUser.user?.id === profileId

      let query = supabase
        .from('marketplace_listings')
        .select('*')
        .eq('profile_id', profileId)

      // If not current user, only show active listings (RLS will enforce this)
      if (!isCurrentUser) {
        query = query.eq('is_active', true)
      }

      query = query.order('created_at', { ascending: false })

      const { data, error } = await query
      if (error) throw error
      return data as Array<MarketplaceListing>
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000, // 5 minutes for profile listings
  })
}

export function useFeaturedMarketplaceListings() {
  return useQuery({
    queryKey: queryKeys.marketplaceListings.featured(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select(
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
        )
        .eq('is_featured', true)
        .eq('is_active', true)
        // RLS Compliance: Remove status filter since RLS only allows is_active = true for public viewing
        // The available status will be filtered client-side if needed, or RLS policy should be updated
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error

      // Filter client-side for available status since RLS doesn't support status filtering for public
      const filteredData = data.filter(
        (listing) => listing.status === 'available',
      )

      return filteredData as Array<
        MarketplaceListing & {
          profiles: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
            profile_location_associations: Array<{
              locations: {
                id: string
                block: string | null
                lot: string | null
              } | null
            }>
          }
        }
      >
    },
    staleTime: 10 * 60 * 1000, // 10 minutes for featured listings
  })
}

export function useActiveMarketplaceListings() {
  return useQuery({
    queryKey: queryKeys.marketplaceListings.active(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select(
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
        )
        .eq('is_active', true)
        // RLS Compliance: Remove status filter since RLS only allows is_active = true for public viewing
        // The available status will be filtered client-side if needed
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error

      // Filter client-side for available status since RLS doesn't support status filtering for public
      const filteredData = data.filter(
        (listing) => listing.status === 'available',
      )

      return filteredData as Array<
        MarketplaceListing & {
          profiles: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
            profile_location_associations: Array<{
              locations: {
                id: string
                block: string | null
                lot: string | null
              } | null
            }>
          }
        }
      >
    },
    staleTime: 3 * 60 * 1000, // 3 minutes for active listings
  })
}

// Specialized mutations for marketplace operations
export function useCreateMarketplaceListing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      newData: Omit<MarketplaceListing, 'id' | 'created_at' | 'updated_at'>,
    ) => {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .insert(newData)
        .select()
        .single()

      if (error) throw error
      return data as MarketplaceListing
    },
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
    mutationFn: async ({
      id,
      status,
    }: {
      id: string
      status: 'available' | 'pending' | 'sold' | 'expired'
    }) => {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as MarketplaceListing
    },
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
    mutationFn: async ({
      id,
      is_featured,
    }: {
      id: string
      is_featured: boolean
    }) => {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .update({
          is_featured,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as MarketplaceListing
    },
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
