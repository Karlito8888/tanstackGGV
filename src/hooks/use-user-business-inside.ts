// User Business Inside CRUD hooks with mobile-first optimizations
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { authStore } from '../lib/store'
import { queryKeys } from '../lib/query-keys'
import { createCRUDHooks } from '../lib/crud/create-crud-hooks'
import type { Row } from '../lib/database-types'

type UserBusinessInside = Row<'user_business_inside'>

// Get current user ID from auth store
const getCurrentUserId = () => authStore.state.user?.id

// Create CRUD hooks for user_business_inside table
const businessInsideHooks = createCRUDHooks<'user_business_inside'>({
  tableName: 'user_business_inside',
  queryKeys: {
    all: queryKeys.businessInside.all,
    lists: () => queryKeys.businessInside.lists(),
    list: (filters?: any) => queryKeys.businessInside.list(filters),
    details: () => queryKeys.businessInside.details(),
    detail: (id: string) => queryKeys.businessInside.detail(id),
  },
})

// Export basic CRUD hooks
export const useUserBusinessInsideList = businessInsideHooks.useList
export const useUserBusinessInsideById = businessInsideHooks.useById
export const useCreateUserBusinessInside = businessInsideHooks.useCreate
export const useUpdateUserBusinessInside = businessInsideHooks.useUpdate
export const useDeleteUserBusinessInside = businessInsideHooks.useDelete

// User Business Inside queries with mobile-first optimizations
export function useUserBusinessInside(id?: string) {
  return useQuery({
    queryKey: id
      ? queryKeys.businessInside.detail(id)
      : ['business-inside', 'detail', ''],
    queryFn: async () => {
      if (!id) return null

      const { data, error } = await supabase
        .from('user_business_inside')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes for individual business
  })
}

export function useUserBusinessInsideListWithCount() {
  return useQuery({
    queryKey: queryKeys.businessInside.lists(),
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('user_business_inside')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      return { data, count }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for business lists
  })
}

export function useUserBusinessInsideByProfile(profileId?: string) {
  return useQuery({
    queryKey: profileId
      ? queryKeys.businessInside.byProfile(profileId)
      : ['business-inside', 'profile', profileId],
    queryFn: async () => {
      if (!profileId) return []

      const { data, error } = await supabase
        .from('user_business_inside')
        .select('*')
        .eq('profile_id', profileId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Array<UserBusinessInside>
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000, // 5 minutes for profile businesses
  })
}

export function useCurrentUserBusinessInside() {
  const userId = getCurrentUserId()

  return useQuery({
    queryKey: userId
      ? queryKeys.businessInside.byProfile(userId)
      : ['business-inside', 'currentUser', userId],
    queryFn: async () => {
      if (!userId) return []

      const { data, error } = await supabase
        .from('user_business_inside')
        .select('*')
        .eq('profile_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Array<UserBusinessInside>
    },
    enabled: !!userId,
    staleTime: 3 * 60 * 1000, // 3 minutes for current user businesses
  })
}

export function useSearchUserBusinessInside(searchQuery: string) {
  return useQuery({
    queryKey: queryKeys.businessInside.search(searchQuery),
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return []

      const { data, error } = await supabase
        .from('user_business_inside')
        .select('*')
        .eq('is_active', true)
        .or(
          `business_name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`,
        )
        .order('created_at', { ascending: false })
        .limit(50) // Limit search results

      if (error) throw error
      return data as Array<UserBusinessInside>
    },
    enabled: !!searchQuery && searchQuery.length >= 2,
    staleTime: 3 * 60 * 1000, // 3 minutes for search results
  })
}

export function useUserBusinessInsideByType(businessType?: string) {
  return useQuery({
    queryKey: businessType
      ? queryKeys.businessInside.byType(businessType)
      : ['business-inside', 'type', ''],
    queryFn: async () => {
      if (!businessType) return []

      const { data, error } = await supabase
        .from('user_business_inside')
        .select('*')
        .eq('category_id', businessType)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Array<UserBusinessInside>
    },
    enabled: !!businessType,
    staleTime: 5 * 60 * 1000, // 5 minutes for type-based businesses
  })
}

// Specialized mutations for business inside operations
export function useToggleUserBusinessInsideStatus() {
  const { useUpdate } = businessInsideHooks
  const updateMutation = useUpdate()

  return {
    ...updateMutation,
    mutate: (variables: { id: string; is_active: boolean }) => {
      updateMutation.mutate({
        id: variables.id,
        is_active: variables.is_active,
      })
    },
  }
}

/**
 * Hook to get location assignment info for a business inside
 */
export function useBusinessInsideLocationAssignmentInfo(businessId: string) {
  return useQuery({
    queryKey: ['business-location-assignment', businessId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_location_assignment_info',
        {
          table_name: 'user_business_inside',
          record_id: businessId,
        },
      )

      if (error) throw error
      return data
    },
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000, // 5 minutes for location assignment info
  })
}

// Bulk operations for admin functionality
export function useBulkUpdateUserBusinessInside() {
  const { useBulkUpdate } = businessInsideHooks
  return useBulkUpdate()
}
