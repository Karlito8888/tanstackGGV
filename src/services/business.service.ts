/**
 * Business Service
 *
 * Service layer for all business-related operations following the
 * Supabase Services & Hooks pattern.
 *
 * This service encapsulates:
 * - CRUD operations for user_business_inside and user_business_outside
 * - Business search and filtering
 * - Featured business management
 * - Location assignment operations
 * - Category-based queries
 * - Type-safe operations with proper error handling
 */

import { BaseService } from './base.service'
import type { InsertRow, Row, UpdateRow } from '../lib/database-types'

// Type aliases for better readability
type UserBusinessInside = Row<'user_business_inside'>
type UserBusinessInsideInsert = InsertRow<'user_business_inside'>
type UserBusinessInsideUpdate = UpdateRow<'user_business_inside'>

type UserBusinessOutside = Row<'user_business_outside'>
type UserBusinessOutsideInsert = InsertRow<'user_business_outside'>
type UserBusinessOutsideUpdate = UpdateRow<'user_business_outside'>

// Additional types for complex operations
export interface BusinessFilters {
  profileId?: string
  categoryId?: string
  isActive?: boolean
  isFeatured?: boolean
  search?: string
  limit?: number
  offset?: number
}

export interface BusinessListResult<T> {
  data: Array<T>
  count: number | null
}

export interface LocationAssignmentInfo {
  assigned: boolean
  location_id: string | null
  block: string | null
  lot: string | null
  message: string
}

export interface BusinessSearchResult {
  inside: Array<UserBusinessInside>
  outside: Array<UserBusinessOutside>
  totalCount: number
}

export class BusinessService extends BaseService {
  // ==================== USER BUSINESS INSIDE OPERATIONS ====================

  /**
   * Get a user business inside by ID
   */
  async getUserBusinessInside(id: string): Promise<UserBusinessInside | null> {
    this.validateRequired(id, 'id', 'BusinessService.getUserBusinessInside')

    const response = await this.supabase
      .from('user_business_inside')
      .select('*')
      .eq('id', id)
      .single()

    return this.handleOptionalResponse(
      response,
      'BusinessService.getUserBusinessInside',
    )
  }

