// Location Association Requests CRUD hooks with trigger-aware operations
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/query-keys'
import { createCRUDHooks } from '../lib/crud/create-crud-hooks'
import { handleMutationError } from '../lib/crud/error-handling'
import type { Database, TableName } from '../lib/database-types'

type LocationAssociationRequest = Database['location_association_requests']

// Create base CRUD hooks for location association requests
const locationAssociationRequestCRUD = createCRUDHooks<TableName>({
  tableName: 'location_association_requests',
  queryKeys: {
    all: queryKeys.locationAssociationRequests.all,
    lists: queryKeys.locationAssociationRequests.lists,
    list: queryKeys.locationAssociationRequests.list,
    details: queryKeys.locationAssociationRequests.details,
    detail: queryKeys.locationAssociationRequests.detail,
  },
})

// Export basic CRUD hooks from the factory
export const useLocationAssociationRequestsList =
  locationAssociationRequestCRUD.useList
export const useLocationAssociationRequest =
  locationAssociationRequestCRUD.useById
export const useCreateLocationAssociationRequest =
  locationAssociationRequestCRUD.useCreate
export const useUpdateLocationAssociationRequest =
  locationAssociationRequestCRUD.useUpdate
export const useDeleteLocationAssociationRequest =
  locationAssociationRequestCRUD.useDelete

/**
 * Hook for getting the owner of a location
 */
export function useLocationOwner(locationId: string) {
  return useQuery({
    queryKey: ['location-owner', locationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_location_owner', {
        location_id: locationId,
      })

      if (error) throw error
      return data as string | null
    },
    enabled: !!locationId,
    staleTime: 10 * 60 * 1000, // 10 minutes - location ownership doesn't change often
  })
}

/**
 * Hook for fetching pending requests where user is the approver
 * RLS: Only approvers can read their requests
 */
export function usePendingLocationAssociationRequests(approverId: string) {
  return useQuery({
    queryKey: queryKeys.locationAssociationRequests.pending(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('location_association_requests')
        .select(
          `
          *,
          requester:profiles!location_association_requests_requester_id_fkey(
            id, username, full_name, avatar_url
          ),
          location:locations(
            id, block, lot
          ),
          approver:profiles!location_association_requests_approver_id_fkey(
            id, username, full_name, avatar_url
          )
        `,
        )
        .eq('status', 'pending')
        .eq('approver_id', approverId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Array<
        LocationAssociationRequest & {
          requester: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
          }
          location: { id: string; block: string; lot: string }
          approver: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
          } | null
        }
      >
    },
    enabled: !!approverId,
    staleTime: 2 * 60 * 1000, // 2 minutes for pending requests
  })
}

// REMOVED: useLocationAssociationRequestsByRequester
// This hook was removed because it doesn't align with the new RLS policies
// where only approvers can read location association requests

/**
 * Hook for fetching requests by location (for requesters and approvers)
 */
export function useLocationAssociationRequestsByLocation(
  locationId: string,
  userId: string,
) {
  return useQuery({
    queryKey: queryKeys.locationAssociationRequests.byLocation(locationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('location_association_requests')
        .select(
          `
          *,
          requester:profiles!location_association_requests_requester_id_fkey(
            id, username, full_name, avatar_url
          ),
          approver:profiles!location_association_requests_approver_id_fkey(
            id, username, full_name, avatar_url
          )
        `,
        )
        .eq('location_id', locationId)
        .or(`requester_id.eq.${userId},approver_id.eq.${userId}`)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Array<
        LocationAssociationRequest & {
          requester: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
          }
          approver: {
            id: string
            username: string | null
            full_name: string | null
            avatar_url: string | null
          } | null
        }
      >
    },
    enabled: !!locationId && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes for location requests
  })
}

/**
 * Hook for approving a location association request
 * RLS: Only approvers can update their requests
 * This will trigger the database function that creates the profile_location_association
 */
