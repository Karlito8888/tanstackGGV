// Forums hooks refactored to use service layer pattern
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/query-keys'
import { handleMutationError } from '../lib/crud/error-handling'
import { forumService } from '../services/forum.service'
import type { InsertRow } from '../lib/database-types'

type ForumInsert = InsertRow<'forums'>

// Forum queries refactored to use service layer
export function useForum(id?: string) {
  return useQuery({
    queryKey: queryKeys.forums.detail(id || ''),
    queryFn: () => forumService.getForum(id || ''),
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
    queryFn: () => forumService.getForumsList(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes for forum lists
  })
}

export function useForumsByCreator(creatorId: string) {
  return useQuery({
    queryKey: queryKeys.forums.byCreator(creatorId),
    queryFn: () => forumService.getForumsByCreator(creatorId),
    enabled: !!creatorId,
    staleTime: 5 * 60 * 1000, // 5 minutes for creator forums
  })
}

export function useSearchForums(searchQuery: string) {
  return useQuery({
    queryKey: queryKeys.forums.search(searchQuery),
    queryFn: () => forumService.searchForums(searchQuery),
    enabled: !!searchQuery && searchQuery.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes for search results
  })
}

// Specialized mutations refactored to use service layer
export function useCreateForum() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (forumData: ForumInsert) => forumService.createForum(forumData),
    onMutate: async (newData: ForumInsert) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.forums.lists() })

      // Snapshot previous state
      const previousData = queryClient.getQueryData(queryKeys.forums.lists())

      // Optimistically add the new forum
      const optimisticForum = {
        ...newData,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        creator: null, // Will be filled by service
      }

      queryClient.setQueryData(queryKeys.forums.lists(), (old: any = {}) => ({
        ...old,
        data: [optimisticForum, ...(old.data || [])],
      }))

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

// Admin-only operations: UPDATE and DELETE are restricted by RLS policies
// These operations can only be performed by users with admin privileges
// or through direct database access for emergency situations
