/**
 * Service Category Service
 *
 * Service layer for service category operations following the
 * Supabase Services & Hooks pattern.
 *
 * This service encapsulates:
 * - CRUD operations for service_categories
 * - Category search and filtering
 * - Active category management
 * - Type-safe operations with proper error handling
 */

import { BaseService } from './base.service'
import type { InsertRow, Row, UpdateRow } from '../lib/database-types'

// Type aliases for better readability
type ServiceCategory = Row<'service_categories'>
type ServiceCategoryInsert = InsertRow<'service_categories'>
type ServiceCategoryUpdate = UpdateRow<'service_categories'>

// Additional types for complex operations
export interface ServiceCategoryFilters {
  isActive?: boolean
  search?: string
  limit?: number
  offset?: number
}

export interface ServiceCategoryListResult {
  data: Array<ServiceCategory>
  count: number | null
}

export class ServiceCategoryService extends BaseService {
  // ==================== BASIC CRUD OPERATIONS ====================

  /**
   * Get a service category by ID
   */
  async getServiceCategory(id: string): Promise<ServiceCategory | null> {
    this.validateRequired(id, 'id', 'ServiceCategoryService.getServiceCategory')

    const response = await this.supabase
      .from('service_categories')
      .select('*')
      .eq('id', id)
      .single()

    return this.handleOptionalResponse(
      response,
      'ServiceCategoryService.getServiceCategory',
    )
  }