  /**
   * Get user business inside list with filters and pagination
   */
  async getUserBusinessInsideList(
    filters?: BusinessFilters,
  ): Promise<BusinessListResult<UserBusinessInside>> {
    let query = this.supabase
      .from('user_business_inside')
      .select('*', { count: 'exact' })

    // Apply filters
    if (filters?.profileId) {
      query = query.eq('profile_id', filters.profileId)
    }
    if (filters?.categoryId) {
      query = query.eq('category_id', filters.categoryId)
    }
    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive)
    }
    if (filters?.isFeatured !== undefined) {
      query = query.eq('is_featured', filters.isFeatured)
    }
    if (filters?.search) {
      query = query.or(
        `business_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`,
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

    const response = await query

    if (response.error) {
      this.handleError(
        response.error,
        'BusinessService.getUserBusinessInsideList',
      )
    }

    return {
      data: response.data,
      count: response.count || null,
    }
  }

  /**
   * Create a new user business inside
   */
  async createUserBusinessInside(
    business: UserBusinessInsideInsert,
  ): Promise<UserBusinessInside> {
    this.validateRequired(
      business.business_name,
      'business_name',
      'BusinessService.createUserBusinessInside',
    )
    this.validateRequired(
      business.category_id,
      'category_id',
      'BusinessService.createUserBusinessInside',
    )
    this.validateRequired(
      business.profile_id,
      'profile_id',
      'BusinessService.createUserBusinessInside',
    )

    const response = await this.supabase
      .from('user_business_inside')
      .insert(business)
      .select()
      .single()

    return this.handleResponse(
      response,
      'BusinessService.createUserBusinessInside',
    )
  }

  /**
   * Update a user business inside
   */
  async updateUserBusinessInside(
    id: string,
    updates: UserBusinessInsideUpdate,
  ): Promise<UserBusinessInside> {
    this.validateRequired(id, 'id', 'BusinessService.updateUserBusinessInside')

    const response = await this.supabase
      .from('user_business_inside')
      .update(this.createOptimisticUpdate(updates))
      .eq('id', id)
      .select()
      .single()

    return this.handleResponse(
      response,
      'BusinessService.updateUserBusinessInside',
    )
  }

  /**
   * Delete a user business inside
   */
  async deleteUserBusinessInside(id: string): Promise<boolean> {
    this.validateRequired(id, 'id', 'BusinessService.deleteUserBusinessInside')

    const { error } = await this.supabase
      .from('user_business_inside')
      .delete()
      .eq('id', id)

    if (error) {
      this.handleError(error, 'BusinessService.deleteUserBusinessInside')
    }

    return true
  }

  /**
   * Toggle business inside active status
   */
  async toggleUserBusinessInsideStatus(
    id: string,
    isActive: boolean,
  ): Promise<UserBusinessInside> {
    return this.updateUserBusinessInside(id, { is_active: isActive })
  }

  /**
   * Get businesses by profile ID
   */
  async getUserBusinessInsideByProfile(
    profileId: string,
    isActive?: boolean,
  ): Promise<Array<UserBusinessInside>> {
    this.validateRequired(
      profileId,
      'profileId',
      'BusinessService.getUserBusinessInsideByProfile',
    )

    let query = this.supabase
      .from('user_business_inside')
      .select('*')
      .eq('profile_id', profileId)

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive)
    }

    query = query.order('created_at', { ascending: false })

    const response = await query
    return this.handleResponse(
      response,
      'BusinessService.getUserBusinessInsideByProfile',
    )
  }

  /**
   * Get location assignment info for business inside
   */
  async getBusinessInsideLocationAssignmentInfo(
    businessId: string,
  ): Promise<LocationAssignmentInfo> {
    this.validateRequired(
      businessId,
      'businessId',
      'BusinessService.getBusinessInsideLocationAssignmentInfo',
    )

    const response = await this.supabase.rpc('get_location_assignment_info', {
      table_name: 'user_business_inside',
      record_id: businessId,
    })

    if (response.error) {
      this.handleError(
        response.error,
        'BusinessService.getBusinessInsideLocationAssignmentInfo',
      )
    }

    return response.data as unknown as LocationAssignmentInfo
  }

  // ==================== USER BUSINESS OUTSIDE OPERATIONS ====================

  /**
   * Get a user business outside by ID
   */
  async getUserBusinessOutside(
    id: string,
  ): Promise<UserBusinessOutside | null> {
    this.validateRequired(id, 'id', 'BusinessService.getUserBusinessOutside')

    const response = await this.supabase
      .from('user_business_outside')
      .select('*')
      .eq('id', id)
      .single()

    return this.handleOptionalResponse(
      response,
      'BusinessService.getUserBusinessOutside',
    )
  }

  /**
   * Get user business outside list with filters and pagination
   */
  async getUserBusinessOutsideList(
    filters?: BusinessFilters,
  ): Promise<BusinessListResult<UserBusinessOutside>> {
    let query = this.supabase
      .from('user_business_outside')
      .select('*', { count: 'exact' })

    // Apply filters
    if (filters?.profileId) {
      query = query.eq('profile_id', filters.profileId)
    }
    if (filters?.categoryId) {
      query = query.eq('category_id', filters.categoryId)
    }
    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive)
    }
    if (filters?.isFeatured !== undefined) {
      query = query.eq('is_featured', filters.isFeatured)
    }
    if (filters?.search) {
      query = query.or(
        `business_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`,
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

    const response = await query

    if (response.error) {
      this.handleError(
        response.error,
        'BusinessService.getUserBusinessOutsideList',
      )
    }

    return {
      data: response.data,
      count: response.count || null,
    }
  }

  /**
   * Create a new user business outside
   */
  async createUserBusinessOutside(
    business: UserBusinessOutsideInsert,
  ): Promise<UserBusinessOutside> {
    this.validateRequired(
      business.business_name,
      'business_name',
      'BusinessService.createUserBusinessOutside',
    )
    this.validateRequired(
      business.category_id,
      'category_id',
      'BusinessService.createUserBusinessOutside',
    )
    this.validateRequired(
      business.profile_id,
      'profile_id',
      'BusinessService.createUserBusinessOutside',
    )

    const response = await this.supabase
      .from('user_business_outside')
      .insert(business)
      .select()
      .single()

    return this.handleResponse(
      response,
      'BusinessService.createUserBusinessOutside',
    )
  }

  /**
   * Update a user business outside
   */
  async updateUserBusinessOutside(
    id: string,
    updates: UserBusinessOutsideUpdate,
  ): Promise<UserBusinessOutside> {
    this.validateRequired(id, 'id', 'BusinessService.updateUserBusinessOutside')

    const response = await this.supabase
      .from('user_business_outside')
      .update(this.createOptimisticUpdate(updates))
      .eq('id', id)
      .select()
      .single()

    return this.handleResponse(
      response,
      'BusinessService.updateUserBusinessOutside',
    )
  }

  /**
   * Delete a user business outside
   */
  async deleteUserBusinessOutside(id: string): Promise<boolean> {
    this.validateRequired(id, 'id', 'BusinessService.deleteUserBusinessOutside')

    const { error } = await this.supabase
      .from('user_business_outside')
      .delete()
      .eq('id', id)

    if (error) {
      this.handleError(error, 'BusinessService.deleteUserBusinessOutside')
    }

    return true
  }

  /**
   * Toggle business outside active status
   */
  async toggleUserBusinessOutsideStatus(
    id: string,
    isActive: boolean,
  ): Promise<UserBusinessOutside> {
    return this.updateUserBusinessOutside(id, { is_active: isActive })
  }

  /**
   * Get businesses by profile ID
   */
  async getUserBusinessOutsideByProfile(
    profileId: string,
    isActive?: boolean,
  ): Promise<Array<UserBusinessOutside>> {
    this.validateRequired(
      profileId,
      'profileId',
      'BusinessService.getUserBusinessOutsideByProfile',
    )

    let query = this.supabase
      .from('user_business_outside')
      .select('*')
      .eq('profile_id', profileId)

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive)
    }

    query = query.order('created_at', { ascending: false })

    const response = await query
    return this.handleResponse(
      response,
      'BusinessService.getUserBusinessOutsideByProfile',
    )
  }

  /**
   * Get featured businesses outside
   */
  async getFeaturedUserBusinessOutside(
    limit: number = 10,
  ): Promise<Array<UserBusinessOutside>> {
    const response = await this.supabase
      .from('user_business_outside')
      .select('*')
      .eq('is_active', true)
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    return this.handleResponse(
      response,
      'BusinessService.getFeaturedUserBusinessOutside',
    )
  }

  // ==================== SEARCH AND AGGREGATION OPERATIONS ====================

  /**
   * Search businesses across both inside and outside tables
   */
  async searchBusinesses(
    searchQuery: string,
    limit: number = 50,
  ): Promise<BusinessSearchResult> {
    this.validateRequired(
      searchQuery,
      'searchQuery',
      'BusinessService.searchBusinesses',
    )

    if (searchQuery.length < 2) {
      return { inside: [], outside: [], totalCount: 0 }
    }

    // Search inside businesses
    const insideResponse = await this.supabase
      .from('user_business_inside')
      .select('*')
      .eq('is_active', true)
      .or(
        `business_name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`,
      )
      .order('created_at', { ascending: false })
      .limit(limit)

    // Search outside businesses
    const outsideResponse = await this.supabase
      .from('user_business_outside')
      .select('*')
      .eq('is_active', true)
      .or(
        `business_name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`,
      )
      .order('created_at', { ascending: false })
      .limit(limit)

    if (insideResponse.error) {
      this.handleError(
        insideResponse.error,
        'BusinessService.searchBusinesses (inside)',
      )
    }
    if (outsideResponse.error) {
      this.handleError(
        outsideResponse.error,
        'BusinessService.searchBusinesses (outside)',
      )
    }

    return {
      inside: insideResponse.data,
      outside: outsideResponse.data,
      totalCount: insideResponse.data.length + outsideResponse.data.length,
    }
  }

  /**
   * Get businesses by category (across both tables)
   */
  async getBusinessesByCategory(
    categoryId: string,
    limit?: number,
  ): Promise<BusinessSearchResult> {
    this.validateRequired(
      categoryId,
      'categoryId',
      'BusinessService.getBusinessesByCategory',
    )

    // Get inside businesses by category
    let insideQuery = this.supabase
      .from('user_business_inside')
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    // Get outside businesses by category
    let outsideQuery = this.supabase
      .from('user_business_outside')
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (limit) {
      insideQuery = insideQuery.limit(limit)
      outsideQuery = outsideQuery.limit(limit)
    }

    const [insideResponse, outsideResponse] = await Promise.all([
      insideQuery,
      outsideQuery,
    ])

    if (insideResponse.error) {
      this.handleError(
        insideResponse.error,
        'BusinessService.getBusinessesByCategory (inside)',
      )
    }
    if (outsideResponse.error) {
      this.handleError(
        outsideResponse.error,
        'BusinessService.getBusinessesByCategory (outside)',
      )
    }

    return {
      inside: insideResponse.data,
      outside: outsideResponse.data,
      totalCount: insideResponse.data.length + outsideResponse.data.length,
    }
  }

  // ==================== BULK OPERATIONS ====================

  /**
   * Bulk update businesses inside
   */
  async bulkUpdateUserBusinessInside(
    updates: Array<{ id: string } & UserBusinessInsideUpdate>,
  ): Promise<Array<UserBusinessInside>> {
    if (!updates.length) {
      return []
    }

    const results: Array<UserBusinessInside> = []

    // Process updates sequentially to maintain order and handle errors properly
    for (const update of updates) {
      try {
        const result = await this.updateUserBusinessInside(update.id, update)
        results.push(result)
      } catch (error) {
        this.handleError(
          error,
          `BusinessService.bulkUpdateUserBusinessInside (${update.id})`,
        )
      }
    }

    return results
  }

  /**
   * Bulk update businesses outside
   */
  async bulkUpdateUserBusinessOutside(
    updates: Array<{ id: string } & UserBusinessOutsideUpdate>,
  ): Promise<Array<UserBusinessOutside>> {
    if (!updates.length) {
      return []
    }

    const results: Array<UserBusinessOutside> = []

    // Process updates sequentially to maintain order and handle errors properly
    for (const update of updates) {
      try {
        const result = await this.updateUserBusinessOutside(update.id, update)
        results.push(result)
      } catch (error) {
        this.handleError(
          error,
          `BusinessService.bulkUpdateUserBusinessOutside (${update.id})`,
        )
      }
    }

    return results
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get business statistics for a profile
   */
  async getProfileBusinessStats(profileId: string): Promise<{
    inside: { total: number; active: number; featured: number }
    outside: { total: number; active: number; featured: number }
  }> {
    this.validateRequired(
      profileId,
      'profileId',
      'BusinessService.getProfileBusinessStats',
    )

    const [insideStats, outsideStats] = await Promise.all([
      this.supabase
        .from('user_business_inside')
        .select('is_active, is_featured')
        .eq('profile_id', profileId),
      this.supabase
        .from('user_business_outside')
        .select('is_active, is_featured')
        .eq('profile_id', profileId),
    ])

    if (insideStats.error) {
      this.handleError(
        insideStats.error,
        'BusinessService.getProfileBusinessStats (inside)',
      )
    }
    if (outsideStats.error) {
      this.handleError(
        outsideStats.error,
        'BusinessService.getProfileBusinessStats (outside)',
      )
    }

    const insideData = insideStats.data
    const outsideData = outsideStats.data

    return {
      inside: {
        total: insideData.length,
        active: insideData.filter((b) => b.is_active).length,
        featured: insideData.filter((b) => b.is_featured).length,
      },
      outside: {
        total: outsideData.length,
        active: outsideData.filter((b) => b.is_active).length,
        featured: outsideData.filter((b) => b.is_featured).length,
      },
    }
  }
}

// Export singleton instance - reused throughout the application
export const businessService = new BusinessService()
