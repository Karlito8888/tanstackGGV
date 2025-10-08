/**
 * Marketplace Service
 *
 * Handles marketplace listings with mobile-first optimizations.
 * Includes product listings, categories, search, status management, and RLS compliance.
 */

import { BaseService } from './base.service'
import type { Database } from '../lib/database-types'

type MarketplaceListing =
  Database['public']['Tables']['marketplace_listings']['Row']
type MarketplaceListingInsert =
  Database['public']['Tables']['marketplace_listings']['Insert']
type MarketplaceListingUpdate =
  Database['public']['Tables']['marketplace_listings']['Update']

export interface MarketplaceListingWithRelations extends MarketplaceListing {
  profiles: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
    profile_location_associations: Array<{
      locations: {
        id: string
        block: string | null
        lot: string | null
      } | null
    }>
  }
}

export interface MarketplaceFilters {
  profileId?: string
  category?: string
  listingType?: 'selling' | 'buying'
  status?: 'available' | 'pending' | 'sold' | 'expired'
  featured?: boolean
  active?: boolean
  priceMin?: number
  priceMax?: number
  search?: string
  limit?: number
  offset?: number
}

export interface MarketplaceListResult {
  data: Array<MarketplaceListingWithRelations>
  count: number
}

export class MarketplaceService extends BaseService {
  /**
   * Get a single marketplace listing with relations
   */
  async getListing(id: string): Promise<MarketplaceListingWithRelations> {
    this.validateRequired(id, 'id', 'getListing')

    const response = await this.supabase
      .from('marketplace_listings')
      .select(
        `
        *,
        profiles (
          id,
          username,
          full_name,
          avatar_url,
          profile_location_associations (
            locations (
              id,
              block,
              lot
            )
          )
        )
      `,
      )
      .eq('id', id)
      .single()

    return this.handleResponse(response, 'getListing') as any
  }

  /**
   * Get marketplace listings with filtering and pagination
   */
  async getListings(
    filters?: MarketplaceFilters,
  ): Promise<MarketplaceListResult> {
    let query = this.supabase.from('marketplace_listings').select(
      `
      *,
      profiles (
        id,
        username,
        full_name,
        avatar_url,
        profile_location_associations (
          locations (
            id,
            block,
            lot
          )
        )
      )
    `,
      { count: 'exact' },
    )

    // Apply filters
    if (filters?.profileId) {
      query = query.eq('profile_id', filters.profileId)
    }
    if (filters?.category) {
      query = query.eq('category', filters.category)
    }
    if (filters?.listingType) {
      query = query.eq('listing_type', filters.listingType)
    }
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.featured !== undefined) {
      query = query.eq('is_featured', filters.featured)
    }
    if (filters?.active !== undefined) {
      query = query.eq('is_active', filters.active)
    }
    if (filters?.priceMin !== undefined) {
      query = query.gte('price', filters.priceMin)
    }
    if (filters?.priceMax !== undefined) {
      query = query.lte('price', filters.priceMax)
    }
    if (filters?.search) {
      query = query.or(
        `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,category.ilike.%${filters.search}%`,
      )
    }

