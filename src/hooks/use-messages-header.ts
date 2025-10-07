// Messages Header CRUD hooks with mobile-first optimizations
//
// IMPORTANT: These hooks interact with PostgreSQL triggers and functions:
// - publish_header_message(): Atomic coin deduction and message creation
// - auto_cleanup_expired_messages: Automatic cleanup of expired messages
// - cleanup_expired_messages(): Manual global cleanup function
//
// Design considerations:
// - No optimistic coin updates to prevent double deduction with PostgreSQL functions
// - Aggressive cache invalidation to sync with auto-cleanup triggers
// - Global cleanup scope matches trigger behavior (not user-specific)
//
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/query-keys'
import { createCRUDHooks } from '../lib/crud/create-crud-hooks'
import { handleMutationError } from '../lib/crud/error-handling'
import type { Row } from '../lib/database-types'

type MessagesHeader = Row<'messages_header'>

// Create base CRUD hooks for messages_header
const messagesHeaderHooks = createCRUDHooks<'messages_header'>({
  tableName: 'messages_header',
  queryKeys: {
    all: queryKeys.messagesHeader.all,
    lists: queryKeys.messagesHeader.lists,
    list: queryKeys.messagesHeader.list,
    details: queryKeys.messagesHeader.details,
    detail: queryKeys.messagesHeader.detail,
  },
})

// Export the basic CRUD hooks from the factory
export const useMessagesHeaderList = messagesHeaderHooks.useList
export const useMessagesHeaderById = messagesHeaderHooks.useById
export const useMessagesHeaderCreate = messagesHeaderHooks.useCreate
export const useMessagesHeaderUpdate = messagesHeaderHooks.useUpdate
export const useMessagesHeaderDelete = messagesHeaderHooks.useDelete

// Messages Header queries with mobile-first optimizations
export function useMessagesHeaderByUser(
  userId: string,
  options?: {
    limit?: number
    offset?: number
    includeExpired?: boolean
  },
) {
  return useQuery({
    queryKey: queryKeys.messagesHeader.byUser(userId),
    queryFn: async () => {
      let query = supabase
        .from('messages_header')
        .select(
          `
          *,
          profiles:user_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `,
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      // Filter out expired messages unless explicitly requested
      if (!options?.includeExpired) {
        query = query.or('expires_at.is.null,expires_at.gt.now()')
      }

      if (options?.limit) {
        query = query.limit(options.limit)
      }
      if (options?.offset) {
        query = query.range(
          options.offset,
          options.offset + (options.limit || 50) - 1,
        )
      }

      const { data, error } = await query
      if (error) throw error
      return data as Array<
        MessagesHeader & {
          profiles: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
          } | null
        }
      >
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes for user messages
  })
}

export function useActiveMessagesHeader(options?: {
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: queryKeys.messagesHeader.active(),
    queryFn: async () => {
      // Get current user to filter only their messages since RLS allows seeing all
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user?.id) {
        throw new Error('User not authenticated')
      }

      let query = supabase
        .from('messages_header')
        .select(
          `
          *,
          profiles:user_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `,
        )
        .eq('user_id', user.id)
        .or('expires_at.is.null,expires_at.gt.now()')
        .order('created_at', { ascending: false })

      if (options?.limit) {
        query = query.limit(options.limit)
      }
      if (options?.offset) {
        query = query.range(
          options.offset,
          options.offset + (options.limit || 50) - 1,
        )
      }

      const { data, error } = await query
      if (error) throw error
      return data as Array<
        MessagesHeader & {
          profiles: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
          } | null
        }
      >
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for active messages
  })
}

export function useExpiredMessagesHeader(options?: {
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: queryKeys.messagesHeader.expired(),
    queryFn: async () => {
      // Get current user to filter only their messages since RLS allows seeing all
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user?.id) {
        throw new Error('User not authenticated')
      }

      let query = supabase
        .from('messages_header')
        .select(
          `
          *,
          profiles:user_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `,
        )
        .eq('user_id', user.id)
        .not('expires_at', 'is', null)
        .lt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: true })

      if (options?.limit) {
        query = query.limit(options.limit)
      }
      if (options?.offset) {
        query = query.range(
          options.offset,
          options.offset + (options.limit || 50) - 1,
        )
      }

      const { data, error } = await query
      if (error) throw error
      return data as Array<
        MessagesHeader & {
          profiles: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
          } | null
        }
      >
    },
    staleTime: 10 * 60 * 1000, // 10 minutes for expired messages
  })
}

