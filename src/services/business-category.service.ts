/**
 * Business Category Service
 *
 * Service layer for business category operations following the
 * Supabase Services & Hooks pattern.
 *
 * This service encapsulates:
 * - CRUD operations for business_inside_categories and business_outside_categories
 * - Category search and filtering
 * - Active category management
 * - Name availability checking
 * - Type-safe operations with proper error handling
 */

import { BaseService } from './base.service'
import type { InsertRow, Row } from '../lib/database-types'

// Type aliases for better readability
type BusinessInsideCategory = Row<'business_inside_categories'>
type BusinessInsideCategoryInsert = InsertRow<'business_inside_categories'>

type BusinessOutsideCategory = Row<'business_outside_categories'>
type BusinessOutsideCategoryInsert = InsertRow<'business_outside_categories'>

// Additional types for complex operations
export interface CategoryFilters {
  isActive?: boolean
  search?: string
  limit?: number
  offset?: number
}

export interface CategoryListResult<T> {
  data: Array<T>
  count: number | null
}

export interface CategorySearchResult {
  inside: Array<BusinessInsideCategory>
  outside: Array<BusinessOutsideCategory>
  totalCount: number
}

export class BusinessCategoryService extends BaseService {
  // ==================== BUSINESS INSIDE CATEGORIES ====================

  /**
   * Get a business inside category by ID
   */
  async getBusinessInsideCategory(
    id: string,
  ): Promise<BusinessInsideCategory | null> {
    this.validateRequired(
      id,
      'id',
      'BusinessCategoryService.getBusinessInsideCategory',
    )

    const response = await this.supabase
      .from('business_inside_categories')
      .select('*')
      .eq('id', id)
      .single()

    return this.handleOptionalResponse(
      response,
      'BusinessCategoryService.getBusinessInsideCategory',
    )
  }

