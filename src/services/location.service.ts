/**
 * Location Service
 *
 * Service layer for all location-related operations following the
 * Supabase Services & Hooks pattern.
 *
 * This service encapsulates:
 * - Location CRUD operations with filtering
 * - Search capabilities
 * - Admin operations
 * - Type-safe operations with proper error handling
 */

import { BaseService } from './base.service'
import type { Row } from '../lib/database-types'

type Location = Row<'locations'>

export interface LocationFilters {
  is_locked?: boolean
  block?: string
  lot?: string
  limit?: number
  offset?: number
}

export interface LocationListResult {
  data: Array<Location>
  count: number | null
}

export class LocationService extends BaseService {
  /**
   * Get locations list with filters and pagination
   */
  async getLocationsList(
    filters?: LocationFilters,
  ): Promise<LocationListResult> {
    let query = this.supabase.from('locations').select('*', { count: 'exact' })

    // Apply filters
    if (filters?.is_locked !== undefined) {
      query = query.eq('is_locked', filters.is_locked)
    }
    if (filters?.block) {
      query = query.ilike('block', `%${filters.block}%`)
    }
    if (filters?.lot) {
      query = query.ilike('lot', `%${filters.lot}%`)
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

    // Order by block, then lot
    query = query
      .order('block', { ascending: true })
      .order('lot', { ascending: true })

    const response = await query

    if (response.error) {
      this.handleError(response.error, 'LocationService.getLocationsList')
    }

    return {
      data: response.data,
      count: response.count || null,
    }
  }

  /**
   * Get a location by ID
   */
  async getLocation(id: string): Promise<Location | null> {
    this.validateRequired(id, 'id', 'LocationService.getLocation')

    const response = await this.supabase
      .from('locations')
      .select('*')
      .eq('id', id)
      .single()

    return this.handleOptionalResponse(response, 'LocationService.getLocation')
  }

  /**
   * Get locations by block
   */
  async getLocationsByBlock(block: string): Promise<Array<Location>> {
    this.validateRequired(block, 'block', 'LocationService.getLocationsByBlock')

    const response = await this.supabase
      .from('locations')
      .select('*')
      .eq('block', block)
      .order('lot', { ascending: true })

    return this.handleResponse(response, 'LocationService.getLocationsByBlock')
  }

  /**
   * Search locations
   */
  async searchLocations(
    searchQuery: string,
    limit: number = 50,
  ): Promise<Array<Location>> {
    this.validateRequired(
      searchQuery,
      'searchQuery',
      'LocationService.searchLocations',
    )

    const response = await this.supabase
      .from('locations')
      .select('*')
      .or(
        `block.ilike.%${searchQuery}%,lot.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`,
      )
      .order('block', { ascending: true })
      .order('lot', { ascending: true })
      .limit(limit)

    return this.handleResponse(response, 'LocationService.searchLocations')
  }

  /**
   * Create a new location
   */
  async createLocation(
    locationData: Omit<Location, 'id' | 'created_at'>,
  ): Promise<Location> {
    const response = await this.supabase
      .from('locations')
      .insert(locationData)
      .select()
      .single()

    return this.handleResponse(response, 'LocationService.createLocation')
  }

  /**
   * Update a location
   */
  async updateLocation(
    id: string,
    updates: Partial<Omit<Location, 'id' | 'created_at'>>,
  ): Promise<Location> {
    this.validateRequired(id, 'id', 'LocationService.updateLocation')

    const response = await this.supabase
      .from('locations')
      .update(this.createOptimisticUpdate(updates))
      .eq('id', id)
      .select()
      .single()

    return this.handleResponse(response, 'LocationService.updateLocation')
  }

  /**
   * Delete a location
   */
  async deleteLocation(id: string): Promise<boolean> {
    this.validateRequired(id, 'id', 'LocationService.deleteLocation')

    const { error } = await this.supabase
      .from('locations')
      .delete()
      .eq('id', id)

    if (error) {
      this.handleError(error, 'LocationService.deleteLocation')
    }

    return true
  }

  /**
   * Lock a location
   */
  async lockLocation(id: string): Promise<Location> {
    this.validateRequired(id, 'id', 'LocationService.lockLocation')

    const response = await this.supabase
      .from('locations')
      .update({
        is_locked: true,
        locked_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    return this.handleResponse(response, 'LocationService.lockLocation')
  }

  /**
   * Unlock a location
   */
  async unlockLocation(id: string): Promise<Location> {
    this.validateRequired(id, 'id', 'LocationService.unlockLocation')

    const response = await this.supabase
      .from('locations')
      .update({
        is_locked: false,
        locked_at: null,
      })
      .eq('id', id)
      .select()
      .single()

    return this.handleResponse(response, 'LocationService.unlockLocation')
  }

  /**
   * Get locked locations
   */
  async getLockedLocations(): Promise<Array<Location>> {
    const response = await this.supabase
      .from('locations')
      .select('*')
      .eq('is_locked', true)
      .order('locked_at', { ascending: false })

    return this.handleResponse(response, 'LocationService.getLockedLocations')
  }

  /**
   * Get available (unlocked) locations
   */
  async getAvailableLocations(): Promise<Array<Location>> {
    const response = await this.supabase
      .from('locations')
      .select('*')
      .eq('is_locked', false)
      .order('block', { ascending: true })
      .order('lot', { ascending: true })

    return this.handleResponse(
      response,
      'LocationService.getAvailableLocations',
    )
  }

  /**
   * Get unique blocks
   */
  async getBlocks(): Promise<Array<string>> {
    const response = await this.supabase
      .from('locations')
      .select('block')
      .order('block', { ascending: true })

    if (response.error) {
      this.handleError(response.error, 'LocationService.getBlocks')
    }

    // Extract unique blocks
    const blocks = [
      ...new Set(response.data.map((loc) => loc.block).filter(Boolean)),
    ]
    return blocks
  }

  /**
   * Get lots in a specific block
   */
  async getLotsInBlock(block: string): Promise<Array<Location>> {
    this.validateRequired(block, 'block', 'LocationService.getLotsInBlock')

    const response = await this.supabase
      .from('locations')
      .select('*')
      .eq('block', block)
      .order('lot', { ascending: true })

    return this.handleResponse(response, 'LocationService.getLotsInBlock')
  }
}

// Export singleton instance
export const locationService = new LocationService()
