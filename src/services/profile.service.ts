/**
 * Profile Service
 *
 * Service layer for all profile-related operations following the
 * Supabase Services & Hooks pattern.
 *
 * This service encapsulates:
 * - Basic CRUD operations for profiles
 * - RPC function calls (daily_checkin, safe_update_coins, safe_complete_onboarding)
 * - Complex business logic (coins, onboarding, admin operations)
 * - Type-safe operations with proper error handling
 */

import { BaseService } from './base.service'
import type { InsertRow, Profile, UpdateRow } from '../lib/database-types'

// Type aliases for better readability
type ProfileInsert = InsertRow<'profiles'>
type ProfileUpdate = UpdateRow<'profiles'>

// Additional types for complex operations
export interface ProfileFilters {
  is_admin?: boolean
  onboarding_completed?: boolean
  search?: string
  limit?: number
  offset?: number
}

export interface ProfileListResult {
  data: Array<Profile>
  count: number | null
}

export interface DailyCheckinResult {
  success: boolean
  coins: number
  message: string
  already_checked_today?: boolean
}

export interface OnboardingResult {
  id: string
  already_completed: boolean
  message: string
  [key: string]: any // Allow additional profile fields
}

export interface OnboardingInfo {
  completed: boolean
  completion_source: string | null
  completion_time: string | null
  message: string
}

// Type guards for RPC responses
function isDailyCheckinResult(data: any): data is DailyCheckinResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.success === 'boolean' &&
    typeof data.coins === 'number' &&
    typeof data.message === 'string'
  )
}

function isOnboardingResult(
  data: any,
): data is { already_completed: boolean; message: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.already_completed === 'boolean' &&
    typeof data.message === 'string'
  )
}

function isOnboardingInfo(data: any): data is OnboardingInfo {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.completed === 'boolean' &&
    typeof data.message === 'string'
  )
}

export class ProfileService extends BaseService {
  // ==================== BASIC CRUD OPERATIONS ====================

  /**
   * Get a profile by ID
   */
  async getProfile(id: string): Promise<Profile | null> {
    this.validateRequired(id, 'id', 'ProfileService.getProfile')

    const response = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    return this.handleOptionalResponse(response, 'ProfileService.getProfile')
  }

  /**
   * Get a profile by username
   */
  async getProfileByUsername(username: string): Promise<Profile | null> {
    this.validateRequired(
      username,
      'username',
      'ProfileService.getProfileByUsername',
    )

    const response = await this.supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single()

    return this.handleOptionalResponse(
      response,
      'ProfileService.getProfileByUsername',
    )
  }

  /**
   * Get current user profile
   */
  async getCurrentUserProfile(userId: string): Promise<Profile | null> {
    this.validateRequired(
      userId,
      'userId',
      'ProfileService.getCurrentUserProfile',
    )

    const response = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    return this.handleOptionalResponse(
      response,
      'ProfileService.getCurrentUserProfile',
    )
  }

