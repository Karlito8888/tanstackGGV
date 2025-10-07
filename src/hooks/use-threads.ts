// Threads CRUD hooks with mobile-first optimizations
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/query-keys'
import { createCRUDHooks } from '../lib/crud/create-crud-hooks'
import { handleMutationError } from '../lib/crud/error-handling'
import type { InsertRow, Row, UpdateRow } from '../lib/database-types'

type Thread = Row<'threads'>
type ThreadInsert = InsertRow<'threads'>
type ThreadUpdate = UpdateRow<'threads'>

// Create base CRUD hooks for threads
const threadHooks = createCRUDHooks<'threads'>({
  tableName: 'threads',
  queryKeys: {
    all: queryKeys.threads.all,
    lists: queryKeys.threads.lists,
    list: queryKeys.threads.list,
    details: queryKeys.threads.details,
    detail: queryKeys.threads.detail,
  },
})

// Export only the allowed CRUD hooks from the factory
// UPDATE and DELETE are admin-only via Supabase dashboard
export const useThreadList = threadHooks.useList
export const useThreadById = threadHooks.useById
export const useThreadCreate = threadHooks.useCreate
// Note: UPDATE and DELETE operations are admin-only via Supabase dashboard
// export const useThreadUpdate = threadHooks.useUpdate  // Admin only
// export const useThreadDelete = threadHooks.useDelete  // Admin only

// Thread queries with mobile-first optimizations
export function useThread(id?: string) {
  return useQuery({
    queryKey: queryKeys.threads.detail(id || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('threads')
        .select(
          `
          *,
          creator:created_by (
            id,
            username,
            full_name,
            avatar_url
          ),
          forum:forum_id (
            id,
            title,
            icon
          )
        `,
        )
        .eq('id', id || '')
        .single()

      if (error) throw error
      return data as Thread & {
        creator: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
        } | null
        forum: {
          id: string
          title: string
          icon: string | null
        } | null
      }
    },
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
    queryFn: async () => {
      let query = supabase.from('threads').select(
        `
          *,
          creator:created_by (
            id,
            username,
            full_name,
            avatar_url
          ),
          forum:forum_id (
            id,
            title,
            icon
          )
        `,
        { count: 'exact' },
      )

      // Apply filters
      if (filters?.forumId) {
        query = query.eq('forum_id', filters.forumId)
      }
      if (filters?.creatorId) {
        query = query.eq('created_by', filters.creatorId)
      }
      if (filters?.search) {
        query = query.ilike('title', `%${filters.search}%`)
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
    queryFn: async () => {
      let query = supabase
        .from('threads')
        .select(
          `
          *,
          creator:created_by (
            id,
            username,
            full_name,
            avatar_url
          )
        `,
        )
        .eq('forum_id', forumId)
        .order('created_at', { ascending: false })

      if (options?.limit) {
        query = query.limit(options.limit)
      }
      if (options?.offset) {
        query = query.range(
          options.offset,
          options.offset + (options.limit || 20) - 1,
        )
      }

      const { data, error } = await query
      if (error) throw error
      return data as Array<
        Thread & {
          creator: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
          } | null
        }
      >
    },
    enabled: !!forumId,
    staleTime: 3 * 60 * 1000, // 3 minutes for forum threads (more frequent updates)
  })
}

export function useThreadsByCreator(creatorId: string) {
  return useQuery({
    queryKey: queryKeys.threads.byCreator(creatorId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('threads')
        .select(
          `
          *,
          forum:forum_id (
            id,
            title,
            icon
          )
        `,
        )
        .eq('created_by', creatorId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Array<
        Thread & {
          forum: {
            id: string
            title: string
            icon: string | null
          } | null
        }
      >
    },
    enabled: !!creatorId,
    staleTime: 5 * 60 * 1000, // 5 minutes for creator threads
  })
}

export function useSearchThreads(searchQuery: string) {
  return useQuery({
    queryKey: queryKeys.threads.search(searchQuery),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('threads')
        .select(
          `
          *,
          creator:created_by (
            id,
            username,
            full_name,
            avatar_url
          ),
          forum:forum_id (
            id,
            title,
            icon
          )
        `,
        )
        .ilike('title', `%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(20) // Limit search results for mobile performance

      if (error) throw error
      return data as Array<
        Thread & {
          creator: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
          } | null
          forum: {
            id: string
            title: string
            icon: string | null
          } | null
        }
      >
    },
    enabled: !!searchQuery && searchQuery.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes for search results
  })
}

// Specialized mutations for threads
export function useCreateThread() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (threadData: ThreadInsert) => {
      const { data, error } = await supabase
        .from('threads')
        .insert(threadData)
        .select(
          `
          *,
          creator:created_by (
            id,
            username,
            full_name,
            avatar_url
          ),
          forum:forum_id (
            id,
            title,
            icon
          )
        `,
        )
        .single()

      if (error) throw error
      return data as Thread & {
        creator: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
        } | null
        forum: {
          id: string
          title: string
          icon: string | null
        } | null
      }
    },
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
    mutationFn: async ({
      id,
      ...updateData
    }: ThreadUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('threads')
        .update(updateData)
        .eq('id', id)
        .select(
          `
          *,
          creator:created_by (
            id,
            username,
            full_name,
            avatar_url
          ),
          forum:forum_id (
            id,
            title,
            icon
          )
        `,
        )
        .single()

      if (error) throw error
      return data as Thread & {
        creator: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
        } | null
        forum: {
          id: string
          title: string
          icon: string | null
        } | null
      }
    },
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
      const { error } = await supabase.from('threads').delete().eq('id', id)
      if (error) throw error
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
