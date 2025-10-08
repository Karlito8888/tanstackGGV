/**
 * Message Header Service
 *
 * Service layer for message header operations following the
 * Supabase Services & Hooks pattern.
 *
 * This service encapsulates:
 * - CRUD operations for messages_header
 * - Coin-based message publishing
 * - Message expiry management
 * - Cleanup operations
 * - Type-safe operations with proper error handling
 */

import { BaseService } from './base.service'
import type { InsertRow, Row, UpdateRow } from '../lib/database-types'

// Type aliases for better readability
type MessagesHeader = Row<'messages_header'>
type MessagesHeaderInsert = InsertRow<'messages_header'>
type MessagesHeaderUpdate = UpdateRow<'messages_header'>

// Additional types for complex operations
export interface MessagesHeaderFilters {
  userId?: string
  includeExpired?: boolean
  search?: string
  limit?: number
  offset?: number
}

export interface MessagesHeaderListResult {
  data: Array<MessagesHeader>
  count: number | null
}

export interface PublishMessageData {
  message: string
  coins_spent?: number
  expires_at?: string
}

export interface ExtendExpiryData {
  id: string
  additionalHours?: number
}

export interface CleanupResult {
  messages_cleaned: number
  coins_refunded: number
  source: string
}

export interface CleanupStatistics {
  total_messages: number
  active_messages: number
  expired_messages: number
  total_coins_spent: number
}

export interface CoinValidationResult {
  hasEnoughCoins: boolean
  currentCoins: number
  requiredCoins: number
  userId: string
}

export class MessageHeaderService extends BaseService {
  // ==================== BASIC CRUD OPERATIONS ====================

  /**
   * Get a message header by ID
   */
  async getMessageHeader(id: string): Promise<MessagesHeader | null> {
    this.validateRequired(id, 'id', 'MessageHeaderService.getMessageHeader')

    const response = await this.supabase
      .from('messages_header')
      .select('*')
      .eq('id', id)
      .single()

    return this.handleOptionalResponse(
      response,
      'MessageHeaderService.getMessageHeader',
    )
  }

