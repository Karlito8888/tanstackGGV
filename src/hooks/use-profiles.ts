// Profiles CRUD hooks with mobile-first optimizations
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { authActions, authStore } from '../lib/store'
import { queryKeys } from '../lib/query-keys'
import { createCRUDHooks } from '../lib/crud/create-crud-hooks'
import { handleMutationError } from '../lib/crud/error-handling'
import type { Row, UpdateRow } from '../lib/database-types'

type Profile = Row<'profiles'>
type ProfileUpdate = UpdateRow<'profiles'>

// Get current user ID from auth store
const getCurrentUserId = () => authStore.state.user?.id

// Create base CRUD hooks for profiles (excluding create to avoid conflicts with database trigger)
const profileHooks = createCRUDHooks<'profiles'>({
  tableName: 'profiles',
  queryKeys: {
    all: queryKeys.profiles.all,
    lists: queryKeys.profiles.lists,
    list: queryKeys.profiles.list,
    details: queryKeys.profiles.details,
    detail: queryKeys.profiles.detail,
  },
})

// Export the basic CRUD hooks from the factory (excluding create to avoid duplicates)
// Profile creation is automatically handled by the database trigger `handle_new_user()`
// which creates a profile with 10 coins when a new user signs up via Supabase Auth.
export const useProfileList = profileHooks.useList
export const useProfileById = profileHooks.useById
export const useProfileUpdate = profileHooks.useUpdate
export const useProfileDelete = profileHooks.useDelete

// Note: useProfileCreate is intentionally excluded to prevent conflicts with the automatic
// profile creation trigger. Use the auth system to create users, which will automatically
// create their profiles via the handle_new_user() trigger.

// Profile queries with mobile-first optimizations
export function useProfile(id?: string) {
  return useQuery({
    queryKey: queryKeys.profiles.detail(id || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id || '')
        .single()

      if (error) throw error
      return data as Profile
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes for profile data
  })
}

export function useProfileByUsername(username?: string) {
  return useQuery({
    queryKey: queryKeys.profiles.byUsername(username || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single()

      if (error) throw error
      return data as Profile
    },
    enabled: !!username,
    staleTime: 15 * 60 * 1000, // 15 minutes for username lookups
  })
}

export function useCurrentUserProfile() {
  const userId = getCurrentUserId()
  return useQuery({
    queryKey: queryKeys.profiles.currentUser(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId || '')
        .single()

      if (error) throw error
      return data as Profile
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes for current user profile
  })
}

export function useProfilesList(filters?: {
  is_admin?: boolean
  onboarding_completed?: boolean
  search?: string
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: queryKeys.profiles.list(filters),
    queryFn: async () => {
      let query = supabase.from('profiles').select('*', { count: 'exact' })

      // Apply filters
      if (filters?.is_admin !== undefined) {
        query = query.eq('is_admin', filters.is_admin)
      }
      if (filters?.onboarding_completed !== undefined) {
        query = query.eq('onboarding_completed', filters.onboarding_completed)
      }
      if (filters?.search) {
        query = query.or(
          `full_name.ilike.%${filters.search}%,username.ilike.%${filters.search}%`,
        )
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

      // Order by created_at desc
      query = query.order('created_at', { ascending: false })

      const { data, error, count } = await query
      if (error) throw error

      return { data, count }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for lists
  })
}

// Profile mutations with optimistic updates
// Note: Profile creation is automatically handled by the database trigger `handle_new_user()`
// which creates a profile with 10 coins when a new user signs up via Supabase Auth.
// Manual profile creation is not needed and could cause duplicates.
// If admin profile creation is needed, create a separate admin-specific function.

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...updateData
    }: ProfileUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Profile
    },
    onMutate: async (variables: ProfileUpdate & { id: string }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.profiles.lists() })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<Array<Profile>>(
        queryKeys.profiles.lists(),
      )

      // Optimistically update the item
      queryClient.setQueryData<Array<Profile>>(
        queryKeys.profiles.lists(),
        (old = []) =>
          old.map((item) =>
            item.id === variables.id
              ? { ...item, ...variables, updated_at: new Date().toISOString() }
              : item,
          ),
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.profiles.lists(),
          context.previousData,
        )
      }
      handleMutationError(error, 'update')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.lists() })
    },
    onSuccess: (data) => {
      // Update the detail cache
      queryClient.setQueryData(queryKeys.profiles.detail(data.id), data)

      // If updating current user, update auth store
      const currentUserId = getCurrentUserId()
      if (currentUserId === data.id) {
        authActions.setUser({
          ...authStore.state.user!,
          ...data,
        })
      }
    },
  })
}

