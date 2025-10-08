/**
 * Profile Location Association Service
 *
 * Service layer for profile location association operations following the
 * Supabase Services & Hooks pattern.
 *
 * This service encapsulates:
 * - CRUD operations for profile_location_associations
 * - Association queries and filtering
 * - Ownership and verification management
 * - Location-based user associations
 * - Type-safe operations with proper error handling
 */

import { BaseService } from './base.service'
import type { InsertRow, Row, UpdateRow } from '../lib/database-types'

// Type aliases for better readability
type ProfileLocationAssociation = Row<'profile_location_associations'>
type ProfileLocationAssociationInsert =
  InsertRow<'profile_location_associations'>
type ProfileLocationAssociationUpdate =
  UpdateRow<'profile_location_associations'>

// Additional types for complex operations
export interface AssociationFilters {
  profileId?: string
  locationId?: string
  isVerified?: boolean
  isOwner?: boolean
  limit?: number
  offset?: number
}

export interface AssociationListResult {
  data: Array<ProfileLocationAssociation>
  count: number | null
}

export interface AssociationWithDetails extends ProfileLocationAssociation {
  profiles: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
  locations: {
    id: string
    block: string
    lot: string
    coordinates: any
    is_locked: boolean | null
  } | null
}

export interface LocationAssignmentInfo {
  assigned: boolean
  location_id: string | null
  block: string | null
  lot: string | null
  message: string
}

export class ProfileLocationAssociationService extends BaseService {
  // ==================== BASIC CRUD OPERATIONS ====================

  /**
   * Get a profile location association by ID
   */
  async getAssociation(id: number): Promise<ProfileLocationAssociation | null> {
    this.validateRequired(
      id,
      'id',
      'ProfileLocationAssociationService.getAssociation',
    )

    const response = await this.supabase
      .from('profile_location_associations')
      .select('*')
      .eq('id', id)
      .single()

    return this.handleOptionalResponse(
      response,
      'ProfileLocationAssociationService.getAssociation',
    )
  }