  /**
   * Get profiles list with filters and pagination
   */
  async getProfilesList(filters?: ProfileFilters): Promise<ProfileListResult> {
    let query = this.supabase.from('profiles').select('*', { count: 'exact' })

    // Apply filters
    if (filters?.is_admin !== undefined) {
      query = query.eq('is_admin', filters.is_admin)
    }
    if (filters?.onboarding_completed !== undefined) {
      query = query.eq('onboarding_completed', filters.onboarding_completed)
    }
    if (filters?.search) {
      query = query.or(
        `full_name.ilike.%${filters.search}%,username.ilike.%${filters.search}%`,
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
      this.handleError(response.error, 'ProfileService.getProfilesList')
    }

    return {
      data: response.data,
      count: response.count || null,
    }
  }

  /**
   * Update a profile
   */
  async updateProfile(id: string, updates: ProfileUpdate): Promise<Profile> {
    this.validateRequired(id, 'id', 'ProfileService.updateProfile')

    const response = await this.supabase
      .from('profiles')
      .update(this.createOptimisticUpdate(updates))
      .eq('id', id)
      .select()
      .single()

    return this.handleResponse(response, 'ProfileService.updateProfile')
  }

  /**
   * Delete a profile
   */
  async deleteProfile(id: string): Promise<boolean> {
    this.validateRequired(id, 'id', 'ProfileService.deleteProfile')

    const { error } = await this.supabase.from('profiles').delete().eq('id', id)

    if (error) {
      this.handleError(error, 'ProfileService.deleteProfile')
    }

    return true
  }

  // ==================== SPECIALIZED OPERATIONS ====================

  /**
   * Update profile coins with validation
   */
  async updateProfileCoins(
    id: string,
    coins: number,
    operation: 'set' | 'add' | 'subtract' = 'set',
  ): Promise<Profile> {
    this.validateRequired(id, 'id', 'ProfileService.updateProfileCoins')
    this.validateRequired(coins, 'coins', 'ProfileService.updateProfileCoins')

    // Use the safe coin update function with validation
    const rpcResponse = await this.supabase.rpc('safe_update_coins', {
      user_id_param: id,
      new_coins: coins,
      operation: operation,
    })

    if (rpcResponse.error) {
      this.handleError(
        rpcResponse.error,
        'ProfileService.updateProfileCoins (RPC)',
      )
    }

    const rpcData = rpcResponse.data
    if (
      !rpcData ||
      typeof rpcData !== 'object' ||
      !('success' in rpcData) ||
      !rpcData.success
    ) {
      const message =
        rpcData && typeof rpcData === 'object' && 'message' in rpcData
          ? String(rpcData.message)
          : 'Coin update failed'
      this.handleError(
        new Error(message),
        'ProfileService.updateProfileCoins (Validation)',
      )
    }

    // Fetch the updated profile
    const profileResponse = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    return this.handleResponse(
      profileResponse,
      'ProfileService.updateProfileCoins (Fetch)',
    )
  }

  /**
   * Complete onboarding with safety checks
   */
  async completeOnboarding(id: string): Promise<OnboardingResult> {
    this.validateRequired(id, 'id', 'ProfileService.completeOnboarding')

    // Use the safe onboarding completion function that checks trigger state
    const rpcResponse = await this.supabase.rpc('safe_complete_onboarding', {
      user_id_param: id,
    })

    if (rpcResponse.error) {
      this.handleError(
        rpcResponse.error,
        'ProfileService.completeOnboarding (RPC)',
      )
    }

    const rpcData = rpcResponse.data
    if (!isOnboardingResult(rpcData)) {
      this.handleError(
        new Error('Invalid onboarding response'),
        'ProfileService.completeOnboarding',
      )
    }

    // Check if already completed
    if (rpcData.already_completed) {
      return {
        id,
        already_completed: true,
        message: rpcData.message,
      }
    }

    // Fetch the updated profile
    const profileResponse = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    const profileData = this.handleResponse(
      profileResponse,
      'ProfileService.completeOnboarding (Fetch)',
    )

    return {
      ...profileData,
      already_completed: false,
      message: rpcData.message,
    }
  }

  /**
   * Perform daily checkin
   */
  async dailyCheckin(userId: string): Promise<DailyCheckinResult> {
    this.validateRequired(userId, 'userId', 'ProfileService.dailyCheckin')

    const response = await this.supabase.rpc('daily_checkin', {
      user_id: userId,
    })

    if (response.error) {
      this.handleError(response.error, 'ProfileService.dailyCheckin')
    }

    const data = response.data
    if (!isDailyCheckinResult(data)) {
      this.handleError(
        new Error('Invalid daily checkin response'),
        'ProfileService.dailyCheckin',
      )
    }

    return data
  }

  /**
   * Get onboarding completion info
   */
  async getOnboardingCompletionInfo(userId: string): Promise<OnboardingInfo> {
    this.validateRequired(
      userId,
      'userId',
      'ProfileService.getOnboardingCompletionInfo',
    )

    const response = await this.supabase.rpc('get_onboarding_completion_info', {
      user_id_param: userId,
    })

    if (response.error) {
      this.handleError(
        response.error,
        'ProfileService.getOnboardingCompletionInfo',
      )
    }

    const data = response.data
    if (!isOnboardingInfo(data)) {
      this.handleError(
        new Error('Invalid onboarding info response'),
        'ProfileService.getOnboardingCompletionInfo',
      )
    }

    return data
  }

  // ==================== ADMIN OPERATIONS ====================

  /**
   * Admin-only profile update
   */
  async adminUpdateProfile(
    id: string,
    updates: ProfileUpdate,
  ): Promise<Profile> {
    this.validateRequired(id, 'id', 'ProfileService.adminUpdateProfile')

    const response = await this.supabase
      .from('profiles')
      .update(this.createOptimisticUpdate(updates))
      .eq('id', id)
      .select()
      .single()

    return this.handleResponse(response, 'ProfileService.adminUpdateProfile')
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Create a new profile (for admin use only)
   * Note: Profile creation is typically handled by database trigger
   */
  async createProfile(profile: ProfileInsert): Promise<Profile> {
    const response = await this.supabase
      .from('profiles')
      .insert(profile)
      .select()
      .single()

    return this.handleResponse(response, 'ProfileService.createProfile')
  }

  /**
   * Search profiles by multiple criteria
   */
  async searchProfiles(
    query: string,
    limit: number = 10,
  ): Promise<Array<Profile>> {
    const response = await this.supabase
      .from('profiles')
      .select('*')
      .or(
        `full_name.ilike.%${query}%,username.ilike.%${query}%,email.ilike.%${query}%`,
      )
      .limit(limit)

    return this.handleResponse(response, 'ProfileService.searchProfiles')
  }

  /**
   * Get profiles by admin status
   */
  async getProfilesByAdminStatus(isAdmin: boolean): Promise<Array<Profile>> {
    const response = await this.supabase
      .from('profiles')
      .select('*')
      .eq('is_admin', isAdmin)
      .order('created_at', { ascending: false })

    return this.handleResponse(
      response,
      'ProfileService.getProfilesByAdminStatus',
    )
  }

  /**
   * Get profiles with incomplete onboarding
   */
  async getProfilesWithIncompleteOnboarding(): Promise<Array<Profile>> {
    const response = await this.supabase
      .from('profiles')
      .select('*')
      .is('onboarding_completed', null)
      .order('created_at', { ascending: false })

    return this.handleResponse(
      response,
      'ProfileService.getProfilesWithIncompleteOnboarding',
    )
  }
}

// Export singleton instance - reused throughout the application
export const profileService = new ProfileService()
