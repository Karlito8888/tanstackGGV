/**
 * Chat Service
 *
 * Service layer for all chat-related operations following the
 * Supabase Services & Hooks pattern.
 *
 * This service encapsulates:
 * - Real-time message subscriptions
 * - Message CRUD operations with profile joins
 * - Reply functionality
 * - Search capabilities
 * - Type-safe operations with proper error handling
 */

import { BaseService } from './base.service'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { InsertRow, Row } from '../lib/database-types'

// Type aliases for better readability
type ChatMessage = Row<'chat'>
type ChatMessageInsert = InsertRow<'chat'>

// Extended types for complex operations
export interface MessageWithProfile extends ChatMessage {
  profiles: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
  reply_message?: {
    id: string
    content: string
    user_id: string | null
    created_at: string | null
  } | null
}

export interface MessageFilters {
  channelId?: string
  userId?: string
  limit?: number
  offset?: number
}

export interface SearchFilters {
  channelId?: string
  limit?: number
}

export interface SendMessageData {
  channel_id: string
  content: string
  reply_to?: string
}

export class ChatService extends BaseService {
  private channels: Map<string, RealtimeChannel> = new Map()

  // ==================== MESSAGE QUERIES ====================

  /**
   * Get messages by channel with profile joins
   */
  async getMessagesByChannel(
    channelId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Array<MessageWithProfile>> {
    this.validateRequired(
      channelId,
      'channelId',
      'ChatService.getMessagesByChannel',
    )

    let query = this.supabase
      .from('chat')
      .select(
        `
        *,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url
        ),
        reply_message:reply_to (
          id,
          content,
          user_id,
          created_at
        )
      `,
      )
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })

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
    return this.handleResponse(response, 'ChatService.getMessagesByChannel')
  }

  /**
   * Get messages by user
   */
  async getMessagesByUser(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Array<ChatMessage>> {
    this.validateRequired(userId, 'userId', 'ChatService.getMessagesByUser')

    let query = this.supabase
      .from('chat')
      .select('*')
      .eq('user_id', userId)
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
    return this.handleResponse(response, 'ChatService.getMessagesByUser')
  }

  /**
   * Get message replies
   */
  async getMessageReplies(
    messageId: string,
  ): Promise<Array<MessageWithProfile>> {
    this.validateRequired(
      messageId,
      'messageId',
      'ChatService.getMessageReplies',
    )

    const response = await this.supabase
      .from('chat')
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
      .eq('reply_to', messageId)
      .order('created_at', { ascending: true })

    return this.handleResponse(response, 'ChatService.getMessageReplies')
  }

  /**
   * Search messages
   */
  async searchMessages(
    searchQuery: string,
    filters?: SearchFilters,
  ): Promise<Array<MessageWithProfile>> {
    this.validateRequired(
      searchQuery,
      'searchQuery',
      'ChatService.searchMessages',
    )

    let query = this.supabase
      .from('chat')
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
      .ilike('content', `%${searchQuery}%`)
      .order('created_at', { ascending: false })

    if (filters?.channelId) {
      query = query.eq('channel_id', filters.channelId)
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    const response = await query
    return this.handleResponse(response, 'ChatService.searchMessages')
  }

  // ==================== MESSAGE MUTATIONS ====================

  /**
   * Send a message
   */
  async sendMessage(messageData: SendMessageData): Promise<MessageWithProfile> {
    this.validateRequired(
      messageData.channel_id,
      'channel_id',
      'ChatService.sendMessage',
    )
    this.validateRequired(
      messageData.content,
      'content',
      'ChatService.sendMessage',
    )

    const insertData: ChatMessageInsert = {
      channel_id: messageData.channel_id,
      content: messageData.content,
      reply_to: messageData.reply_to,
      // user_id will be automatically set by RLS policy using auth.uid()
    }

    const response = await this.supabase
      .from('chat')
      .insert(insertData)
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

    return this.handleResponse(response, 'ChatService.sendMessage')
  }

  /**
   * Edit a message
   */
  async editMessage(id: string, content: string): Promise<MessageWithProfile> {
    this.validateRequired(id, 'id', 'ChatService.editMessage')
    this.validateRequired(content, 'content', 'ChatService.editMessage')

    const response = await this.supabase
      .from('chat')
      .update({
        content,
        is_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      // RLS will automatically ensure user can only edit their own messages
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

    return this.handleResponse(response, 'ChatService.editMessage')
  }

  /**
   * Delete a message
   */
  async deleteMessage(id: string): Promise<boolean> {
    this.validateRequired(id, 'id', 'ChatService.deleteMessage')

    const { error } = await this.supabase.from('chat').delete().eq('id', id)
    // RLS will automatically ensure user can only delete their own messages

    if (error) {
      this.handleError(error, 'ChatService.deleteMessage')
    }

    return true
  }

  // ==================== REAL-TIME SUBSCRIPTIONS ====================

  /**
   * Subscribe to channel messages
   */
  subscribeToChannel(
    channelId: string,
    onMessage: (message: MessageWithProfile) => void,
  ): () => void {
    this.validateRequired(
      channelId,
      'channelId',
      'ChatService.subscribeToChannel',
    )

    const channelKey = `chat_${channelId}`

    // Clean up existing subscription if any
    if (this.channels.has(channelKey)) {
      this.channels.get(channelKey)?.unsubscribe()
    }

    const channel = this.supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          try {
            // Fetch complete message with profile data
            const { data } = await this.supabase
              .from('chat')
              .select(
                `
              *,
              profiles:user_id (
                id,
                username,
                full_name,
                avatar_url
              ),
              reply_message:reply_to (
                id,
                content,
                user_id,
                created_at
              )
            `,
              )
              .eq('id', payload.new.id)
              .single()

            if (data) {
              onMessage(data as MessageWithProfile)
            }
          } catch (error) {
            console.error('Error fetching new message:', error)
          }
        },
      )
      .subscribe()

    this.channels.set(channelKey, channel)

    // Return cleanup function
    return () => {
      channel.unsubscribe()
      this.channels.delete(channelKey)
    }
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll(): void {
    for (const [, channel] of this.channels) {
      channel.unsubscribe()
    }
    this.channels.clear()
  }

  /**
   * Unsubscribe from specific channel
   */
  unsubscribeFromChannel(channelId: string): void {
    const channelKey = `chat_${channelId}`
    const channel = this.channels.get(channelKey)
    if (channel) {
      channel.unsubscribe()
      this.channels.delete(channelKey)
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get message by ID with full profile data
   */
  async getMessageById(id: string): Promise<MessageWithProfile | null> {
    this.validateRequired(id, 'id', 'ChatService.getMessageById')

    const response = await this.supabase
      .from('chat')
      .select(
        `
        *,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url
        ),
        reply_message:reply_to (
          id,
          content,
          user_id,
          created_at
        )
      `,
      )
      .eq('id', id)
      .single()

    const data = this.handleOptionalResponse(
      response,
      'ChatService.getMessageById',
    )
    return data as MessageWithProfile | null
  }

  /**
   * Get channel statistics
   */
  async getChannelStats(channelId: string): Promise<{
    messageCount: number
    participantCount: number
    lastMessageAt: string | null
  }> {
    this.validateRequired(channelId, 'channelId', 'ChatService.getChannelStats')

    // Get message count and last message
    const { data: messages, error: messagesError } = await this.supabase
      .from('chat')
      .select('created_at')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (messagesError) {
      this.handleError(messagesError, 'ChatService.getChannelStats (messages)')
    }

    // Get unique participants count
    const { count: participantCount, error: participantsError } =
      await this.supabase
        .from('chat')
        .select('user_id', { count: 'exact', head: true })
        .eq('channel_id', channelId)

    if (participantsError) {
      this.handleError(
        participantsError,
        'ChatService.getChannelStats (participants)',
      )
    }

    return {
      messageCount: messages.length || 0,
      participantCount: participantCount || 0,
      lastMessageAt: messages[0]?.created_at || null,
    }
  }
}

// Export singleton instance
export const chatService = new ChatService()
