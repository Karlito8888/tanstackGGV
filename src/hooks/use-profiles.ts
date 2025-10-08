// Profiles CRUD hooks with mobile-first optimizations
// Refactored to use service layer pattern while preserving TanStack Query benefits
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authActions, authStore } from '../lib/store'
import { useAuth } from '../contexts/AuthContext'
import { queryKeys } from '../lib/query-keys'
import { handleMutationError } from '../lib/crud/error-handling'
import { profileService } from '../services/profile.service'
import type { Row, UpdateRow } from '../lib/database-types'

type Profile = Row<'profiles'>
type ProfileUpdate = UpdateRow<'profiles'>

// Legacy exports for backward compatibility - now using service layer
export function useProfileList(filters?: {
  is_admin?: boolean
  onboarding_completed?: boolean
  search?: string
  limit?: number
  offset?: number
}) {
  return useProfilesList(filters)
}

export function useProfileById(id: string) {
  return useProfile(id)
}

export function useProfileUpdate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { id: string } & ProfileUpdate) =>
      profileService.updateProfile(data.id, data),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.profiles.all })

      const previousData = queryClient.getQueryData(
        queryKeys.profiles.detail(variables.id),
      )

      queryClient.setQueryData(
        queryKeys.profiles.detail(variables.id),
        (old: Profile | undefined) => ({ ...old, ...variables }),
      )

      return { previousData }
    },
    onError: (_error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.profiles.detail(variables.id),
          context.previousData,
        )
      }
      handleMutationError(_error, 'update')
    },
    onSettled: (data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all })
      if (data) {
        queryClient.setQueryData(queryKeys.profiles.detail(variables.id), data)
      }
    },
  })
}

export function useProfileDelete() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => profileService.deleteProfile(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.profiles.all })

      const previousData = queryClient.getQueryData(
        queryKeys.profiles.detail(id),
      )

      queryClient.removeQueries({ queryKey: queryKeys.profiles.detail(id) })

      return { previousData, id }
    },
    onError: (error, id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.profiles.detail(id),
          context.previousData,
        )
      }
      handleMutationError(error, 'delete')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all })
    },
  })
}

// Note: useProfileCreate is intentionally excluded to prevent conflicts with the automatic
// profile creation trigger. Use the auth system to create users, which will automatically
// create their profiles via the handle_new_user() trigger.

// Profile queries with mobile-first optimizations - now using service layer
export function useProfile(id?: string) {
  return useQuery({
    queryKey: queryKeys.profiles.detail(id || ''),
    queryFn: () => profileService.getProfile(id || ''),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes for profile data
  })
}

export function useProfileByUsername(username?: string) {
  return useQuery({
    queryKey: queryKeys.profiles.byUsername(username || ''),
    queryFn: () => profileService.getProfileByUsername(username || ''),
    enabled: !!username,
    staleTime: 15 * 60 * 1000, // 15 minutes for username lookups
  })
}

export function useCurrentUserProfile() {
  const { user } = useAuth()
  const userId = user?.id
  return useQuery({
    queryKey: queryKeys.profiles.currentUser(),
    queryFn: () => profileService.getCurrentUserProfile(userId || ''),
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
    queryFn: () => profileService.getProfilesList(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes for lists
  })
}

// Profile mutations with optimistic updates - now using service layer
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
      return await profileService.updateProfile(id, updateData)
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
      // Note: This will be removed in Task 6 when authStore is fully deprecated
      const currentUserId = authStore.state.user?.id
      if (currentUserId === data.id) {
        authActions.setUser({
          ...authStore.state.user!,
          id: data.id,
          email: data.email,
          full_name: data.full_name,
          username: data.username,
          avatar_url: data.avatar_url,
          is_admin: data.is_admin,
          coins: data.coins,
          onboarding_completed: data.onboarding_completed || false,
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
      return await profileService.updateProfileCoins(id, coins, operation)
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
      // Note: This will be removed in Task 6 when authStore is fully deprecated
      const currentUserId = authStore.state.user?.id
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
      return await profileService.completeOnboarding(id)
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
      // Note: This will be removed in Task 6 when authStore is fully deprecated
      const currentUserId = authStore.state.user?.id
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
      return await profileService.deleteProfile(id)
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
    onSuccess: (_deletedId, variables) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: queryKeys.profiles.detail(variables),
      })

      // If deleting current user, logout
      // Note: This will be removed in Task 6 when authStore is fully deprecated
      const currentUserId = authStore.state.user?.id
      if (currentUserId === variables) {
        authActions.logout()
      }
    },
  })
}

// Specialized hooks for common operations - now using service layer
export function useDailyCheckin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      return await profileService.dailyCheckin(id)
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
      // Note: This will be removed in Task 6 when authStore is fully deprecated
      const currentUserId = authStore.state.user?.id
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
    queryFn: () => profileService.getOnboardingCompletionInfo(userId),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes for onboarding info
  })
}

// Admin-only hooks - now using service layer
export function useAdminUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...updateData
    }: ProfileUpdate & { id: string }) => {
      return await profileService.adminUpdateProfile(id, updateData)
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