export function useUpdateProfileCoins() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      coins,
      operation = 'set',
    }: {
      id: string
      coins: number
      operation?: 'set' | 'add' | 'subtract'
    }) => {
      // Use the safe coin update function with validation
      const { data, error } = await supabase.rpc('safe_update_coins', {
        user_id_param: id,
        new_coins: coins,
        operation: operation,
      })

      if (error) throw error

      if (!data.success) {
        throw new Error(data.message)
      }

      // Fetch the updated profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()

      if (profileError) throw profileError
      return profileData as Profile
    },
    onMutate: async ({ id, coins }: { id: string; coins: number }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.profiles.lists() })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<Array<Profile>>(
        queryKeys.profiles.lists(),
      )

      // Optimistically update the item
      queryClient.setQueryData<Array<Profile>>(
        queryKeys.profiles.lists(),
        (old = []) =>
          old.map((item) =>
            item.id === id
              ? { ...item, coins, updated_at: new Date().toISOString() }
              : item,
          ),
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.profiles.lists(),
          context.previousData,
        )
      }
      handleMutationError(error, 'update')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.lists() })
    },
    onSuccess: (data) => {
      // Update the detail cache
      queryClient.setQueryData(queryKeys.profiles.detail(data.id), data)

      // Update coins in auth store if current user
      const currentUserId = getCurrentUserId()
      if (currentUserId === data.id) {
        authActions.updateCoins(data.coins)
      }
    },
  })
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // Use the safe onboarding completion function that checks trigger state
      const { data, error } = await supabase.rpc('safe_complete_onboarding', {
        user_id_param: id,
      })

      if (error) throw error

      // Check if already completed
      if (data.already_completed) {
        return { id, already_completed: true, message: data.message }
      }

      // Fetch the updated profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()

      if (profileError) throw profileError
      return { ...(profileData as Profile), already_completed: false }
    },
    onMutate: async (id: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.profiles.lists() })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<Array<Profile>>(
        queryKeys.profiles.lists(),
      )

      // Optimistically update the item
      queryClient.setQueryData<Array<Profile>>(
        queryKeys.profiles.lists(),
        (old = []) =>
          old.map((item) =>
            item.id === id
              ? {
                  ...item,
                  onboarding_completed: true,
                  updated_at: new Date().toISOString(),
                }
              : item,
          ),
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.profiles.lists(),
          context.previousData,
        )
      }
      handleMutationError(error, 'update')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.lists() })
    },
    onSuccess: (data) => {
      // Update the detail cache
      queryClient.setQueryData(queryKeys.profiles.detail(data.id), data)

      // Update onboarding in auth store if current user
      const currentUserId = getCurrentUserId()
      if (currentUserId === data.id) {
        authActions.completeOnboarding()
      }
    },
  })
}

export function useDeleteProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('profiles').delete().eq('id', id)

      if (error) throw error
      return id
    },
    onMutate: async (id: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.profiles.lists() })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<Array<Profile>>(
        queryKeys.profiles.lists(),
      )

      // Optimistically remove the item
      queryClient.setQueryData<Array<Profile>>(
        queryKeys.profiles.lists(),
        (old = []) => old.filter((item) => item.id !== id),
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.profiles.lists(),
          context.previousData,
        )
      }
      handleMutationError(error, 'delete')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.lists() })
    },
    onSuccess: (deletedId) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: queryKeys.profiles.detail(deletedId),
      })

      // If deleting current user, logout
      const currentUserId = getCurrentUserId()
      if (currentUserId === deletedId) {
        authActions.logout()
      }
    },
  })
}

// Specialized hooks for common operations
export function useDailyCheckin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('daily_checkin', {
        user_id: id,
      })

      if (error) throw error
      return data
    },
    onMutate: async (id: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.profiles.lists() })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<Array<Profile>>(
        queryKeys.profiles.lists(),
      )

      // Optimistically update the profile
      queryClient.setQueryData<Array<Profile>>(
        queryKeys.profiles.lists(),
        (old = []) =>
          old.map((item) =>
            item.id === id
              ? {
                  ...item,
                  last_daily_checkin: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }
              : item,
          ),
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.profiles.lists(),
          context.previousData,
        )
      }
      handleMutationError(error, 'update')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.lists() })
    },
    onSuccess: (data: any, variables) => {
      // Update profile in cache with new coins and checkin time
      queryClient.setQueryData(
        queryKeys.profiles.detail(variables),
        (old: Profile | undefined) => {
          if (!old) return old
          return {
            ...old,
            coins: data.coins,
            last_daily_checkin: new Date().toISOString(),
          }
        },
      )

      // Update auth store if current user
      const currentUserId = getCurrentUserId()
      if (currentUserId === variables) {
        authActions.updateCoins(data.coins)
      }
    },
  })
}

/**
 * Hook to get onboarding completion info and source
 */
export function useOnboardingCompletionInfo(userId: string) {
  return useQuery({
    queryKey: ['onboarding-completion-info', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_onboarding_completion_info',
        {
          user_id_param: userId,
        },
      )

      if (error) throw error
      return data
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes for onboarding info
  })
}

// Admin-only hooks
export function useAdminUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...updateData
    }: ProfileUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Profile
    },
    onMutate: async (variables: ProfileUpdate & { id: string }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.profiles.lists() })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<Array<Profile>>(
        queryKeys.profiles.lists(),
      )

      // Optimistically update the item
      queryClient.setQueryData<Array<Profile>>(
        queryKeys.profiles.lists(),
        (old = []) =>
          old.map((item) =>
            item.id === variables.id
              ? { ...item, ...variables, updated_at: new Date().toISOString() }
              : item,
          ),
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.profiles.lists(),
          context.previousData,
        )
      }
      handleMutationError(error, 'update')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.lists() })
    },
    onSuccess: (data) => {
      // Update the detail cache
      queryClient.setQueryData(queryKeys.profiles.detail(data.id), data)
    },
  })
}
