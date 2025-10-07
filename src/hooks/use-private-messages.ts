// Private Messages CRUD hooks with mobile-first optimizations
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/query-keys'
import { createCRUDHooks } from '../lib/crud/create-crud-hooks'
import { handleMutationError } from '../lib/crud/error-handling'
import type { Row } from '../lib/database-types'

type PrivateMessage = Row<'private_messages'>

// Create base CRUD hooks for private_messages
const privateMessageHooks = createCRUDHooks<'private_messages'>({
  tableName: 'private_messages',
  queryKeys: {
    all: queryKeys.privateMessages.all,
    lists: queryKeys.privateMessages.lists,
    list: queryKeys.privateMessages.list,
    details: queryKeys.privateMessages.details,
    detail: queryKeys.privateMessages.detail,
  },
})

// Export the basic CRUD hooks from the factory
export const usePrivateMessageList = privateMessageHooks.useList
export const usePrivateMessageById = privateMessageHooks.useById
export const usePrivateMessageCreate = privateMessageHooks.useCreate
export const usePrivateMessageUpdate = privateMessageHooks.useUpdate
export const usePrivateMessageDelete = privateMessageHooks.useDelete

// Private Messages queries with mobile-first optimizations
export function usePrivateMessageConversations(
  userId: string,
  options?: {
    limit?: number
    offset?: number
  },
) {
  return useQuery({
    queryKey: queryKeys.privateMessages.conversations(userId),
    queryFn: async () => {
      let query = supabase
        .from('private_messages')
        .select(
          `
          *,
          sender:sender_id (
            id,
            username,
            full_name,
            avatar_url
          ),
          receiver:receiver_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `,
        )
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .is('deleted_at', null)
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

      // Group messages by conversation (pair of users)
      const conversations = new Map<string, any>()

      data.forEach((message) => {
        const otherUserId =
          message.sender_id === userId ? message.receiver_id : message.sender_id

        const conversationKey = [userId, otherUserId].sort().join('-')

        if (!conversations.has(conversationKey)) {
          conversations.set(conversationKey, {
            id: conversationKey,
            other_user:
              message.sender_id === userId ? message.receiver : message.sender,
            last_message: message,
            unread_count: 0,
          })
        }

        // Count unread messages
        if (message.receiver_id === userId && !message.read_at) {
          const conversation = conversations.get(conversationKey)
          conversation.unread_count += 1
        }
      })

      return Array.from(conversations.values())
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds for conversations
  })
}

export function usePrivateMessageConversation(
  userId1: string,
  userId2: string,
  options?: {
    limit?: number
    offset?: number
  },
) {
  return useQuery({
    queryKey: queryKeys.privateMessages.conversation(userId1, userId2),
    queryFn: async () => {
      let query = supabase
        .from('private_messages')
        .select(
          `
          *,
          sender:sender_id (
            id,
            username,
            full_name,
            avatar_url
          ),
          receiver:receiver_id (
            id,
            username,
            full_name,
            avatar_url
          ),
          reply_message:reply_to (
            id,
            message,
            sender_id,
            created_at
          )
        `,
        )
        .or(
          `(sender_id.eq.${userId1},receiver_id.eq.${userId2}),(sender_id.eq.${userId2},receiver_id.eq.${userId1})`,
        )
        .is('deleted_at', null)
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
        PrivateMessage & {
          sender: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
          } | null
          receiver: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
          } | null
          reply_message: {
            id: string
            message: string
            sender_id: string | null
            created_at: string
          } | null
        }
      >
    },
    enabled: !!userId1 && !!userId2,
    staleTime: 30 * 1000, // 30 seconds for conversation messages
  })
}

export function usePrivateMessagesSent(
  senderId: string,
  options?: {
    limit?: number
    offset?: number
  },
) {
  return useQuery({
    queryKey: queryKeys.privateMessages.sent(senderId),
    queryFn: async () => {
      let query = supabase
        .from('private_messages')
        .select(
          `
          *,
          receiver:receiver_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `,
        )
        .eq('sender_id', senderId)
        .is('deleted_at', null)
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
        PrivateMessage & {
          receiver: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
          } | null
        }
      >
    },
    enabled: !!senderId,
    staleTime: 2 * 60 * 1000, // 2 minutes for sent messages
  })
}