    // Order by featured first, then created_at desc
    query = query
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })

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

    const response = await query
    const data = this.handleResponse(response, 'getListings')

    return {
      data: data as Array<any>,
      count: response.count || 0,
    }
  }

  /**
   * Get listings by profile
   */
  async getListingsByProfile(profileId: string): Promise<Array<MarketplaceListing>> {
    this.validateRequired(profileId, 'profileId', 'getListingsByProfile')

    // Check if current user can see all listings or only active ones
    const { data: currentUser } = await this.supabase.auth.getUser()
    const isCurrentUser = currentUser.user?.id === profileId

    let query = this.supabase
      .from('marketplace_listings')
      .select('*')
      .eq('profile_id', profileId)

    // If not current user, only show active listings (RLS will enforce this)
    if (!isCurrentUser) {
      query = query.eq('is_active', true)
    }

    query = query.order('created_at', { ascending: false })

    const response = await query
    return this.handleResponse(response, 'getListingsByProfile')
  }

  /**
   * Get featured listings
   */
  async getFeaturedListings(
    limit = 10,
  ): Promise<Array<MarketplaceListingWithRelations>> {
    const response = await this.supabase
      .from('marketplace_listings')
      .select(
        `
        *,
        profiles (
          id,
          username,
          full_name,
          avatar_url,
          profile_location_associations (
            locations (
              id,
              block,
              lot
            )
          )
        )
      `,
      )
      .eq('is_featured', true)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    const data = this.handleResponse(response, 'getFeaturedListings')

    // Filter client-side for available status
    const filteredData = data.filter(
      (listing: any) => listing.status === 'available',
    )

    return filteredData as Array<any>
  }

  /**
   * Get active listings
   */
  async getActiveListings(
    limit = 20,
  ): Promise<Array<MarketplaceListingWithRelations>> {
    const response = await this.supabase
      .from('marketplace_listings')
      .select(
        `
        *,
        profiles (
          id,
          username,
          full_name,
          avatar_url,
          profile_location_associations (
            locations (
              id,
              block,
              lot
            )
          )
        )
      `,
      )
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    const data = this.handleResponse(response, 'getActiveListings')

    // Filter client-side for available status
    const filteredData = data.filter(
      (listing: any) => listing.status === 'available',
    )

    return filteredData as Array<any>
  }

  /**
   * Create a marketplace listing
   */
  async createListing(
    listingData: MarketplaceListingInsert,
  ): Promise<MarketplaceListing> {
    this.validateRequired(listingData, 'listingData', 'createListing')

    const response = await this.supabase
      .from('marketplace_listings')
      .insert(listingData)
      .select()
      .single()

    return this.handleResponse(response, 'createListing')
  }

  /**
   * Update a marketplace listing
   */
  async updateListing(
    id: string,
    updates: MarketplaceListingUpdate,
  ): Promise<MarketplaceListing> {
    this.validateRequired(id, 'id', 'updateListing')
    this.validateRequired(updates, 'updates', 'updateListing')

    const response = await this.supabase
      .from('marketplace_listings')
      .update(this.createOptimisticUpdate(updates))
      .eq('id', id)
      .select()
      .single()

    return this.handleResponse(response, 'updateListing')
  }

  /**
   * Update listing status
   */
  async updateListingStatus(
    id: string,
    status: 'available' | 'pending' | 'sold' | 'expired',
  ): Promise<MarketplaceListing> {
    this.validateRequired(id, 'id', 'updateListingStatus')

    const response = await this.supabase
      .from('marketplace_listings')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    return this.handleResponse(response, 'updateListingStatus')
  }

  /**
   * Toggle featured status
   */
  async toggleFeatured(
    id: string,
    is_featured: boolean,
  ): Promise<MarketplaceListing> {
    this.validateRequired(id, 'id', 'toggleFeatured')

    const response = await this.supabase
      .from('marketplace_listings')
      .update({
        is_featured,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    return this.handleResponse(response, 'toggleFeatured')
  }

  /**
   * Delete a marketplace listing
   */
  async deleteListing(id: string): Promise<void> {
    this.validateRequired(id, 'id', 'deleteListing')

    const response = await this.supabase
      .from('marketplace_listings')
      .delete()
      .eq('id', id)

    this.handleResponse(response, 'deleteListing')
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser() {
    const { data: currentUser } = await this.supabase.auth.getUser()
    return currentUser.user
  }

  /**
   * Check if user can manage a listing
   */
  async canManageListing(listingId: string): Promise<boolean> {
    this.validateRequired(listingId, 'listingId', 'canManageListing')

    const currentUser = await this.getCurrentUser()
    if (!currentUser) return false

    // Check if user is admin
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', currentUser.id)
      .single()

    if (profile?.is_admin) return true

    // Check if user owns the listing
    const { data: listing } = await this.supabase
      .from('marketplace_listings')
      .select('profile_id')
      .eq('id', listingId)
      .single()

    return listing?.profile_id === currentUser.id
  }
}