export function useApproveLocationAssociationRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      approverId,
    }: {
      id: number
      approverId: string
    }) => {
      const { data, error } = await supabase
        .from('location_association_requests')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('approver_id', approverId) // RLS: Only approver can update
        .select(
          `
          *,
          requester:profiles!location_association_requests_requester_id_fkey(
            id, username, full_name, avatar_url
          ),
          location:locations(
            id, block, lot
          )
        `,
        )
        .single()

      if (error) throw error
      return data as LocationAssociationRequest & {
        requester: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
        }
        location: { id: string; block: string; lot: string }
      }
    },
    onMutate: async ({ id, approverId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.locationAssociationRequests.lists(),
      })
      await queryClient.cancelQueries({
        queryKey: queryKeys.locationAssociationRequests.pending(),
      })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<
        Array<LocationAssociationRequest>
      >(queryKeys.locationAssociationRequests.lists())
      const previousPending = queryClient.getQueryData<
        Array<LocationAssociationRequest>
      >(queryKeys.locationAssociationRequests.pending())

      // Optimistically update the request
      const updateRequest = (
        old: Array<LocationAssociationRequest> | undefined,
      ) =>
        (old || []).map((request) =>
          request.id === id
            ? {
                ...request,
                status: 'approved' as const,
                approver_id: approverId,
                approved_at: new Date().toISOString(),
              }
            : request,
        )

      queryClient.setQueryData(
        queryKeys.locationAssociationRequests.lists(),
        updateRequest,
      )
      queryClient.setQueryData(
        queryKeys.locationAssociationRequests.pending(),
        updateRequest,
      )

      return { previousData, previousPending }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.locationAssociationRequests.lists(),
          context.previousData,
        )
      }
      if (context?.previousPending) {
        queryClient.setQueryData(
          queryKeys.locationAssociationRequests.pending(),
          context.previousPending,
        )
      }
      handleMutationError(error, 'update')
    },
    onSettled: (_data, _error, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: queryKeys.locationAssociationRequests.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.locationAssociationRequests.pending(),
      })
      // Invalidate approver's requests cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.locationAssociationRequests.byRequester(
          variables.approverId,
        ),
      })
      // Also invalidate locations and profile associations since triggers may have created them
      queryClient.invalidateQueries({ queryKey: queryKeys.locations.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.lists() })
    },
  })
}

/**
 * Hook for rejecting a location association request
 * RLS: Only approvers can update their requests
 */
export function useRejectLocationAssociationRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      approverId,
    }: {
      id: number
      approverId: string
    }) => {
      const { data, error } = await supabase
        .from('location_association_requests')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('approver_id', approverId) // RLS: Only approver can update
        .select(
          `
          *,
          requester:profiles!location_association_requests_requester_id_fkey(
            id, username, full_name, avatar_url
          ),
          location:locations(
            id, block, lot
          )
        `,
        )
        .single()

      if (error) throw error
      return data as LocationAssociationRequest & {
        requester: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
        }
        location: { id: string; block: string; lot: string }
      }
    },
    onMutate: async ({ id, approverId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.locationAssociationRequests.lists(),
      })
      await queryClient.cancelQueries({
        queryKey: queryKeys.locationAssociationRequests.pending(),
      })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<
        Array<LocationAssociationRequest>
      >(queryKeys.locationAssociationRequests.lists())
      const previousPending = queryClient.getQueryData<
        Array<LocationAssociationRequest>
      >(queryKeys.locationAssociationRequests.pending())

      // Optimistically update the request
      const updateRequest = (
        old: Array<LocationAssociationRequest> | undefined,
      ) =>
        (old || []).map((request) =>
          request.id === id
            ? {
                ...request,
                status: 'rejected' as const,
                approver_id: approverId,
                rejected_at: new Date().toISOString(),
              }
            : request,
        )

      queryClient.setQueryData(
        queryKeys.locationAssociationRequests.lists(),
        updateRequest,
      )
      queryClient.setQueryData(
        queryKeys.locationAssociationRequests.pending(),
        updateRequest,
      )

      return { previousData, previousPending }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.locationAssociationRequests.lists(),
          context.previousData,
        )
      }
      if (context?.previousPending) {
        queryClient.setQueryData(
          queryKeys.locationAssociationRequests.pending(),
          context.previousPending,
        )
      }
      handleMutationError(error, 'update')
    },
    onSettled: (_data, _error, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: queryKeys.locationAssociationRequests.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.locationAssociationRequests.pending(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.locationAssociationRequests.byRequester(
          variables.approverId,
        ),
      })
    },
  })
}

