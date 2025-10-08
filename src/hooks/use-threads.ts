// Threads CRUD hooks with mobile-first optimizations
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/query-keys'
import { handleMutationError } from '../lib/crud/error-handling'
import { ThreadService } from '../services/thread.service'
import type { InsertRow, Row, UpdateRow } from '../lib/database-types'

type Thread = Row<'threads'>
type ThreadInsert = InsertRow<'threads'>
type ThreadUpdate = UpdateRow<'threads'>

const threadService = new ThreadService()

// Create base CRUD hooks for threads using ThreadService
export const useThreadList = (filters?: any) => {
  return useQuery({
    queryKey: queryKeys.threads.list(filters),
    queryFn: () => threadService.getThreads(filters),
  })
}

export const useThreadById = (id?: string) => {
  return useQuery({
    queryKey: queryKeys.threads.detail(id || ''),
    queryFn: () => threadService.getThread(id!),
    enabled: !!id,
  })
}

export const useThreadCreate = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ThreadInsert) => threadService.createThread(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.lists() })
      queryClient.setQueryData(queryKeys.threads.detail(data.id), data)
    },
    onError: (error) => handleMutationError(error, 'create'),
  })
}

// Note: UPDATE and DELETE operations are admin-only via Supabase dashboard
// export const useThreadUpdate = threadHooks.useUpdate  // Admin only
// export const useThreadDelete = threadHooks.useDelete  // Admin only

// Thread queries with mobile-first optimizations
export function useThread(id?: string) {
  return useQuery({
    queryKey: queryKeys.threads.detail(id || ''),
    queryFn: () => threadService.getThread(id!),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes for thread data
  })
}

export function useThreadsList(filters?: {
  forumId?: string
  creatorId?: string
  search?: string
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: queryKeys.threads.list(filters),
    queryFn: () => threadService.getThreads(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes for thread lists
  })
}

export function useThreadsByForum(
  forumId: string,
  options?: {
    limit?: number
    offset?: number
  },
) {
  return useQuery({
    queryKey: queryKeys.threads.byForum(forumId),
    queryFn: () => threadService.getThreadsByForum(forumId, options),
    enabled: !!forumId,
    staleTime: 3 * 60 * 1000, // 3 minutes for forum threads (more frequent updates)
  })
}

export function useThreadsByCreator(creatorId: string) {
  return useQuery({
    queryKey: queryKeys.threads.byCreator(creatorId),
    queryFn: () => threadService.getThreadsByCreator(creatorId),
    enabled: !!creatorId,
    staleTime: 5 * 60 * 1000, // 5 minutes for creator threads
  })
}

export function useSearchThreads(searchQuery: string) {
  return useQuery({
    queryKey: queryKeys.threads.search(searchQuery),
    queryFn: () => threadService.searchThreads(searchQuery),
    enabled: !!searchQuery && searchQuery.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes for search results
  })
}

// Specialized mutations for threads
export function useCreateThread() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (threadData: ThreadInsert) =>
      threadService.createThread(threadData),
    onMutate: async (newData: ThreadInsert) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.lists() })

      // Also cancel forum-specific queries if forum_id is provided
      if (newData.forum_id) {
        await queryClient.cancelQueries({
          queryKey: queryKeys.threads.byForum(newData.forum_id),
        })
      }

      // Snapshot previous state
      const previousData = queryClient.getQueryData<Array<Thread>>(
        queryKeys.threads.lists(),
      )

      // Optimistically add the new thread
      const optimisticThread: Thread = {
        ...newData,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
      } as Thread

      queryClient.setQueryData<Array<Thread>>(
        queryKeys.threads.lists(),
        (old = []) => [...old, optimisticThread],
      )

      // Also update forum-specific cache
      if (newData.forum_id) {
        queryClient.setQueryData<Array<Thread>>(
          queryKeys.threads.byForum(newData.forum_id),
          (old = []) => [optimisticThread, ...old],
        )
      }

      return { previousData }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.threads.lists(),
          context.previousData,
        )
      }
      handleMutationError(error, 'create')
    },
    onSettled: (_data, _error, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.lists() })

      // Also invalidate forum-specific queries
      if (variables.forum_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.threads.byForum(variables.forum_id),
        })
      }
    },
    onSuccess: (data) => {
      // Update the detail cache with the real data
      queryClient.setQueryData(queryKeys.threads.detail(data.id), data)
    },
  })
}

export function useUpdateThread() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...updateData }: ThreadUpdate & { id: string }) =>
      threadService.updateThread(id, updateData),
    onMutate: async (variables: ThreadUpdate & { id: string }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.lists() })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<Array<Thread>>(
        queryKeys.threads.lists(),
      )

      // Optimistically update the thread
      queryClient.setQueryData<Array<Thread>>(
        queryKeys.threads.lists(),
        (old = []) =>
          old.map((thread) =>
            thread.id === variables.id ? { ...thread, ...variables } : thread,
          ),
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.threads.lists(),
          context.previousData,
        )
      }
      handleMutationError(error, 'update')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.lists() })
    },
    onSuccess: (data) => {
      // Update the detail cache
      queryClient.setQueryData(queryKeys.threads.detail(data.id), data)
    },
  })
}

export function useDeleteThread() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await threadService.deleteThread(id)
      return id
    },
    onMutate: async (id: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.lists() })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<Array<Thread>>(
        queryKeys.threads.lists(),
      )

      // Optimistically remove the thread
      queryClient.setQueryData<Array<Thread>>(
        queryKeys.threads.lists(),
        (old = []) => old.filter((thread) => thread.id !== id),
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.threads.lists(),
          context.previousData,
        )
      }
      handleMutationError(error, 'delete')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.lists() })
    },
    onSuccess: (deletedId) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: queryKeys.threads.detail(deletedId),
      })
    },
  })
}