export function usePrivateMessagesReceived(
  receiverId: string,
  options?: {
    limit?: number
    offset?: number
  },
) {
  return useQuery({
    queryKey: queryKeys.privateMessages.received(receiverId),
    queryFn: async () => {
      let query = supabase
        .from('private_messages')
        .select(
          `
          *,
          sender:sender_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `,
        )
        .eq('receiver_id', receiverId)
        .is('deleted_at', null)
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
        PrivateMessage & {
          sender: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
          } | null
        }
      >
    },
    enabled: !!receiverId,
    staleTime: 2 * 60 * 1000, // 2 minutes for received messages
  })
}

export function usePrivateMessagesUnread(
  userId: string,
  options?: {
    limit?: number
    offset?: number
  },
) {
  return useQuery({
    queryKey: queryKeys.privateMessages.unread(userId),
    queryFn: async () => {
      let query = supabase
        .from('private_messages')
        .select(
          `
          *,
          sender:sender_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `,
        )
        .eq('receiver_id', userId)
        .is('read_at', null)
        .is('deleted_at', null)
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
        PrivateMessage & {
          sender: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
          } | null
        }
      >
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds for unread messages
  })
}

export function usePrivateMessageUnreadCount(userId: string) {
  return useQuery({
    queryKey: queryKeys.privateMessages.unreadCount(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('private_messages')
        .select('id', { count: 'exact' })
        .eq('receiver_id', userId)
        .is('read_at', null)
        .is('deleted_at', null)

      if (error) throw error
      return data.length || 0
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds for unread count
  })
}

export function usePrivateMessageReplies(messageId: string) {
  return useQuery({
    queryKey: queryKeys.privateMessages.replies(messageId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('private_messages')
        .select(
          `
          *,
          sender:sender_id (
            id,
            username,
            full_name,
            avatar_url
          ),
          receiver:receiver_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `,
        )
        .eq('reply_to', messageId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as Array<
        PrivateMessage & {
          sender: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
          } | null
          receiver: {
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

export function usePrivateMessageSearch(
  searchQuery: string,
  userId?: string,
  options?: {
    limit?: number
  },
) {
  return useQuery({
    queryKey: queryKeys.privateMessages.search(searchQuery, userId),
    queryFn: async () => {
      let query = supabase
        .from('private_messages')
        .select(
          `
          *,
          sender:sender_id (
            id,
            username,
            full_name,
            avatar_url
          ),
          receiver:receiver_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `,
        )
        .ilike('message', `%${searchQuery}%`)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (userId) {
        query = query.or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      }

      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Array<
        PrivateMessage & {
          sender: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
          } | null
          receiver: {
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

// Specialized mutations for private messages
export function useSendPrivateMessage(currentUserId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (messageData: {
      receiver_id: string
      message: string
      message_type?: 'text' | 'image' | 'file' | 'location'
      attachment_url?: string
      attachment_type?: string
      reply_to?: string
    }) => {
      const { data, error } = await supabase
        .from('private_messages')
        .insert({
          receiver_id: messageData.receiver_id,
          message: messageData.message,
          message_type: messageData.message_type || 'text',
          attachment_url: messageData.attachment_url,
          attachment_type: messageData.attachment_type,
          reply_to: messageData.reply_to,
          // sender_id will be automatically set by RLS policy using auth.uid()
        })
        .select(
          `
          *,
          sender:sender_id (
            id,
            username,
            full_name,
            avatar_url
          ),
          receiver:receiver_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `,
        )
        .single()

      if (error) throw error
      return data as PrivateMessage & {
        sender: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
        } | null
        receiver: {
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
        queryKey: queryKeys.privateMessages.conversation(
          currentUserId,
          newMessage.receiver_id,
        ),
      })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<Array<PrivateMessage>>(
        queryKeys.privateMessages.conversation(
          currentUserId,
          newMessage.receiver_id,
        ),
      )

      // Optimistically add the new message
      const optimisticMessage: PrivateMessage = {
        receiver_id: newMessage.receiver_id,
        message: newMessage.message,
        message_type: newMessage.message_type || 'text',
        attachment_url: newMessage.attachment_url,
        attachment_type: newMessage.attachment_type,
        reply_to: newMessage.reply_to,
        id: `temp-${Date.now()}`,
        sender_id: currentUserId, // Will be set by RLS
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        read_at: null,
        deleted_at: null,
        is_edited: false,
      } as PrivateMessage

      queryClient.setQueryData<Array<PrivateMessage>>(
        queryKeys.privateMessages.conversation(
          currentUserId,
          newMessage.receiver_id,
        ),
        (old = []) => [...old, optimisticMessage],
      )

      return { previousData }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.privateMessages.conversation(
            currentUserId,
            variables.receiver_id,
          ),
          context.previousData,
        )
      }
      handleMutationError(error, 'create')
    },
    onSettled: (_data, _error, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: queryKeys.privateMessages.conversation(
          currentUserId,
          variables.receiver_id,
        ),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.privateMessages.conversations(currentUserId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.privateMessages.unreadCount(variables.receiver_id),
      })
    },
  })
}

export function useMarkMessageAsRead(currentUserId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (messageId: string) => {
      const { data, error } = await supabase
        .from('private_messages')
        .update({
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', messageId)
        // RLS will automatically ensure user can only mark their received messages as read
        .select()
        .single()

      if (error) throw error
      return data as PrivateMessage
    },
    onMutate: async (messageId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.privateMessages.lists(),
      })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<Array<PrivateMessage>>(
        queryKeys.privateMessages.lists(),
      )

      // Optimistically mark as read
      queryClient.setQueryData<Array<PrivateMessage>>(
        queryKeys.privateMessages.lists(),
        (old = []) =>
          old.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  read_at: new Date().toISOString(),
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
          queryKeys.privateMessages.lists(),
          context.previousData,
        )
      }
      handleMutationError(error, 'update')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: queryKeys.privateMessages.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.privateMessages.unread(currentUserId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.privateMessages.unreadCount(currentUserId),
      })
    },
    onSuccess: (data) => {
      // Update the detail cache
      queryClient.setQueryData(queryKeys.privateMessages.detail(data.id), data)
    },
  })
}

export function useMarkConversationAsRead(currentUserId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (otherUserId: string) => {
      const { data, error } = await supabase
        .from('private_messages')
        .update({
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('sender_id', otherUserId)
        .is('read_at', null)
        .is('deleted_at', null)
        // RLS will automatically ensure user can only mark their received messages as read
        .select()

      if (error) throw error
      return data as Array<PrivateMessage>
    },
    onSettled: (_data, _error, otherUserId) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: queryKeys.privateMessages.conversation(
          currentUserId,
          otherUserId,
        ),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.privateMessages.conversations(currentUserId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.privateMessages.unread(currentUserId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.privateMessages.unreadCount(currentUserId),
      })
    },
  })
}

export function useDeletePrivateMessage(currentUserId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('private_messages')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', messageId)
      // RLS will automatically ensure user can only delete their own messages
      if (error) throw error
      return messageId
    },
    onMutate: async (messageId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.privateMessages.lists(),
      })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<Array<PrivateMessage>>(
        queryKeys.privateMessages.lists(),
      )

      // Optimistically remove the message
      queryClient.setQueryData<Array<PrivateMessage>>(
        queryKeys.privateMessages.lists(),
        (old = []) => old.filter((message) => message.id !== messageId),
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.privateMessages.lists(),
          context.previousData,
        )
      }
      handleMutationError(error, 'delete')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: queryKeys.privateMessages.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.privateMessages.conversations(currentUserId),
      })
    },
    onSuccess: (deletedId) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: queryKeys.privateMessages.detail(deletedId),
      })
    },
  })
}

export function useDeleteConversation(currentUserId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (otherUserId: string) => {
      const { error } = await supabase
        .from('private_messages')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .or(
          `(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId}),(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId})`,
        )
        .is('deleted_at', null)
      // RLS will automatically ensure user can only delete their side of the conversation
      if (error) throw error
      return otherUserId
    },
    onSettled: (_data, _error, otherUserId) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: queryKeys.privateMessages.conversation(
          currentUserId,
          otherUserId,
        ),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.privateMessages.conversations(currentUserId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.privateMessages.lists(),
      })
    },
  })
}