/**
 * Hook for creating a new location association request
 * RLS: Only requesters can create requests, approver must be location owner
 */
export function useCreateLocationAssociationRequestWithValidation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newRequest: {
      requester_id: string
      location_id: string
      approver_id: string
    }) => {
      // First, verify that the approver is actually the owner of the location
      const { data: ownerData, error: ownerError } = await supabase.rpc(
        'get_location_owner',
        { location_id: newRequest.location_id },
      )

      if (ownerError) throw ownerError

      if (!ownerData) {
        throw new Error('No owner found for this location')
      }

      if (ownerData !== newRequest.approver_id) {
        throw new Error(
          'The specified approver is not the owner of this location',
        )
      }

      // Check if request already exists (including rejected to prevent spam)
      const { data: existingRequest, error: checkError } = await supabase
        .from('location_association_requests')
        .select('*')
        .eq('requester_id', newRequest.requester_id)
        .eq('location_id', newRequest.location_id)
        .in('status', ['pending', 'approved', 'rejected'])
        .single()

      if (existingRequest) {
        if (existingRequest.status === 'rejected') {
          throw new Error(
            'Request was previously rejected. Please contact support.',
          )
        } else {
          throw new Error('Request already exists for this location')
        }
      }
      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 = no rows returned
        throw checkError
      }

      // Create the request with proper approver validation
      const { data, error } = await supabase
        .from('location_association_requests')
        .insert({
          requester_id: newRequest.requester_id,
          location_id: newRequest.location_id,
          approver_id: newRequest.approver_id,
        })
        .select(
          `
          *,
          location:locations(
            id, block, lot
          )
        `,
        )
        .single()

      if (error) throw error
      return data as LocationAssociationRequest & {
        location: { id: string; block: string; lot: string }
      }
    },
    onMutate: async (newRequest) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.locationAssociationRequests.lists(),
      })
      await queryClient.cancelQueries({
        queryKey: queryKeys.locationAssociationRequests.byRequester(
          newRequest.requester_id,
        ),
      })

      // Snapshot previous state
      const previousData = queryClient.getQueryData<
        Array<LocationAssociationRequest>
      >(queryKeys.locationAssociationRequests.lists())
      const previousUserRequests = queryClient.getQueryData<
        Array<LocationAssociationRequest>
      >(
        queryKeys.locationAssociationRequests.byRequester(
          newRequest.requester_id,
        ),
      )

      // Optimistically add the new request
      const optimisticRequest: LocationAssociationRequest = {
        ...newRequest,
        id: Date.now(), // temporary ID
        status: 'pending',
        approver_id: null,
        created_at: new Date().toISOString(),
        approved_at: null,
        rejected_at: null,
      } as LocationAssociationRequest

      const addRequest = (
        old: Array<LocationAssociationRequest> | undefined,
      ) => [...(old || []), optimisticRequest]

      queryClient.setQueryData(
        queryKeys.locationAssociationRequests.lists(),
        addRequest,
      )
      queryClient.setQueryData(
        queryKeys.locationAssociationRequests.byRequester(
          newRequest.requester_id,
        ),
        addRequest,
      )

      return { previousData, previousUserRequests }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.locationAssociationRequests.lists(),
          context.previousData,
        )
      }
      if (context?.previousUserRequests) {
        queryClient.setQueryData(
          queryKeys.locationAssociationRequests.byRequester(
            _variables.requester_id,
          ),
          context.previousUserRequests,
        )
      }
      handleMutationError(error, 'create')
    },
    onSettled: (_data, _error, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: queryKeys.locationAssociationRequests.lists(),
      })
      // Invalidate requester's requests cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.locationAssociationRequests.byRequester(
          variables.requester_id,
        ),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.locationAssociationRequests.byLocation(
          variables.location_id,
        ),
      })
    },
  })
}
