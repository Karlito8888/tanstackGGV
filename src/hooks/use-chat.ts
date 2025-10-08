// Chat hooks refactored to use service layer pattern
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/query-keys'
import { handleMutationError } from '../lib/crud/error-handling'
import { chatService } from '../services/chat.service'

// Chat queries refactored to use service layer
export function useChatMessagesByChannel(
  channelId: string,
  options?: {
    limit?: number
    offset?: number
  },
) {
  return useQuery({
    queryKey: queryKeys.chat.byChannel(channelId),
    queryFn: () => chatService.getMessagesByChannel(channelId, options),
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
    queryFn: () => chatService.getMessagesByUser(userId, options),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes for user messages
  })
}

export function useChatReplies(messageId: string) {
  return useQuery({
    queryKey: queryKeys.chat.replies(messageId),
    queryFn: () => chatService.getMessageReplies(messageId),
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
    queryFn: () => chatService.searchMessages(searchQuery, options),
    enabled: !!searchQuery && searchQuery.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes for search results
  })
}

// Specialized mutations refactored to use service layer
export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (messageData: {
      channel_id: string
      content: string
      reply_to?: string
    }) => chatService.sendMessage(messageData),
    onMutate: async (newMessage) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.chat.byChannel(newMessage.channel_id),
      })

      // Snapshot previous state
      const previousData = queryClient.getQueryData(
        queryKeys.chat.byChannel(newMessage.channel_id),
      )

      // Optimistically add the new message
      const optimisticMessage = {
        channel_id: newMessage.channel_id,
        content: newMessage.content,
        reply_to: newMessage.reply_to,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_edited: false,
        user_id: null, // Will be filled by real-time update
        profiles: null, // Will be filled by real-time update
      }

      queryClient.setQueryData(
        queryKeys.chat.byChannel(newMessage.channel_id),
        (old: Array<any> = []) => [...old, optimisticMessage],
      )

      return { previousData, optimisticMessage }
    },
    onError: (_error, variables, context) => {
      // Rollback on error
      if (context && context.previousData) {
        queryClient.setQueryData(
          queryKeys.chat.byChannel(variables.channel_id),
          (old: Array<any> = []) =>
            old.filter(
              (message: any) => message.id !== context.optimisticMessage.id,
            ),
        )
      }
      handleMutationError(_error, 'create')
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
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      chatService.editMessage(id, content),
    onMutate: async ({ id, content }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.chat.lists() })

      // Snapshot previous state
      const previousData = queryClient.getQueryData(queryKeys.chat.lists())

      // Optimistically update the message
      queryClient.setQueryData(queryKeys.chat.lists(), (old: Array<any> = []) =>
        old.map((message: any) =>
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
    mutationFn: (id: string) => chatService.deleteMessage(id).then(() => id),
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.chat.lists() })

      // Snapshot previous state
      const previousData = queryClient.getQueryData(queryKeys.chat.lists())

      // Optimistically remove the message
      queryClient.setQueryData(queryKeys.chat.lists(), (old: Array<any> = []) =>
        old.filter((message: any) => message.id !== id),
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
