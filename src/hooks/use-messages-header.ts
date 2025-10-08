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

import { handleMutationError } from '../lib/crud/error-handling'
import { messageHeaderService } from '../services/message-header.service'
import type { Row } from '../lib/database-types'

type MessagesHeader = Row<'messages_header'>

// Messages header hooks refactored to use service layer

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
      return messageHeaderService.getActiveMessagesByUser(userId, options)
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

      return messageHeaderService.getActiveMessagesByUser(user.id, options)
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

      return messageHeaderService.getExpiredMessagesByUser(user.id, options)
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

      return messageHeaderService.searchMessagesByUser(
        searchQuery,
        options?.userId || user.id,
        options,
      )
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

      return messageHeaderService.publishMessageHeader(user.id, newMessageData)
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
      return messageHeaderService.extendMessageExpiry({ id, additionalHours })
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
      await messageHeaderService.deleteMessageHeader(id)
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
    mutationFn: async () => {
      return messageHeaderService.cleanupExpiredMessages()
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
      return messageHeaderService.coordinatedCleanup()
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
      return messageHeaderService.getCleanupStatistics()
    },
    staleTime: 30 * 1000, // 30 seconds for cleanup stats
  })
}

// Hook to validate user has sufficient coins before operations
export function useValidateUserCoins() {
  return useMutation({
    mutationFn: async (requiredCoins: number) => {
      return messageHeaderService.validateUserCoins(requiredCoins)
    },
  })
}

// Hook to get user's current coin balance
export function useUserCoins() {
  return useQuery({
    queryKey: ['user-coins'],
    queryFn: async () => {
      return messageHeaderService.getUserCoins()
    },
    staleTime: 30 * 1000, // 30 seconds - coins change frequently
  })
}
