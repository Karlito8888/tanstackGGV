// Forums CRUD hooks with mobile-first optimizations
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/query-keys'
import { createCRUDHooks } from '../lib/crud/create-crud-hooks'
import { handleMutationError } from '../lib/crud/error-handling'
import type { InsertRow, Row } from '../lib/database-types'

type Forum = Row<'forums'>
type ForumInsert = InsertRow<'forums'>

// Create base CRUD hooks for forums
const forumHooks = createCRUDHooks<'forums'>({
  tableName: 'forums',
  queryKeys: {
    all: queryKeys.forums.all,
    lists: queryKeys.forums.lists,
    list: queryKeys.forums.list,
    details: queryKeys.forums.details,
    detail: queryKeys.forums.detail,
  },
})

// Export only the allowed CRUD hooks from the factory
// UPDATE and DELETE are admin-only via Supabase dashboard
export const useForumList = forumHooks.useList
export const useForumById = forumHooks.useById
export const useForumCreate = forumHooks.useCreate
// Note: UPDATE and DELETE operations are admin-only via Supabase dashboard
// export const useForumUpdate = forumHooks.useUpdate  // Admin only
// export const useForumDelete = forumHooks.useDelete  // Admin only

// Forum queries with mobile-first optimizations
export function useForum(id?: string) {
  return useQuery({
    queryKey: queryKeys.forums.detail(id || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forums')
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
        .eq('id', id || '')
        .single()

      if (error) throw error
      return data as Forum & {
        creator: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
        } | null
      }
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes for forum data
  })
}

export function useForumsList(filters?: {
  creatorId?: string
  search?: string
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: queryKeys.forums.list(filters),
    queryFn: async () => {
      let query = supabase.from('forums').select(
        `
          *,
          creator:created_by (
            id,
            username,
            full_name,
            avatar_url
          ),
          threads_count:threads(count)
        `,
        { count: 'exact' },
      )

      // Apply filters
      if (filters?.creatorId) {
        query = query.eq('created_by', filters.creatorId)
      }
      if (filters?.search) {
        query = query.or(
          `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`,
        )
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
    staleTime: 5 * 60 * 1000, // 5 minutes for forum lists
  })
}

export function useForumsByCreator(creatorId: string) {
  return useQuery({
    queryKey: queryKeys.forums.byCreator(creatorId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forums')
        .select(
          `
          *,
          threads_count:threads(count)
        `,
        )
        .eq('created_by', creatorId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Array<Forum & { threads_count: number }>
    },
    enabled: !!creatorId,
    staleTime: 5 * 60 * 1000, // 5 minutes for creator forums
  })
}

export function useSearchForums(searchQuery: string) {
  return useQuery({
    queryKey: queryKeys.forums.search(searchQuery),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forums')
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
        .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(20) // Limit search results for mobile performance

      if (error) throw error
      return data as Array<
        Forum & {
          creator: {
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

// Specialized mutations for forums
export function useCreateForum() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (forumData: ForumInsert) => {
      const { data, error } = await supabase
        .from('forums')
        .insert(forumData)
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
        .single()

      if (error) throw error
      return data as Forum & {
        creator: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
        } | null
      }
    },
    onMutate: async (newData: ForumInsert) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.forums.lists() })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<Array<Forum>>(
        queryKeys.forums.lists(),
      )

      // Optimistically add the new forum
      const optimisticForum: Forum = {
        ...newData,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
      } as Forum

      queryClient.setQueryData<Array<Forum>>(
        queryKeys.forums.lists(),
        (old = []) => [...old, optimisticForum],
      )

      return { previousData }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.forums.lists(), context.previousData)
      }
      handleMutationError(error, 'create')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.forums.lists() })
    },
    onSuccess: (data) => {
      // Update the detail cache with the real data
      queryClient.setQueryData(queryKeys.forums.detail(data.id), data)
    },
  })
}

// Admin-only operations: UPDATE and DELETE are handled via Supabase dashboard
// This follows the RLS policies where only SELECT and INSERT are allowed for users
// Admin can directly modify/delete forums and threads in Supabase dashboard when needed