  /**
   * Get profile location associations list with filters and pagination
   */
  async getAssociationsList(
    filters?: AssociationFilters,
  ): Promise<AssociationListResult> {
    let query = this.supabase
      .from('profile_location_associations')
      .select('*', { count: 'exact' })

    // Apply filters
    if (filters?.profileId) {
      query = query.eq('profile_id', filters.profileId)
    }
    if (filters?.locationId) {
      query = query.eq('location_id', filters.locationId)
    }
    if (filters?.isVerified !== undefined) {
      query = query.eq('is_verified', filters.isVerified)
    }
    if (filters?.isOwner !== undefined) {
      query = query.eq('is_owner', filters.isOwner)
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

    // Order by profile_id, then location_id
    query = query
      .order('profile_id', { ascending: true })
      .order('location_id', { ascending: true })

    const response = await query

    if (response.error) {
      this.handleError(
        response.error,
        'ProfileLocationAssociationService.getAssociationsList',
      )
    }

    return {
      data: response.data,
      count: response.count || null,
    }
  }

  /**
   * Create a new profile location association
   */
  async createAssociation(
    association: ProfileLocationAssociationInsert,
  ): Promise<ProfileLocationAssociation> {
    this.validateRequired(
      association.profile_id,
      'profile_id',
      'ProfileLocationAssociationService.createAssociation',
    )
    this.validateRequired(
      association.location_id,
      'location_id',
      'ProfileLocationAssociationService.createAssociation',
    )

    const response = await this.supabase
      .from('profile_location_associations')
      .insert(association)
      .select()
      .single()

    return this.handleResponse(
      response,
      'ProfileLocationAssociationService.createAssociation',
    )
  }

  /**
   * Update a profile location association
   */
  async updateAssociation(
    id: number,
    updates: ProfileLocationAssociationUpdate,
  ): Promise<ProfileLocationAssociation> {
    this.validateRequired(
      id,
      'id',
      'ProfileLocationAssociationService.updateAssociation',
    )

    const response = await this.supabase
      .from('profile_location_associations')
      .update(this.createOptimisticUpdate(updates))
      .eq('id', id)
      .select()
      .single()

    return this.handleResponse(
      response,
      'ProfileLocationAssociationService.updateAssociation',
    )
  }

  /**
   * Delete a profile location association
   */
  async deleteAssociation(id: number): Promise<boolean> {
    this.validateRequired(
      id,
      'id',
      'ProfileLocationAssociationService.deleteAssociation',
    )

    const { error } = await this.supabase
      .from('profile_location_associations')
      .delete()
      .eq('id', id)

    if (error) {
      this.handleError(
        error,
        'ProfileLocationAssociationService.deleteAssociation',
      )
    }

    return true
  }

  // ==================== SPECIALIZED QUERIES ====================

  /**
   * Get associations by profile ID
   */
  async getAssociationsByProfile(
    profileId: string,
  ): Promise<Array<AssociationWithDetails>> {
    this.validateRequired(
      profileId,
      'profileId',
      'ProfileLocationAssociationService.getAssociationsByProfile',
    )

    const response = await this.supabase
      .from('profile_location_associations')
      .select(
        `
        *,
        profiles (
          id,
          username,
          full_name,
          avatar_url
        ),
        locations (
          id,
          block,
          lot,
          coordinates,
          is_locked
        )
      `,
      )
      .eq('profile_id', profileId)

    return this.handleResponse(
      response,
      'ProfileLocationAssociationService.getAssociationsByProfile',
    )
  }

  /**
   * Get associations by location ID
   */
  async getAssociationsByLocation(
    locationId: string,
  ): Promise<Array<AssociationWithDetails>> {
    this.validateRequired(
      locationId,
      'locationId',
      'ProfileLocationAssociationService.getAssociationsByLocation',
    )

    const response = await this.supabase
      .from('profile_location_associations')
      .select(
        `
        *,
        profiles (
          id,
          username,
          full_name,
          avatar_url
        ),
        locations (
          id,
          block,
          lot,
          coordinates,
          is_locked
        )
      `,
      )
      .eq('location_id', locationId)

    return this.handleResponse(
      response,
      'ProfileLocationAssociationService.getAssociationsByLocation',
    )
  }

  /**
   * Get association with full details by ID
   */
  async getAssociationWithDetails(
    id: number,
  ): Promise<AssociationWithDetails | null> {
    this.validateRequired(
      id,
      'id',
      'ProfileLocationAssociationService.getAssociationWithDetails',
    )

    const response = await this.supabase
      .from('profile_location_associations')
      .select(
        `
        *,
        profiles (
          id,
          username,
          full_name,
          avatar_url
        ),
        locations (
          id,
          block,
          lot,
          coordinates,
          is_locked
        )
      `,
      )
      .eq('id', id)
      .single()

    return this.handleOptionalResponse(
      response,
      'ProfileLocationAssociationService.getAssociationWithDetails',
    )
  }

  // ==================== VERIFICATION AND OWNERSHIP ====================

  /**
   * Verify an association
   */
  async verifyAssociation(
    id: number,
    verified: boolean = true,
  ): Promise<ProfileLocationAssociation> {
    return this.updateAssociation(id, { is_verified: verified })
  }

  /**
   * Set association ownership
   */
  async setAssociationOwnership(
    id: number,
    isOwner: boolean,
  ): Promise<ProfileLocationAssociation> {
    return this.updateAssociation(id, { is_owner: isOwner })
  }

  /**
   * Get verified associations for a profile
   */
  async getVerifiedAssociationsByProfile(
    profileId: string,
  ): Promise<Array<AssociationWithDetails>> {
    this.validateRequired(
      profileId,
      'profileId',
      'ProfileLocationAssociationService.getVerifiedAssociationsByProfile',
    )

    const response = await this.supabase
      .from('profile_location_associations')
      .select(
        `
        *,
        profiles (
          id,
          username,
          full_name,
          avatar_url
        ),
        locations (
          id,
          block,
          lot,
          coordinates,
          is_locked
        )
      `,
      )
      .eq('profile_id', profileId)
      .eq('is_verified', true)

    return this.handleResponse(
      response,
      'ProfileLocationAssociationService.getVerifiedAssociationsByProfile',
    )
  }

  /**
   * Get owner associations for a profile
   */
  async getOwnerAssociationsByProfile(
    profileId: string,
  ): Promise<Array<AssociationWithDetails>> {
    this.validateRequired(
      profileId,
      'profileId',
      'ProfileLocationAssociationService.getOwnerAssociationsByProfile',
    )

    const response = await this.supabase
      .from('profile_location_associations')
      .select(
        `
        *,
        profiles (
          id,
          username,
          full_name,
          avatar_url
        ),
        locations (
          id,
          block,
          lot,
          coordinates,
          is_locked
        )
      `,
      )
      .eq('profile_id', profileId)
      .eq('is_owner', true)

    return this.handleResponse(
      response,
      'ProfileLocationAssociationService.getOwnerAssociationsByProfile',
    )
  }

  // ==================== LOCATION ASSIGNMENT ====================

  /**
   * Get location assignment info for a record
   */
  async getLocationAssignmentInfo(
    tableName: string,
    recordId: string,
  ): Promise<LocationAssignmentInfo> {
    this.validateRequired(
      tableName,
      'tableName',
      'ProfileLocationAssociationService.getLocationAssignmentInfo',
    )
    this.validateRequired(
      recordId,
      'recordId',
      'ProfileLocationAssociationService.getLocationAssignmentInfo',
    )

    const response = await this.supabase.rpc('get_location_assignment_info', {
      table_name: tableName,
      record_id: recordId,
    })

    if (response.error) {
      this.handleError(
        response.error,
        'ProfileLocationAssociationService.getLocationAssignmentInfo',
      )
    }

    return response.data as unknown as LocationAssignmentInfo
  }

  // ==================== BULK OPERATIONS ====================

  /**
   * Bulk update associations
   */
  async bulkUpdateAssociations(
    updates: Array<{ id: number } & Partial<ProfileLocationAssociationUpdate>>,
  ): Promise<Array<ProfileLocationAssociation>> {
    if (!updates.length) {
      return []
    }

    const results: Array<ProfileLocationAssociation> = []

    // Process updates sequentially to maintain order and handle errors properly
    for (const update of updates) {
      try {
        const { id, ...updateData } = update
        const result = await this.updateAssociation(id, updateData)
        results.push(result)
      } catch (error) {
        this.handleError(
          error,
          `ProfileLocationAssociationService.bulkUpdateAssociations (${update.id})`,
        )
      }
    }

    return results
  }

  /**
   * Bulk verify associations
   */
  async bulkVerifyAssociations(
    associationIds: Array<number>,
    verified: boolean = true,
  ): Promise<Array<ProfileLocationAssociation>> {
    if (!associationIds.length) {
      return []
    }

    const updates = associationIds.map((id) => ({ id, is_verified: verified }))
    return this.bulkUpdateAssociations(updates)
  }

  /**
   * Bulk set ownership
   */
  async bulkSetOwnership(
    associationIds: Array<number>,
    isOwner: boolean,
  ): Promise<Array<ProfileLocationAssociation>> {
    if (!associationIds.length) {
      return []
    }

    const updates = associationIds.map((id) => ({ id, is_owner: isOwner }))
    return this.bulkUpdateAssociations(updates)
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Check if profile has association with location
   */
  async profileHasLocationAssociation(
    profileId: string,
    locationId: string,
  ): Promise<boolean> {
    this.validateRequired(
      profileId,
      'profileId',
      'ProfileLocationAssociationService.profileHasLocationAssociation',
    )
    this.validateRequired(
      locationId,
      'locationId',
      'ProfileLocationAssociationService.profileHasLocationAssociation',
    )

    const response = await this.supabase
      .from('profile_location_associations')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .eq('location_id', locationId)
      .limit(1)

    if (response.error) {
      this.handleError(
        response.error,
        'ProfileLocationAssociationService.profileHasLocationAssociation',
      )
    }

    return (response.count || 0) > 0
  }

  /**
   * Get association statistics for a profile
   */
  async getProfileAssociationStats(profileId: string): Promise<{
    total: number
    verified: number
    owned: number
    unverified: number
  }> {
    this.validateRequired(
      profileId,
      'profileId',
      'ProfileLocationAssociationService.getProfileAssociationStats',
    )

    const [allAssociations, verifiedAssociations, ownedAssociations] =
      await Promise.all([
        this.supabase
          .from('profile_location_associations')
          .select('is_verified, is_owner')
          .eq('profile_id', profileId),
        this.supabase
          .from('profile_location_associations')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', profileId)
          .eq('is_verified', true),
        this.supabase
          .from('profile_location_associations')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', profileId)
          .eq('is_owner', true),
      ])

    if (allAssociations.error) {
      this.handleError(
        allAssociations.error,
        'ProfileLocationAssociationService.getProfileAssociationStats',
      )
    }

    const associations = allAssociations.data

    return {
      total: associations.length,
      verified: verifiedAssociations.count || 0,
      owned: ownedAssociations.count || 0,
      unverified: associations.length - (verifiedAssociations.count || 0),
    }
  }

  /**
   * Get location association statistics
   */
  async getLocationAssociationStats(locationId: string): Promise<{
    total_associations: number
    verified_associations: number
    owners: number
    residents: number
  }> {
    this.validateRequired(
      locationId,
      'locationId',
      'ProfileLocationAssociationService.getLocationAssociationStats',
    )

    const [allAssociations, verifiedAssociations, ownerAssociations] =
      await Promise.all([
        this.supabase
          .from('profile_location_associations')
          .select('is_verified, is_owner')
          .eq('location_id', locationId),
        this.supabase
          .from('profile_location_associations')
          .select('id', { count: 'exact', head: true })
          .eq('location_id', locationId)
          .eq('is_verified', true),
        this.supabase
          .from('profile_location_associations')
          .select('id', { count: 'exact', head: true })
          .eq('location_id', locationId)
          .eq('is_owner', true),
      ])

    if (allAssociations.error) {
      this.handleError(
        allAssociations.error,
        'ProfileLocationAssociationService.getLocationAssociationStats',
      )
    }

    const associations = allAssociations.data

    return {
      total_associations: associations.length,
      verified_associations: verifiedAssociations.count || 0,
      owners: ownerAssociations.count || 0,
      residents: associations.length - (ownerAssociations.count || 0),
    }
  }
}

// Export singleton instance - reused throughout the application
export const profileLocationAssociationService =
  new ProfileLocationAssociationService()
