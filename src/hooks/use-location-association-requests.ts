// Location Association Requests CRUD hooks with trigger-aware operations
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/query-keys'
import { handleMutationError } from '../lib/crud/error-handling'
import { locationAssociationRequestService } from '../services/location-association-request.service'

/**
 * Hook for getting the owner of a location
 */
export function useLocationOwner(locationId: string) {
  return useQuery({
    queryKey: ['location-owner', locationId],
    queryFn: () =>
      locationAssociationRequestService.getLocationOwner(locationId),
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
    queryFn: () =>
      locationAssociationRequestService.getPendingRequestsForApprover(
        approverId,
      ),
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
    queryFn: () =>
      locationAssociationRequestService.getRequestsByLocation(
        locationId,
        userId,
      ),
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
    mutationFn: ({ id, approverId }: { id: number; approverId: string }) =>
      locationAssociationRequestService.approveRequest(id, approverId),
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.locationAssociationRequests.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.locationAssociationRequests.pending(),
      })
      // Also invalidate locations and profile associations since triggers may have created them
      queryClient.invalidateQueries({ queryKey: queryKeys.locations.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.lists() })
    },
    onError: (error) => handleMutationError(error, 'update'),
  })
}

/**
 * Hook for rejecting a location association request
 * RLS: Only approvers can update their requests
 */
export function useRejectLocationAssociationRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, approverId }: { id: number; approverId: string }) =>
      locationAssociationRequestService.rejectRequest(id, approverId),
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.locationAssociationRequests.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.locationAssociationRequests.pending(),
      })
    },
    onError: (error) => handleMutationError(error, 'update'),
  })
}

/**
 * Hook for creating a new location association request
 * RLS: Only requesters can create requests, approver must be location owner
 */
export function useCreateLocationAssociationRequestWithValidation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (newRequest: {
      requester_id: string
      location_id: string
      approver_id: string
    }) =>
      locationAssociationRequestService.createRequestWithValidation(newRequest),
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.locationAssociationRequests.lists(),
      })
    },
    onError: (error) => handleMutationError(error, 'create'),
  })
}
