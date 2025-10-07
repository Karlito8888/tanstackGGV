// Chat CRUD hooks with mobile-first optimizations
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/query-keys'
import { createCRUDHooks } from '../lib/crud/create-crud-hooks'
import { handleMutationError } from '../lib/crud/error-handling'
import type { Row } from '../lib/database-types'

type Chat = Row<'chat'>

// Create base CRUD hooks for chat
const chatHooks = createCRUDHooks<'chat'>({
  tableName: 'chat',
  queryKeys: {
    all: queryKeys.chat.all,
    lists: queryKeys.chat.lists,
    list: queryKeys.chat.list,
    details: queryKeys.chat.details,
    detail: queryKeys.chat.detail,
  },
})

// Export the basic CRUD hooks from the factory
export const useChatList = chatHooks.useList
export const useChatById = chatHooks.useById
export const useChatCreate = chatHooks.useCreate
export const useChatUpdate = chatHooks.useUpdate
export const useChatDelete = chatHooks.useDelete

// Chat queries with mobile-first optimizations
export function useChatMessagesByChannel(
  channelId: string,
  options?: {
    limit?: number
    offset?: number
  },
) {
  return useQuery({
    queryKey: queryKeys.chat.byChannel(channelId),
    queryFn: async () => {
      let query = supabase
        .from('chat')
        .select(
          `
          *,
          profiles:user_id (
            id,
            username,
            full_name,
            avatar_url
          ),
          reply_message:reply_to (
            id,
            content,
            user_id,
            created_at
          )
        `,
        )
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })

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
        Chat & {
          profiles: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
          } | null
          reply_message: {
            id: string
            content: string
            user_id: string | null
            created_at: string
          } | null
        }
      >
    },
    enabled: !!channelId,
    staleTime: 30 * 1000, // 30 seconds for chat messages
  })
}

export function useChatMessagesByUser(
  userId: string,
  options?: {
    limit?: number
    offset?: number
  },
) {
  return useQuery({
    queryKey: queryKeys.chat.byUser(userId),
    queryFn: async () => {
      let query = supabase
        .from('chat')
        .select('*')
        .eq('user_id', userId)
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
      return data as Array<Chat>
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes for user messages
  })
}

export function useChatReplies(messageId: string) {
  return useQuery({
    queryKey: queryKeys.chat.replies(messageId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat')
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
        .eq('reply_to', messageId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as Array<
        Chat & {
          profiles: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
          } | null
        }
      >
    },
    enabled: !!messageId,
    staleTime: 30 * 1000, // 30 seconds for replies
  })
}

export function useChatSearch(
  searchQuery: string,
  options?: {
    channelId?: string
    limit?: number
  },
) {
  return useQuery({
    queryKey: queryKeys.chat.search(searchQuery),
    queryFn: async () => {
      let query = supabase
        .from('chat')
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
        .ilike('content', `%${searchQuery}%`)
        .order('created_at', { ascending: false })

      if (options?.channelId) {
        query = query.eq('channel_id', options.channelId)
      }

      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Array<
        Chat & {
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

// Specialized mutations for chat
export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (messageData: {
      channel_id: string
      content: string
      reply_to?: string
    }) => {
      const { data, error } = await supabase
        .from('chat')
        .insert({
          channel_id: messageData.channel_id,
          content: messageData.content,
          reply_to: messageData.reply_to,
          // user_id will be automatically set by RLS policy using auth.uid()
        })
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
      return data as Chat & {
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
        queryKey: queryKeys.chat.byChannel(newMessage.channel_id),
      })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<Array<Chat>>(
        queryKeys.chat.byChannel(newMessage.channel_id),
      )

      // Optimistically add the new message
      const optimisticMessage: Chat = {
        channel_id: newMessage.channel_id,
        content: newMessage.content,
        reply_to: newMessage.reply_to,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_edited: false,
        // user_id will be set by RLS, we don't know it client-side
      } as Chat

      queryClient.setQueryData<Array<Chat>>(
        queryKeys.chat.byChannel(newMessage.channel_id),
        (old = []) => [...old, optimisticMessage],
      )

      return { previousData }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.chat.byChannel(variables.channel_id),
          context.previousData,
        )
      }
      handleMutationError(error, 'create')
    },
    onSettled: (_data, _error, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat.byChannel(variables.channel_id),
      })
    },
  })
}

export function useEditMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { data, error } = await supabase
        .from('chat')
        .update({
          content,
          is_edited: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        // RLS will automatically ensure user can only edit their own messages
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
      return data as Chat & {
        profiles: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
        } | null
      }
    },
    onMutate: async ({ id, content }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.chat.lists() })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<Array<Chat>>(
        queryKeys.chat.lists(),
      )

      // Optimistically update the message
      queryClient.setQueryData<Array<Chat>>(
        queryKeys.chat.lists(),
        (old = []) =>
          old.map((message) =>
            message.id === id
              ? {
                  ...message,
                  content,
                  is_edited: true,
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
        queryClient.setQueryData(queryKeys.chat.lists(), context.previousData)
      }
      handleMutationError(error, 'update')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.lists() })
    },
    onSuccess: (data) => {
      // Update the detail cache
      queryClient.setQueryData(queryKeys.chat.detail(data.id), data)
    },
  })
}

export function useDeleteMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chat').delete().eq('id', id)
      // RLS will automatically ensure user can only delete their own messages
      if (error) throw error
      return id
    },
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.chat.lists() })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<Array<Chat>>(
        queryKeys.chat.lists(),
      )

      // Optimistically remove the message
      queryClient.setQueryData<Array<Chat>>(
        queryKeys.chat.lists(),
        (old = []) => old.filter((message) => message.id !== id),
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.chat.lists(), context.previousData)
      }
      handleMutationError(error, 'delete')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.lists() })
    },
    onSuccess: (deletedId) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: queryKeys.chat.detail(deletedId),
      })
    },
  })
}