export function useMessagesHeaderSearch(
  searchQuery: string,
  options?: {
    userId?: string
    limit?: number
    includeExpired?: boolean
  },
) {
  return useQuery({
    queryKey: queryKeys.messagesHeader.search(searchQuery),
    queryFn: async () => {
      // Get current user to filter only their messages since RLS allows seeing all
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user?.id) {
        throw new Error('User not authenticated')
      }

      let query = supabase
        .from('messages_header')
        .select(
          `
          *,
          profiles:user_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `,
        )
        .eq('user_id', options?.userId || user.id)
        .ilike('message', `%${searchQuery}%`)
        .order('created_at', { ascending: false })

      // Filter out expired messages unless explicitly requested
      if (!options?.includeExpired) {
        query = query.or('expires_at.is.null,expires_at.gt.now()')
      }

      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Array<
        MessagesHeader & {
          profiles: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
          } | null
        }
      >
    },
    enabled: !!searchQuery && searchQuery.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes for search results
  })
}

// Specialized mutations for messages header
export function useCreateMessageHeader() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newMessageData: {
      message: string
      coins_spent?: number
      expires_at?: string
    }) => {
      // Get current user ID since RLS doesn't automatically set user_id
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user?.id) {
        throw new Error('User not authenticated')
      }

      const coinsToSpend = newMessageData.coins_spent || 0

      // Use the secure publish_header_message function for atomic coin deduction
      const { error } = await supabase.rpc('publish_header_message', {
        p_user_id: user.id,
        p_message: newMessageData.message,
        p_expires_at: newMessageData.expires_at || null,
        p_coins: coinsToSpend,
      })

      if (error) {
        // Handle specific coin-related errors
        if (error.message.includes('Not enough coins')) {
          throw new Error('Insufficient coins to publish this message')
        }
        throw error
      }

      // Fetch the created message with profile data
      const { data: messageData, error: fetchError } = await supabase
        .from('messages_header')
        .select(
          `
          *,
          profiles:user_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `,
        )
        .eq('user_id', user.id)
        .eq('message', newMessageData.message)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (fetchError) throw fetchError
      return messageData as MessagesHeader & {
        profiles: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
        } | null
      }
    },
    onMutate: async (newMessage) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.messagesHeader.lists(),
      })

      // Snapshot previous state for messages only
      const previousMessagesData = queryClient.getQueryData<
        Array<MessagesHeader>
      >(queryKeys.messagesHeader.lists())

      // Get current user for optimistic update
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Optimistically add the new message
      const optimisticMessage: MessagesHeader = {
        user_id: user?.id,
        message: newMessage.message,
        coins_spent: newMessage.coins_spent || 0,
        expires_at: newMessage.expires_at,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as MessagesHeader

      // Optimistically update messages list (note: auto-cleanup trigger may remove expired messages)
      queryClient.setQueryData<Array<MessagesHeader>>(
        queryKeys.messagesHeader.lists(),
        (old = []) => [...old, optimisticMessage],
      )

      // NOTE: No optimistic coin deduction - let PostgreSQL function handle it atomically
      // This prevents double deduction conflicts with publish_header_message()

      return {
        previousMessagesData,
        userId: user?.id,
      }
    },
    onError: (error, _variables, context) => {
      // Rollback messages on error
      if (context?.previousMessagesData) {
        queryClient.setQueryData(
          queryKeys.messagesHeader.lists(),
          context.previousMessagesData,
        )
      }

      // NOTE: No coin rollback needed - PostgreSQL function handles atomic transaction
      // If publish_header_message() failed, coins were not deducted

      handleMutationError(error, 'create')
    },
    onSettled: () => {
      // Always refetch after error or success to sync with database state
      // Important because auto-cleanup trigger may have removed messages
      queryClient.invalidateQueries({
        queryKey: queryKeys.messagesHeader.all,
      })
      // Also refresh profiles as coins were deducted by PostgreSQL function
      queryClient.invalidateQueries({
        queryKey: queryKeys.profiles.all,
      })
    },
    onSuccess: (data) => {
      // Update the detail cache with fresh data from database
      queryClient.setQueryData(queryKeys.messagesHeader.detail(data.id), data)
      // Invalidate user-specific cache to reflect coin changes
      if (data.user_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.profiles.detail(data.user_id),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.messagesHeader.byUser(data.user_id),
        })
      }
    },
  })
}

