/**
 * Location Association Request Service
 *
 * Service layer for location association request operations following the
 * Supabase Services & Hooks pattern.
 */

import { BaseService } from './base.service'
import type { Row } from '../lib/database-types'

type LocationAssociationRequest = Row<'location_association_requests'>

export class LocationAssociationRequestService extends BaseService {
  /**
   * Get pending requests where user is the approver
   */
  async getPendingRequestsForApprover(
    approverId: string,
  ): Promise<Array<LocationAssociationRequest>> {
    this.validateRequired(
      approverId,
      'approverId',
      'LocationAssociationRequestService.getPendingRequestsForApprover',
    )

    const response = await this.supabase
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

    if (response.error) {
      this.handleError(
        response.error,
        'LocationAssociationRequestService.getPendingRequestsForApprover',
      )
    }

    return response.data
  }

  /**
   * Get requests by location
   */
  async getRequestsByLocation(
    locationId: string,
    userId: string,
  ): Promise<Array<LocationAssociationRequest>> {
    this.validateRequired(
      locationId,
      'locationId',
      'LocationAssociationRequestService.getRequestsByLocation',
    )
    this.validateRequired(
      userId,
      'userId',
      'LocationAssociationRequestService.getRequestsByLocation',
    )

    const response = await this.supabase
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

    if (response.error) {
      this.handleError(
        response.error,
        'LocationAssociationRequestService.getRequestsByLocation',
      )
    }

    return response.data
  }

  /**
   * Get the owner of a location
   */
  async getLocationOwner(locationId: string): Promise<string | null> {
    this.validateRequired(
      locationId,
      'locationId',
      'LocationAssociationRequestService.getLocationOwner',
    )

    const response = await this.supabase.rpc('get_location_owner', {
      location_id_param: locationId,
    })

    if (response.error) {
      this.handleError(
        response.error,
        'LocationAssociationRequestService.getLocationOwner',
      )
    }

    return response.data
  }

  /**
   * Approve a location association request
   */
  async approveRequest(
    id: number,
    approverId: string,
  ): Promise<LocationAssociationRequest> {
    this.validateRequired(
      id,
      'id',
      'LocationAssociationRequestService.approveRequest',
    )
    this.validateRequired(
      approverId,
      'approverId',
      'LocationAssociationRequestService.approveRequest',
    )

    const response = await this.supabase
      .from('location_association_requests')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('approver_id', approverId)
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

    if (response.error) {
      this.handleError(
        response.error,
        'LocationAssociationRequestService.approveRequest',
      )
    }

    return response.data
  }

  /**
   * Reject a location association request
   */
  async rejectRequest(
    id: number,
    approverId: string,
  ): Promise<LocationAssociationRequest> {
    this.validateRequired(
      id,
      'id',
      'LocationAssociationRequestService.rejectRequest',
    )
    this.validateRequired(
      approverId,
      'approverId',
      'LocationAssociationRequestService.rejectRequest',
    )

    const response = await this.supabase
      .from('location_association_requests')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('approver_id', approverId)
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

    if (response.error) {
      this.handleError(
        response.error,
        'LocationAssociationRequestService.rejectRequest',
      )
    }

    return response.data
  }

  /**
   * Create a new location association request with validation
   */
  async createRequestWithValidation(requestData: {
    requester_id: string
    location_id: string
    approver_id: string
  }): Promise<LocationAssociationRequest> {
    this.validateRequired(
      requestData.requester_id,
      'requester_id',
      'LocationAssociationRequestService.createRequestWithValidation',
    )
    this.validateRequired(
      requestData.location_id,
      'location_id',
      'LocationAssociationRequestService.createRequestWithValidation',
    )
    this.validateRequired(
      requestData.approver_id,
      'approver_id',
      'LocationAssociationRequestService.createRequestWithValidation',
    )

    // First, verify that the approver is actually the owner of the location
    const ownerId = await this.getLocationOwner(requestData.location_id)

    if (!ownerId) {
      throw new Error('No owner found for this location')
    }

    if (ownerId !== requestData.approver_id) {
      throw new Error(
        'The specified approver is not the owner of this location',
      )
    }

    // Check if request already exists
    const existingResponse = await this.supabase
      .from('location_association_requests')
      .select('*')
      .eq('requester_id', requestData.requester_id)
      .eq('location_id', requestData.location_id)
      .in('status', ['pending', 'approved', 'rejected'])
      .single()

    if (existingResponse.data) {
      if (existingResponse.data.status === 'rejected') {
        throw new Error(
          'Request was previously rejected. Please contact support.',
        )
      } else {
        throw new Error('Request already exists for this location')
      }
    }
    if (existingResponse.error.code !== 'PGRST116') {
      this.handleError(
        existingResponse.error,
        'LocationAssociationRequestService.createRequestWithValidation',
      )
    }

    // Create the request
    const response = await this.supabase
      .from('location_association_requests')
      .insert({
        requester_id: requestData.requester_id,
        location_id: requestData.location_id,
        approver_id: requestData.approver_id,
        status: 'pending',
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

    if (response.error) {
      this.handleError(
        response.error,
        'LocationAssociationRequestService.createRequestWithValidation',
      )
    }

    return response.data
  }
}

export const locationAssociationRequestService =
  new LocationAssociationRequestService()
