// User Services CRUD hooks with mobile-first optimizations
// Using TanStack Query best practices with optimistic updates and RLS-aware error handling
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { queryKeys } from '../lib/query-keys'

import { handleMutationError } from '../lib/crud/error-handling'
import type { Row, UpdateRow } from '../lib/database-types'

// Type alias for user_services table
type UserService = Row<'user_services'>
type UserServiceUpdate = UpdateRow<'user_services'>

// User services hooks refactored to use service layer

// Specialized hooks for services

/**
 * Hook to get services by profile ID
 */
export function useServicesByProfile(profileId?: string) {
  return useQuery({
    queryKey: queryKeys.services.byProfile(profileId || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_services')
        .select('*')
        .eq('profile_id', profileId || '')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Array<UserService>
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000, // 5 minutes for profile services
  })
}

/**
 * Hook to get current user's services
 */
export function useCurrentUserServices() {
  const { user } = useAuth()
  const userId = user?.id
  return useServicesByProfile(userId)
}

/**
 * Hook to get services by category
 */
export function useServicesByCategory(categoryId?: string) {
  return useQuery({
    queryKey: queryKeys.services.byCategory(categoryId || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_services')
        .select('*')
        .eq('category_id', categoryId || '')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Array<UserService>
    },
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000, // 5 minutes for category services
  })
}

/**
 * Hook to get mobile services only
 */
export function useMobileServices() {
  return useQuery({
    queryKey: queryKeys.services.mobile(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_services')
        .select('*')
        .eq('is_mobile', true)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Array<UserService>
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for mobile services
  })
}

/**
 * Hook to search services
 */
export function useSearchServices(searchQuery: string) {
  return useQuery({
    queryKey: queryKeys.services.search(searchQuery),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_services')
        .select('*')
        .eq('is_active', true)
        .or(
          `description.ilike.%${searchQuery}%,price_range.ilike.%${searchQuery}%,availability.ilike.%${searchQuery}%`,
        )
        .order('created_at', { ascending: false })
        .limit(50) // Limit search results

      if (error) throw error
      return data as Array<UserService>
    },
    enabled: !!searchQuery && searchQuery.length >= 2,
    staleTime: 3 * 60 * 1000, // 3 minutes for search results
  })
}

// Specialized mutation hooks

/**
 * Hook to activate a service
 */
export function useActivateUserService() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('user_services')
        .update({ is_active: true })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as UserService
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.services.lists() })

      const previousData = queryClient.getQueryData<Array<UserService>>(
        queryKeys.services.lists(),
      )

      // Optimistically update the service
      queryClient.setQueryData<Array<UserService>>(
        queryKeys.services.lists(),
        (old = []) =>
          old.map((service) =>
            service.id === id ? { ...service, is_active: true } : service,
          ),
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.services.lists(),
          context.previousData,
        )
      }
      handleMutationError(error, 'update')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.lists() })
    },
  })
}

/**
 * Hook to deactivate a service
 */
export function useDeactivateUserService() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('user_services')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as UserService
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.services.lists() })

      const previousData = queryClient.getQueryData<Array<UserService>>(
        queryKeys.services.lists(),
      )

      // Optimistically update the service
      queryClient.setQueryData<Array<UserService>>(
        queryKeys.services.lists(),
        (old = []) =>
          old.map((service) =>
            service.id === id ? { ...service, is_active: false } : service,
          ),
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.services.lists(),
          context.previousData,
        )
      }
      handleMutationError(error, 'update')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.lists() })
    },
  })
}

/**
 * Hook to update service photos
 */
export function useUpdateServicePhotos() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      photos,
    }: {
      id: string
      photos: {
        photo_1_url?: string | null
        photo_2_url?: string | null
        photo_3_url?: string | null
        photo_4_url?: string | null
        photo_5_url?: string | null
      }
    }) => {
      const { data, error } = await supabase
        .from('user_services')
        .update(photos)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as UserService
    },
    onMutate: async ({ id, photos }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.services.lists() })

      const previousData = queryClient.getQueryData<Array<UserService>>(
        queryKeys.services.lists(),
      )

      // Optimistically update the service photos
      queryClient.setQueryData<Array<UserService>>(
        queryKeys.services.lists(),
        (old = []) =>
          old.map((service) =>
            service.id === id ? { ...service, ...photos } : service,
          ),
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.services.lists(),
          context.previousData,
        )
      }
      handleMutationError(error, 'update')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.lists() })
    },
  })
}

/**
 * Hook to update service location type only
 * Note: location_id, block, and lot are automatically managed by database triggers
 */
export function useUpdateServiceLocationType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      service_location_type,
    }: {
      id: string
      service_location_type?: 'at_provider' | 'mobile' | 'both' | null
    }) => {
      const updateData: UserServiceUpdate = {}
      if (service_location_type !== undefined)
        updateData.service_location_type = service_location_type

      const { data, error } = await supabase
        .from('user_services')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as UserService
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.services.lists() })

      const previousData = queryClient.getQueryData<Array<UserService>>(
        queryKeys.services.lists(),
      )

      // Optimistically update the service location type
      queryClient.setQueryData<Array<UserService>>(
        queryKeys.services.lists(),
        (old = []) =>
          old.map((service) =>
            service.id === variables.id
              ? {
                  ...service,
                  service_location_type:
                    variables.service_location_type || null,
                  updated_at: new Date().toISOString(),
                }
              : service,
          ),
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.services.lists(),
          context.previousData,
        )
      }
      handleMutationError(error, 'update')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.lists() })
    },
  })
}

/**
 * Hook to get location assignment info for a service
 */
export function useServiceLocationAssignmentInfo(serviceId: string) {
  return useQuery({
    queryKey: ['service-location-assignment', serviceId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_location_assignment_info',
        {
          table_name: 'user_services',
          record_id: serviceId,
        },
      )

      if (error) throw error
      return data
    },
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000, // 5 minutes for location assignment info
  })
}

/**
 * Admin-only hook to update any service
 */
export function useAdminUpdateUserService() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...updateData
    }: UserServiceUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('user_services')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as UserService
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.services.lists() })

      const previousData = queryClient.getQueryData<Array<UserService>>(
        queryKeys.services.lists(),
      )

      // Optimistically update the service
      queryClient.setQueryData<Array<UserService>>(
        queryKeys.services.lists(),
        (old = []) =>
          old.map((service) =>
            service.id === variables.id
              ? {
                  ...service,
                  ...variables,
                  updated_at: new Date().toISOString(),
                }
              : service,
          ),
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.services.lists(),
          context.previousData,
        )
      }
      handleMutationError(error, 'update')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.lists() })
    },
  })
}
