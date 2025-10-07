// User Business Outside CRUD hooks with mobile-first optimizations
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { authStore } from '../lib/store'
import { queryKeys } from '../lib/query-keys'
import { createCRUDHooks } from '../lib/crud/create-crud-hooks'
import type { Row } from '../lib/database-types'

type UserBusinessOutside = Row<'user_business_outside'>

// Get current user ID from auth store
const getCurrentUserId = () => authStore.state.user?.id

// Create CRUD hooks using the factory
const businessOutsideHooks = createCRUDHooks<'user_business_outside'>({
  tableName: 'user_business_outside',
  queryKeys: {
    all: queryKeys.businessOutside.all,
    lists: () => queryKeys.businessOutside.lists(),
    list: (filters) => queryKeys.businessOutside.list(filters),
    details: () => queryKeys.businessOutside.details(),
    detail: (id) => queryKeys.businessOutside.detail(id),
  },
})

// Export basic CRUD hooks
export const useUserBusinessOutsideList = businessOutsideHooks.useList
export const useUserBusinessOutsideById = businessOutsideHooks.useById
export const useCreateUserBusinessOutside = businessOutsideHooks.useCreate
export const useUpdateUserBusinessOutside = businessOutsideHooks.useUpdate
export const useDeleteUserBusinessOutside = businessOutsideHooks.useDelete

// Specialized hooks for User Business Outside

export function useUserBusinessOutside(id?: string) {
  return useQuery({
    queryKey: queryKeys.businessOutside.detail(id || ''),
    queryFn: async () => {
      if (!id) return null

      const { data, error } = await supabase
        .from('user_business_outside')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data as UserBusinessOutside
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes for individual business
  })
}

export function useUserBusinessOutsideByProfile(profileId?: string) {
  return useQuery({
    queryKey: queryKeys.businessOutside.byProfile(profileId || ''),
    queryFn: async () => {
      if (!profileId) return []

      const { data, error } = await supabase
        .from('user_business_outside')
        .select('*')
        .eq('profile_id', profileId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Array<UserBusinessOutside>
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000, // 5 minutes for profile businesses
  })
}

export function useCurrentUserBusinessOutside() {
  const userId = getCurrentUserId()

  return useQuery({
    queryKey: queryKeys.businessOutside.byProfile(userId || ''),
    queryFn: async () => {
      if (!userId) return []

      const { data, error } = await supabase
        .from('user_business_outside')
        .select('*')
        .eq('profile_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Array<UserBusinessOutside>
    },
    enabled: !!userId,
    staleTime: 3 * 60 * 1000, // 3 minutes for current user businesses
  })
}

export function useSearchUserBusinessOutside(searchQuery: string) {
  return useQuery({
    queryKey: queryKeys.businessOutside.search(searchQuery),
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return []

      const { data, error } = await supabase
        .from('user_business_outside')
        .select('*')
        .eq('is_active', true)
        .or(
          `business_name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`,
        )
        .order('created_at', { ascending: false })
        .limit(50) // Limit search results

      if (error) throw error
      return data as Array<UserBusinessOutside>
    },
    enabled: !!searchQuery && searchQuery.length >= 2,
    staleTime: 3 * 60 * 1000, // 3 minutes for search results
  })
}

export function useUserBusinessOutsideByType(businessType?: string) {
  return useQuery({
    queryKey: [...queryKeys.businessOutside.all, 'type', businessType],
    queryFn: async () => {
      if (!businessType) return []

      const { data, error } = await supabase
        .from('user_business_outside')
        .select('*')
        .eq('category_id', businessType)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Array<UserBusinessOutside>
    },
    enabled: !!businessType,
    staleTime: 5 * 60 * 1000, // 5 minutes for type-based businesses
  })
}

// Featured businesses for mobile home screen
export function useFeaturedUserBusinessOutside(limit = 10) {
  return useQuery({
    queryKey: [...queryKeys.businessOutside.featured(), limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_business_outside')
        .select('*')
        .eq('is_active', true)
        .eq('is_featured', true)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data as Array<UserBusinessOutside>
    },
    staleTime: 15 * 60 * 1000, // 15 minutes for featured businesses
  })
}

// Specialized mutations that extend the basic CRUD hooks
export function useToggleUserBusinessOutsideStatus() {
  const { useUpdate } = businessOutsideHooks
  const updateHook = useUpdate()

  return {
    ...updateHook,
    mutate: (variables: { id: string; is_active: boolean }) => {
      return updateHook.mutate({
        id: variables.id,
        is_active: variables.is_active,
      })
    },
  }
}

// Bulk operations for admin functionality
export function useBulkUpdateUserBusinessOutside() {
  return businessOutsideHooks.useBulkUpdate()
}