  /**
   * Get message headers list with filters and pagination
   */
  async getMessageHeadersList(
    filters?: MessagesHeaderFilters,
  ): Promise<MessagesHeaderListResult> {
    let query = this.supabase
      .from('messages_header')
      .select('*', { count: 'exact' })

    // Apply filters
    if (filters?.userId) {
      query = query.eq('user_id', filters.userId)
    }
    if (filters?.search) {
      query = query.ilike('message', `%${filters.search}%`)
    }

    // Filter out expired messages unless explicitly requested
    if (!filters?.includeExpired) {
      query = query.or('expires_at.is.null,expires_at.gt.now()')
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

    // Order by created_at desc
    query = query.order('created_at', { ascending: false })

    const response = await query

    if (response.error) {
      this.handleError(
        response.error,
        'MessageHeaderService.getMessageHeadersList',
      )
    }

    return {
      data: response.data,
      count: response.count || null,
    }
  }

  /**
   * Create a new message header
   */
  async createMessageHeader(
    message: MessagesHeaderInsert,
  ): Promise<MessagesHeader> {
    this.validateRequired(
      message.message,
      'message',
      'MessageHeaderService.createMessageHeader',
    )
    this.validateRequired(
      message.user_id,
      'user_id',
      'MessageHeaderService.createMessageHeader',
    )

    const response = await this.supabase
      .from('messages_header')
      .insert(message)
      .select()
      .single()

    return this.handleResponse(
      response,
      'MessageHeaderService.createMessageHeader',
    )
  }

  /**
   * Update a message header
   */
  async updateMessageHeader(
    id: string,
    updates: MessagesHeaderUpdate,
  ): Promise<MessagesHeader> {
    this.validateRequired(id, 'id', 'MessageHeaderService.updateMessageHeader')

    const response = await this.supabase
      .from('messages_header')
      .update(this.createOptimisticUpdate(updates))
      .eq('id', id)
      .select()
      .single()

    return this.handleResponse(
      response,
      'MessageHeaderService.updateMessageHeader',
    )
  }

  /**
   * Delete a message header
   */
  async deleteMessageHeader(id: string): Promise<boolean> {
    this.validateRequired(id, 'id', 'MessageHeaderService.deleteMessageHeader')

    const { error } = await this.supabase
      .from('messages_header')
      .delete()
      .eq('id', id)

    if (error) {
      this.handleError(error, 'MessageHeaderService.deleteMessageHeader')
    }

    return true
  }

  // ==================== SPECIALIZED OPERATIONS ====================

  /**
   * Publish a message header with coin deduction
   */
  async publishMessageHeader(
    userId: string,
    data: PublishMessageData,
  ): Promise<MessagesHeader> {
    this.validateRequired(
      userId,
      'userId',
      'MessageHeaderService.publishMessageHeader',
    )
    this.validateRequired(
      data.message,
      'message',
      'MessageHeaderService.publishMessageHeader',
    )

    // Use the secure publish_header_message function for atomic coin deduction
    const rpcParams: any = {
      p_user_id: userId,
      p_message: data.message,
      p_coins_spent: data.coins_spent || 1,
    }

    if (data.expires_at) {
      rpcParams.p_expires_at = data.expires_at
    }

    const response = await this.supabase.rpc(
      'publish_header_message',
      rpcParams,
    )

    if (response.error) {
      // Handle specific coin-related errors
      if (response.error.message.includes('Not enough coins')) {
        throw new Error('Insufficient coins to publish this message')
      }
      this.handleError(
        response.error,
        'MessageHeaderService.publishMessageHeader',
      )
    }

    // Fetch the created message with profile data
    const messageResponse = await this.supabase
      .from('messages_header')
      .select(
        `
        *,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `,
      )
      .eq('user_id', userId)
      .eq('message', data.message)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return this.handleResponse(
      messageResponse,
      'MessageHeaderService.publishMessageHeader (Fetch)',
    )
  }

  /**
   * Extend message expiry
   */
  async extendMessageExpiry(data: ExtendExpiryData): Promise<MessagesHeader> {
    this.validateRequired(
      data.id,
      'id',
      'MessageHeaderService.extendMessageExpiry',
    )

    // First get current message to check existing expiry
    const currentMessageResponse = await this.supabase
      .from('messages_header')
      .select('expires_at')
      .eq('id', data.id)
      .single()

    if (currentMessageResponse.error) {
      this.handleError(
        currentMessageResponse.error,
        'MessageHeaderService.extendMessageExpiry (Fetch)',
      )
    }

    // Calculate new expiry date
    const currentExpiry = currentMessageResponse.data.expires_at
      ? new Date(currentMessageResponse.data.expires_at)
      : new Date()
    const newExpiry = new Date(
      currentExpiry.getTime() + (data.additionalHours || 24) * 60 * 60 * 1000,
    )

    const updateResponse = await this.supabase
      .from('messages_header')
      .update({
        expires_at: newExpiry.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id)
      .select(
        `
        *,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `,
      )
      .single()

    return this.handleResponse(
      updateResponse,
      'MessageHeaderService.extendMessageExpiry (Update)',
    )
  }

  /**
   * Get active messages for a user
   */
  async getActiveMessagesByUser(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Array<MessagesHeader>> {
    this.validateRequired(
      userId,
      'userId',
      'MessageHeaderService.getActiveMessagesByUser',
    )

    let query = this.supabase
      .from('messages_header')
      .select(
        `
        *,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `,
      )
      .eq('user_id', userId)
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('created_at', { ascending: false })

    if (options?.limit) {
      query = query.limit(options.limit)
    }
    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 50) - 1,
      )
    }

    const response = await query
    return this.handleResponse(
      response,
      'MessageHeaderService.getActiveMessagesByUser',
    )
  }

  /**
   * Get expired messages for a user
   */
  async getExpiredMessagesByUser(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Array<MessagesHeader>> {
    this.validateRequired(
      userId,
      'userId',
      'MessageHeaderService.getExpiredMessagesByUser',
    )

    let query = this.supabase
      .from('messages_header')
      .select(
        `
        *,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `,
      )
      .eq('user_id', userId)
      .not('expires_at', 'is', null)
      .lt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true })