  /**
   * Get service categories list with filters and pagination
   */
  async getServiceCategoriesList(
    filters?: ServiceCategoryFilters,
  ): Promise<ServiceCategoryListResult> {
    let query = this.supabase
      .from('service_categories')
      .select('*', { count: 'exact' })

    // Apply filters
    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive)
    }
    if (filters?.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`,
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

    // Order by name asc
    query = query.order('name', { ascending: true })

    const response = await query

    if (response.error) {
      this.handleError(
        response.error,
        'ServiceCategoryService.getServiceCategoriesList',
      )
    }

    return {
      data: response.data,
      count: response.count || null,
    }
  }

  /**
   * Create a new service category
   */
  async createServiceCategory(
    category: ServiceCategoryInsert,
  ): Promise<ServiceCategory> {
    this.validateRequired(
      category.name,
      'name',
      'ServiceCategoryService.createServiceCategory',
    )

    const response = await this.supabase
      .from('service_categories')
      .insert(category)
      .select()
      .single()

    return this.handleResponse(
      response,
      'ServiceCategoryService.createServiceCategory',
    )
  }

  /**
   * Update a service category
   */
  async updateServiceCategory(
    id: string,
    updates: ServiceCategoryUpdate,
  ): Promise<ServiceCategory> {
    this.validateRequired(
      id,
      'id',
      'ServiceCategoryService.updateServiceCategory',
    )

    const response = await this.supabase
      .from('service_categories')
      .update(this.createOptimisticUpdate(updates))
      .eq('id', id)
      .select()
      .single()

    return this.handleResponse(
      response,
      'ServiceCategoryService.updateServiceCategory',
    )
  }

  /**
   * Delete a service category
   */
  async deleteServiceCategory(id: string): Promise<boolean> {
    this.validateRequired(
      id,
      'id',
      'ServiceCategoryService.deleteServiceCategory',
    )

    const { error } = await this.supabase
      .from('service_categories')
      .delete()
      .eq('id', id)

    if (error) {
      this.handleError(error, 'ServiceCategoryService.deleteServiceCategory')
    }

    return true
  }

  // ==================== SPECIALIZED OPERATIONS ====================

  /**
   * Get all active service categories
   */
  async getActiveServiceCategories(): Promise<Array<ServiceCategory>> {
    const response = await this.supabase
      .from('service_categories')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    return this.handleResponse(
      response,
      'ServiceCategoryService.getActiveServiceCategories',
    )
  }

  /**
   * Search service categories
   */
  async searchServiceCategories(
    searchQuery: string,
    limit: number = 50,
  ): Promise<Array<ServiceCategory>> {
    this.validateRequired(
      searchQuery,
      'searchQuery',
      'ServiceCategoryService.searchServiceCategories',
    )

    if (searchQuery.length < 2) {
      return []
    }

    const response = await this.supabase
      .from('service_categories')
      .select('*')
      .eq('is_active', true)
      .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
      .order('name', { ascending: true })
      .limit(limit)

    return this.handleResponse(
      response,
      'ServiceCategoryService.searchServiceCategories',
    )
  }

  /**
   * Toggle category active status
   */
  async toggleServiceCategoryStatus(
    id: string,
    isActive: boolean,
  ): Promise<ServiceCategory> {
    return this.updateServiceCategory(id, { is_active: isActive })
  }

  /**
   * Get service category by name
   */
  async getServiceCategoryByName(
    name: string,
  ): Promise<ServiceCategory | null> {
    this.validateRequired(
      name,
      'name',
      'ServiceCategoryService.getServiceCategoryByName',
    )

    const response = await this.supabase
      .from('service_categories')
      .select('*')
      .eq('name', name)
      .single()

    return this.handleOptionalResponse(
      response,
      'ServiceCategoryService.getServiceCategoryByName',
    )
  }

  /**
   * Get service categories with usage count (businesses using each category)
   */
  async getServiceCategoriesWithUsageCount(): Promise<
    Array<ServiceCategory & { usage_count: number }>
  > {
    // Get all categories
    const categoriesResponse = await this.supabase
      .from('service_categories')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (categoriesResponse.error) {
      this.handleError(
        categoriesResponse.error,
        'ServiceCategoryService.getServiceCategoriesWithUsageCount',
      )
    }

    const categories = categoriesResponse.data

    // Get usage counts for each category
    const usageCounts = await Promise.all(
      categories.map(async (category) => {
        const [insideCount, outsideCount] = await Promise.all([
          this.supabase
            .from('user_business_inside')
            .select('id', { count: 'exact', head: true })
            .eq('category_id', category.id)
            .eq('is_active', true),
          this.supabase
            .from('user_business_outside')
            .select('id', { count: 'exact', head: true })
            .eq('category_id', category.id)
            .eq('is_active', true),
        ])

        const totalCount = (insideCount.count || 0) + (outsideCount.count || 0)

        return {
          ...category,
          usage_count: totalCount,
        }
      }),
    )

    return usageCounts
  }

  // ==================== BULK OPERATIONS ====================

  /**
   * Bulk update service categories
   */
  async bulkUpdateServiceCategories(
    updates: Array<{ id: string } & ServiceCategoryUpdate>,
  ): Promise<Array<ServiceCategory>> {
    if (!updates.length) {
      return []
    }

    const results: Array<ServiceCategory> = []

    // Process updates sequentially to maintain order and handle errors properly
    for (const update of updates) {
      try {
        const result = await this.updateServiceCategory(update.id, update)
        results.push(result)
      } catch (error) {
        this.handleError(
          error,
          `ServiceCategoryService.bulkUpdateServiceCategories (${update.id})`,
        )
      }
    }

    return results
  }

  /**
   * Bulk activate/deactivate categories
   */
  async bulkToggleServiceCategoriesStatus(
    categoryIds: Array<string>,
    isActive: boolean,
  ): Promise<Array<ServiceCategory>> {
    if (!categoryIds.length) {
      return []
    }

    const updates = categoryIds.map((id) => ({ id, is_active: isActive }))
    return this.bulkUpdateServiceCategories(updates)
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Check if category name is available
   */
  async isCategoryNameAvailable(
    name: string,
    excludeId?: string,
  ): Promise<boolean> {
    this.validateRequired(
      name,
      'name',
      'ServiceCategoryService.isCategoryNameAvailable',
    )

    let query = this.supabase
      .from('service_categories')
      .select('id')
      .eq('name', name)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const response = await query.limit(1)

    if (response.error) {
      this.handleError(
        response.error,
        'ServiceCategoryService.isCategoryNameAvailable',
      )
    }

    return response.data.length === 0
  }

  /**
   * Get category statistics
   */
  async getCategoryStatistics(): Promise<{
    total: number
    active: number
    inactive: number
    with_usage: number
  }> {
    const [allCategories, usageStats] = await Promise.all([
      this.supabase.from('service_categories').select('is_active'),
      this.getServiceCategoriesWithUsageCount(),
    ])

    if (allCategories.error) {
      this.handleError(
        allCategories.error,
        'ServiceCategoryService.getCategoryStatistics',
      )
    }

    const categories = allCategories.data
    const categoriesWithUsage = usageStats.filter((cat) => cat.usage_count > 0)

    return {
      total: categories.length,
      active: categories.filter((cat) => cat.is_active).length,
      inactive: categories.filter((cat) => !cat.is_active).length,
      with_usage: categoriesWithUsage.length,
    }
  }
}

// Export singleton instance - reused throughout the application
export const serviceCategoryService = new ServiceCategoryService()