  /**
   * Get business inside categories list with filters and pagination
   */
  async getBusinessInsideCategoriesList(
    filters?: CategoryFilters,
  ): Promise<CategoryListResult<BusinessInsideCategory>> {
    let query = this.supabase
      .from('business_inside_categories')
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
        filters.offset + (filters.limit || 50) - 1,
      )
    }

    // Apply ordering
    query = query.order('name', { ascending: true })

    const response = await query

    if (response.error) {
      this.handleError(
        response.error,
        'BusinessCategoryService.getBusinessInsideCategoriesList',
      )
    }

    return {
      data: response.data,
      count: response.count,
    }
  }

  /**
   * Get active business inside categories
   */
  async getActiveBusinessInsideCategories(): Promise<
    Array<BusinessInsideCategory>
  > {
    const response = await this.supabase
      .from('business_inside_categories')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (response.error) {
      this.handleError(
        response.error,
        'BusinessCategoryService.getActiveBusinessInsideCategories',
      )
    }

    return response.data
  }

  /**
   * Search business inside categories
   */
  async searchBusinessInsideCategories(
    searchQuery: string,
  ): Promise<Array<BusinessInsideCategory>> {
    this.validateRequired(
      searchQuery,
      'searchQuery',
      'BusinessCategoryService.searchBusinessInsideCategories',
    )

    if (searchQuery.length < 2) return []

    const response = await this.supabase
      .from('business_inside_categories')
      .select('*')
      .eq('is_active', true)
      .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
      .order('name', { ascending: true })
      .limit(50)

    if (response.error) {
      this.handleError(
        response.error,
        'BusinessCategoryService.searchBusinessInsideCategories',
      )
    }

    return response.data
  }

  /**
   * Check if business inside category name is available
   */
  async isBusinessInsideCategoryNameAvailable(
    name: string,
    excludeId?: string,
  ): Promise<boolean> {
    this.validateRequired(
      name,
      'name',
      'BusinessCategoryService.isBusinessInsideCategoryNameAvailable',
    )

    let query = this.supabase
      .from('business_inside_categories')
      .select('id')
      .eq('name', name)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const response = await query.single()

    if (response.error && response.error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      this.handleError(
        response.error,
        'BusinessCategoryService.isBusinessInsideCategoryNameAvailable',
      )
    }

    return !response.data
  }

  /**
   * Create a new business inside category
   */
  async createBusinessInsideCategory(
    category: BusinessInsideCategoryInsert,
  ): Promise<BusinessInsideCategory> {
    this.validateRequired(
      category.name,
      'name',
      'BusinessCategoryService.createBusinessInsideCategory',
    )

    // Check name availability
    const isAvailable = await this.isBusinessInsideCategoryNameAvailable(
      category.name,
    )
    if (!isAvailable) {
      throw new Error('Category name already exists')
    }

    const response = await this.supabase
      .from('business_inside_categories')
      .insert(category)
      .select()
      .single()

    if (response.error) {
      this.handleError(
        response.error,
        'BusinessCategoryService.createBusinessInsideCategory',
      )
    }

    return response.data
  }

  // ==================== BUSINESS OUTSIDE CATEGORIES ====================

  /**
   * Get a business outside category by ID
   */
  async getBusinessOutsideCategory(
    id: string,
  ): Promise<BusinessOutsideCategory | null> {
    this.validateRequired(
      id,
      'id',
      'BusinessCategoryService.getBusinessOutsideCategory',
    )

    const response = await this.supabase
      .from('business_outside_categories')
      .select('*')
      .eq('id', id)
      .single()

    return this.handleOptionalResponse(
      response,
      'BusinessCategoryService.getBusinessOutsideCategory',
    )
  }

  /**
   * Get business outside categories list with filters and pagination
   */
  async getBusinessOutsideCategoriesList(
    filters?: CategoryFilters,
  ): Promise<CategoryListResult<BusinessOutsideCategory>> {
    let query = this.supabase
      .from('business_outside_categories')
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
        filters.offset + (filters.limit || 50) - 1,
      )
    }

    // Apply ordering
    query = query.order('name', { ascending: true })

    const response = await query

    if (response.error) {
      this.handleError(
        response.error,
        'BusinessCategoryService.getBusinessOutsideCategoriesList',
      )
    }

    return {
      data: response.data,
      count: response.count,
    }
  }

  /**
   * Get active business outside categories
   */
  async getActiveBusinessOutsideCategories(): Promise<
    Array<BusinessOutsideCategory>
  > {
    const response = await this.supabase
      .from('business_outside_categories')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (response.error) {
      this.handleError(
        response.error,
        'BusinessCategoryService.getActiveBusinessOutsideCategories',
      )
    }

    return response.data
  }

  /**
   * Search business outside categories
   */
  async searchBusinessOutsideCategories(
    searchQuery: string,
  ): Promise<Array<BusinessOutsideCategory>> {
    this.validateRequired(
      searchQuery,
      'searchQuery',
      'BusinessCategoryService.searchBusinessOutsideCategories',
    )

    if (searchQuery.length < 2) return []

    const response = await this.supabase
      .from('business_outside_categories')
      .select('*')
      .eq('is_active', true)
      .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
      .order('name', { ascending: true })
      .limit(50)

    if (response.error) {
      this.handleError(
        response.error,
        'BusinessCategoryService.searchBusinessOutsideCategories',
      )
    }

    return response.data
  }

  /**
   * Check if business outside category name is available
   */
  async isBusinessOutsideCategoryNameAvailable(
    name: string,
    excludeId?: string,
  ): Promise<boolean> {
    this.validateRequired(
      name,
      'name',
      'BusinessCategoryService.isBusinessOutsideCategoryNameAvailable',
    )

    let query = this.supabase
      .from('business_outside_categories')
      .select('id')
      .eq('name', name)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const response = await query.single()

    if (response.error && response.error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      this.handleError(
        response.error,
        'BusinessCategoryService.isBusinessOutsideCategoryNameAvailable',
      )
    }

    return !response.data
  }

  /**
   * Create a new business outside category
   */
  async createBusinessOutsideCategory(
    category: BusinessOutsideCategoryInsert,
  ): Promise<BusinessOutsideCategory> {
    this.validateRequired(
      category.name,
      'name',
      'BusinessCategoryService.createBusinessOutsideCategory',
    )

    // Check name availability
    const isAvailable = await this.isBusinessOutsideCategoryNameAvailable(
      category.name,
    )
    if (!isAvailable) {
      throw new Error('Category name already exists')
    }

    const response = await this.supabase
      .from('business_outside_categories')
      .insert(category)
      .select()
      .single()

    if (response.error) {
      this.handleError(
        response.error,
        'BusinessCategoryService.createBusinessOutsideCategory',
      )
    }

    return response.data
  }

  // ==================== COMBINED OPERATIONS ====================

  /**
   * Search across both category types
   */
  async searchAllCategories(
    searchQuery: string,
  ): Promise<CategorySearchResult> {
    this.validateRequired(
      searchQuery,
      'searchQuery',
      'BusinessCategoryService.searchAllCategories',
    )

    if (searchQuery.length < 2) {
      return { inside: [], outside: [], totalCount: 0 }
    }

    // Search both tables in parallel
    const [insideResponse, outsideResponse] = await Promise.all([
      this.supabase
        .from('business_inside_categories')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .order('name', { ascending: true })
        .limit(25),
      this.supabase
        .from('business_outside_categories')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .order('name', { ascending: true })
        .limit(25),
    ])

    if (insideResponse.error) {
      this.handleError(
        insideResponse.error,
        'BusinessCategoryService.searchAllCategories (inside)',
      )
    }
    if (outsideResponse.error) {
      this.handleError(
        outsideResponse.error,
        'BusinessCategoryService.searchAllCategories (outside)',
      )
    }

    const inside = insideResponse.data
    const outside = outsideResponse.data

    return {
      inside,
      outside,
      totalCount: inside.length + outside.length,
    }
  }
}

export const businessCategoryService = new BusinessCategoryService()