export function useExtendMessageExpiry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      additionalHours = 24,
    }: {
      id: string
      additionalHours?: number
    }) => {
      // First get current message to check existing expiry
      const { data: currentMessage, error: fetchError } = await supabase
        .from('messages_header')
        .select('expires_at')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      // Calculate new expiry date
      const currentExpiry = currentMessage.expires_at
        ? new Date(currentMessage.expires_at)
        : new Date()
      const newExpiry = new Date(
        currentExpiry.getTime() + (additionalHours || 24) * 60 * 60 * 1000,
      )

      const { data, error } = await supabase
        .from('messages_header')
        .update({
          expires_at: newExpiry.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        // RLS will automatically ensure user can only update their own messages
        .select(
          `
          *,
          profiles:user_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `,
        )
        .single()

      if (error) throw error
      return data as MessagesHeader & {
        profiles: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
        } | null
      }
    },
    onMutate: async ({ id, additionalHours }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.messagesHeader.lists(),
      })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<Array<MessagesHeader>>(
        queryKeys.messagesHeader.lists(),
      )

      // Optimistically update the message
      queryClient.setQueryData<Array<MessagesHeader>>(
        queryKeys.messagesHeader.lists(),
        (old = []) =>
          old.map((message) =>
            message.id === id
              ? {
                  ...message,
                  expires_at: message.expires_at
                    ? new Date(
                        new Date(message.expires_at).getTime() +
                          (additionalHours || 24) * 60 * 60 * 1000,
                      ).toISOString()
                    : new Date(
                        Date.now() + (additionalHours || 24) * 60 * 60 * 1000,
                      ).toISOString(),
                  updated_at: new Date().toISOString(),
                }
              : message,
          ),
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.messagesHeader.lists(),
          context.previousData,
        )
      }
      handleMutationError(error, 'update')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: queryKeys.messagesHeader.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.messagesHeader.active(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.messagesHeader.expired(),
      })
    },
    onSuccess: (data) => {
      // Update the detail cache
      queryClient.setQueryData(queryKeys.messagesHeader.detail(data.id), data)
      // Invalidate user-specific cache if we have user data
      if (data.user_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.messagesHeader.byUser(data.user_id),
        })
      }
    },
  })
}

export function useDeleteMessageHeader() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('messages_header')
        .delete()
        .eq('id', id)
      // RLS will automatically ensure user can only delete their own messages
      if (error) throw error
      return id
    },
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.messagesHeader.lists(),
      })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<Array<MessagesHeader>>(
        queryKeys.messagesHeader.lists(),
      )

      // Optimistically remove the message
      queryClient.setQueryData<Array<MessagesHeader>>(
        queryKeys.messagesHeader.lists(),
        (old = []) => old.filter((message) => message.id !== id),
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.messagesHeader.lists(),
          context.previousData,
        )
      }
      handleMutationError(error, 'delete')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: queryKeys.messagesHeader.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.messagesHeader.active(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.messagesHeader.expired(),
      })
    },
    onSuccess: (deletedId) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: queryKeys.messagesHeader.detail(deletedId),
      })
    },
  })
}

// Specialized hook for manual cleanup of expired messages
export function useCleanupExpiredMessages() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (options?: { force?: boolean; source?: string }) => {
      // Get current user for authentication
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user?.id) {
        throw new Error('User not authenticated')
      }

      // Call the coordinated cleanup function that respects trigger activity
      const { data, error } = await supabase.rpc(
        'cleanup_expired_messages_with_coordination',
        {
          force_cleanup: options?.force || false,
          source_type: options?.source || 'manual',
        },
      )

      if (error) throw error
      return { userId: user.id, cleanupResult: data[0] }
    },
    onSuccess: () => {
      // Force complete cache refresh
      queryClient.invalidateQueries({
        queryKey: queryKeys.messagesHeader.all,
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.profiles.all,
      })
    },
  })
}

// Hook for coordinated cleanup that checks trigger activity
export function useCoordinatedCleanup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      // Get current user for authentication
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user?.id) {
        throw new Error('User not authenticated')
      }

      // Call the coordinated cleanup function
      const { data, error } = await supabase.rpc('coordinated_cleanup')

      if (error) throw error
      return { userId: user.id, result: data }
    },
    onSuccess: () => {
      // Force complete cache refresh
      queryClient.invalidateQueries({
        queryKey: queryKeys.messagesHeader.all,
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.profiles.all,
      })
    },
  })
}

// Hook to get cleanup statistics
export function useCleanupStatistics() {
  return useQuery({
    queryKey: ['cleanup-statistics'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cleanup_statistics')

      if (error) throw error
      return data
    },
    staleTime: 30 * 1000, // 30 seconds for cleanup stats
  })
}

// Hook to validate user has sufficient coins before operations
export function useValidateUserCoins() {
  return useMutation({
    mutationFn: async (requiredCoins: number) => {
      // Get current user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user?.id) {
        throw new Error('User not authenticated')
      }

      // Get user profile to check coin balance
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('coins')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      const hasEnoughCoins = profile.coins >= requiredCoins

      return {
        hasEnoughCoins,
        currentCoins: profile.coins,
        requiredCoins,
        userId: user.id,
      }
    },
  })
}

// Hook to get user's current coin balance
export function useUserCoins() {
  return useQuery({
    queryKey: ['user-coins'],
    queryFn: async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user?.id) {
        throw new Error('User not authenticated')
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('coins')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError
      return profile.coins || 0
    },
    staleTime: 30 * 1000, // 30 seconds - coins change frequently
  })
}
