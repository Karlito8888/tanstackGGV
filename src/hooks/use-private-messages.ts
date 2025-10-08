// Private Messages CRUD hooks with mobile-first optimizations
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/query-keys'
import { handleMutationError } from '../lib/crud/error-handling'
import { PrivateMessageService } from '../services/private-message.service'
import type { Row } from '../lib/database-types'

type PrivateMessage = Row<'private_messages'>

const privateMessageService = new PrivateMessageService()

// Create base CRUD hooks for private_messages using PrivateMessageService
export const usePrivateMessageList = (filters?: any) => {
  return useQuery({
    queryKey: queryKeys.privateMessages.list(filters),
    queryFn: () =>
      privateMessageService.getConversations('currentUserId', filters), // This needs current user ID
  })
}

export const usePrivateMessageById = (id?: string) => {
  return useQuery({
    queryKey: queryKeys.privateMessages.detail(id || ''),
    queryFn: () => privateMessageService.getMessageReplies(id!), // This might need adjustment
    enabled: !!id,
  })
}

export const usePrivateMessageCreate = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: any) => privateMessageService.sendMessage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.privateMessages.lists(),
      })
    },
    onError: (error) => handleMutationError(error, 'create'),
  })
}

export const usePrivateMessageUpdate = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: any) => privateMessageService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.privateMessages.lists(),
      })
    },
    onError: (error) => handleMutationError(error, 'update'),
  })
}

export const usePrivateMessageDelete = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => privateMessageService.deleteMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.privateMessages.lists(),
      })
    },
    onError: (error) => handleMutationError(error, 'delete'),
  })
}

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
    queryFn: () => privateMessageService.getConversations(userId, options),
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
    queryFn: () =>
      privateMessageService.getConversation(userId1, userId2, options),
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
    queryFn: () => privateMessageService.getSentMessages(senderId, options),
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
    queryFn: () =>
      privateMessageService.getReceivedMessages(receiverId, options),
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
    queryFn: () => privateMessageService.getUnreadMessages(userId, options),
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds for unread messages
  })
}

export function usePrivateMessageUnreadCount(userId: string) {
  return useQuery({
    queryKey: queryKeys.privateMessages.unreadCount(userId),
    queryFn: () => privateMessageService.getUnreadCount(userId),
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds for unread count
  })
}

export function usePrivateMessageReplies(messageId: string) {
  return useQuery({
    queryKey: queryKeys.privateMessages.replies(messageId),
    queryFn: () => privateMessageService.getMessageReplies(messageId),
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
    queryFn: () =>
      privateMessageService.searchMessages(searchQuery, userId, options?.limit),
    enabled: !!searchQuery && searchQuery.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes for search results
  })
}

// Specialized mutations for private messages
export function useSendPrivateMessage(currentUserId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (messageData: {
      receiver_id: string
      message: string
      message_type?: 'text' | 'image' | 'file' | 'location'
      attachment_url?: string
      attachment_type?: string
      reply_to?: string
    }) => privateMessageService.sendMessage(messageData),
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
    mutationFn: (messageId: string) =>
      privateMessageService.markAsRead(messageId),
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
    mutationFn: (otherUserId: string) =>
      privateMessageService.markConversationAsRead(otherUserId, currentUserId),
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
      await privateMessageService.deleteMessage(messageId)
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
    mutationFn: (otherUserId: string) =>
      privateMessageService.deleteConversation(otherUserId, currentUserId),
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