    if (options?.limit) {
      query = query.limit(options.limit)
    }
    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 50) - 1,
      )
    }

    const response = await query
    return this.handleResponse(
      response,
      'MessageHeaderService.getExpiredMessagesByUser',
    )
  }

  /**
   * Search messages by user
   */
  async searchMessagesByUser(
    userId: string,
    searchQuery: string,
    options?: { limit?: number; includeExpired?: boolean },
  ): Promise<Array<MessagesHeader>> {
    this.validateRequired(
      userId,
      'userId',
      'MessageHeaderService.searchMessagesByUser',
    )
    this.validateRequired(
      searchQuery,
      'searchQuery',
      'MessageHeaderService.searchMessagesByUser',
    )

    if (searchQuery.length < 2) {
      return []
    }

    let query = this.supabase
      .from('messages_header')
      .select(
        `
        *,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `,
      )
      .eq('user_id', userId)
      .ilike('message', `%${searchQuery}%`)
      .order('created_at', { ascending: false })

    // Filter out expired messages unless explicitly requested
    if (!options?.includeExpired) {
      query = query.or('expires_at.is.null,expires_at.gt.now()')
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    const response = await query
    return this.handleResponse(
      response,
      'MessageHeaderService.searchMessagesByUser',
    )
  }

  // ==================== CLEANUP OPERATIONS ====================

  /**
   * Cleanup expired messages (manual implementation)
   */
  async cleanupExpiredMessages(): Promise<number> {
    // Manual cleanup since RPC types haven't been updated yet
    const { count, error } = await this.supabase
      .from('messages_header')
      .delete({ count: 'exact' })
      .not('expires_at', 'is', null)
      .lt('expires_at', new Date().toISOString())

    if (error) {
      this.handleError(error, 'MessageHeaderService.cleanupExpiredMessages')
    }

    return count || 0
  }

  /**
   * Coordinated cleanup
   */
  async coordinatedCleanup(): Promise<any> {
    const response = await this.supabase.rpc('coordinated_cleanup')

    if (response.error) {
      this.handleError(
        response.error,
        'MessageHeaderService.coordinatedCleanup',
      )
    }

    return response.data
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStatistics(): Promise<CleanupStatistics> {
    const response = await this.supabase.rpc('get_cleanup_statistics')

    if (response.error) {
      this.handleError(
        response.error,
        'MessageHeaderService.getCleanupStatistics',
      )
    }

    return response.data as unknown as CleanupStatistics
  }

  // ==================== COIN MANAGEMENT ====================

  /**
   * Validate user has sufficient coins
   */
  async validateUserCoins(
    requiredCoins: number,
  ): Promise<CoinValidationResult> {
    // Get current user
    const {
      data: { user },
      error: authError,
    } = await this.supabase.auth.getUser()
    if (authError || !user?.id) {
      throw new Error('User not authenticated')
    }

    // Get user profile to check coin balance
    const profileResponse = await this.supabase
      .from('profiles')
      .select('coins')
      .eq('id', user.id)
      .single()

    if (profileResponse.error) {
      this.handleError(
        profileResponse.error,
        'MessageHeaderService.validateUserCoins',
      )
    }

    const hasEnoughCoins = profileResponse.data.coins >= requiredCoins

    return {
      hasEnoughCoins,
      currentCoins: profileResponse.data.coins,
      requiredCoins,
      userId: user.id,
    }
  }

  /**
   * Get user's current coin balance
   */
  async getUserCoins(): Promise<number> {
    const {
      data: { user },
      error: authError,
    } = await this.supabase.auth.getUser()
    if (authError || !user?.id) {
      throw new Error('User not authenticated')
    }

    const profileResponse = await this.supabase
      .from('profiles')
      .select('coins')
      .eq('id', user.id)
      .single()

    if (profileResponse.error) {
      this.handleError(
        profileResponse.error,
        'MessageHeaderService.getUserCoins',
      )
    }

    return profileResponse.data.coins || 0
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get message statistics for a user
   */
  async getUserMessageStatistics(userId: string): Promise<{
    total: number
    active: number
    expired: number
    total_coins_spent: number
  }> {
    this.validateRequired(
      userId,
      'userId',
      'MessageHeaderService.getUserMessageStatistics',
    )

    const [allMessages, activeMessages, expiredMessages] = await Promise.all([
      this.supabase
        .from('messages_header')
        .select('coins_spent')
        .eq('user_id', userId),
      this.supabase
        .from('messages_header')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .or('expires_at.is.null,expires_at.gt.now()'),
      this.supabase
        .from('messages_header')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('expires_at', 'is', null)
        .lt('expires_at', new Date().toISOString()),
    ])

    if (allMessages.error) {
      this.handleError(
        allMessages.error,
        'MessageHeaderService.getUserMessageStatistics',
      )
    }

    const totalCoinsSpent = allMessages.data.reduce(
      (sum, msg) => sum + (msg.coins_spent || 0),
      0,
    )

    return {
      total: allMessages.data.length,
      active: activeMessages.count || 0,
      expired: expiredMessages.count || 0,
      total_coins_spent: totalCoinsSpent,
    }
  }

  /**
   * Check if message is expired
   */
  isMessageExpired(message: MessagesHeader): boolean {
    if (!message.expires_at) {
      return false
    }
    return new Date(message.expires_at) < new Date()
  }

  /**
   * Calculate message cost based on length and expiry
   */
  calculateMessageCost(
    message: string,
    expiresAt?: string,
    baseRate: number = 1,
  ): number {
    let cost = baseRate

    // Additional cost for longer messages
    if (message.length > 100) {
      cost += Math.floor((message.length - 100) / 50)
    }

    // Additional cost for expiry
    if (expiresAt) {
      const hours = Math.ceil(
        (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60),
      )
      if (hours > 24) {
        cost += Math.floor((hours - 24) / 24)
      }
    }

    return Math.max(1, cost) // Minimum 1 coin
  }
}

// Export singleton instance - reused throughout the application
export const messageHeaderService = new MessageHeaderService()
