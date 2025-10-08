/**
 * Private Message Service
 *
 * Handles user-to-user messaging with mobile-first optimizations.
 * Includes conversation grouping, read status, attachments, and search functionality.
 */

import { BaseService } from './base.service'
import type { Database } from '../lib/database-types'

type PrivateMessage = Database['public']['Tables']['private_messages']['Row']
type PrivateMessageInsert =
  Database['public']['Tables']['private_messages']['Insert']
type PrivateMessageUpdate =
  Database['public']['Tables']['private_messages']['Update']

export interface PrivateMessageWithRelations
  extends Omit<PrivateMessage, 'sender' | 'receiver' | 'reply_message'> {
  sender?: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
  receiver?: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
  reply_message?: {
    id: string
    message: string
    sender_id: string | null
    created_at: string
  } | null
}

export interface Conversation {
  id: string
  other_user: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  }
  last_message: PrivateMessageWithRelations
  unread_count: number
}

export interface ConversationFilters {
  limit?: number
  offset?: number
}

export interface MessageFilters {
  limit?: number
  offset?: number
}

export class PrivateMessageService extends BaseService {
  /**
   * Get conversations for a user
   */
  async getConversations(
    userId: string,
    filters?: ConversationFilters,
  ): Promise<Array<Conversation>> {
    this.validateRequired(userId, 'userId', 'getConversations')

    let query = this.supabase
      .from('private_messages')
      .select(
        `
        *,
        sender:sender_id (
          id,
          username,
          full_name,
          avatar_url
        ),
        receiver:receiver_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `,
      )
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }
    if (filters?.offset) {
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit || 50) - 1,
      )
    }

    const response = await query
    const messages = this.handleResponse(
      response,
      'getConversations',
    ) as Array<PrivateMessageWithRelations>

    // Group messages by conversation
    const conversations = new Map<string, Conversation>()

    messages.forEach((message) => {
      const otherUserId =
        message.sender_id === userId ? message.receiver_id : message.sender_id

      if (!otherUserId) return

      const conversationKey = [userId, otherUserId].sort().join('-')

      if (!conversations.has(conversationKey)) {
        conversations.set(conversationKey, {
          id: conversationKey,
          other_user:
            message.sender_id === userId
              ? (message as any).receiver
              : (message as any).sender,
          last_message: message,
          unread_count: 0,
        })
      }

      // Count unread messages
      if (message.receiver_id === userId && !message.read_at) {
        const conversation = conversations.get(conversationKey)!
        conversation.unread_count += 1
      }
    })

    return Array.from(conversations.values())
  }

  /**
   * Get conversation between two users
   */
  async getConversation(
    userId1: string,
    userId2: string,
    filters?: MessageFilters,
  ): Promise<Array<PrivateMessageWithRelations>> {
    this.validateRequired(userId1, 'userId1', 'getConversation')
    this.validateRequired(userId2, 'userId2', 'getConversation')

    let query = this.supabase
      .from('private_messages')
      .select(
        `
        *,
        sender:sender_id (
          id,
          username,
          full_name,
          avatar_url
        ),
        receiver:receiver_id (
          id,
          username,
          full_name,
          avatar_url
        ),
        reply_message:reply_to (
          id,
          message,
          sender_id,
          created_at
        )
      `,
      )
      .or(
        `(sender_id.eq.${userId1},receiver_id.eq.${userId2}),(sender_id.eq.${userId2},receiver_id.eq.${userId1})`,
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }
    if (filters?.offset) {
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit || 50) - 1,
      )
    }

    const response = await query
    return this.handleResponse(
      response,
      'getConversation',
    ) as Array<PrivateMessageWithRelations>
  }

  /**
   * Get sent messages
   */
  async getSentMessages(
    senderId: string,
    filters?: MessageFilters,
  ): Promise<Array<PrivateMessageWithRelations>> {
    this.validateRequired(senderId, 'senderId', 'getSentMessages')

    let query = this.supabase
      .from('private_messages')
      .select(
        `
        *,
        receiver:receiver_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `,
      )
      .eq('sender_id', senderId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }
    if (filters?.offset) {
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit || 50) - 1,
      )
    }

    const response = await query
    return this.handleResponse(
      response,
      'getSentMessages',
    ) as Array<PrivateMessageWithRelations>
  }

  /**
   * Get received messages
   */
  async getReceivedMessages(
    receiverId: string,
    filters?: MessageFilters,
  ): Promise<Array<PrivateMessageWithRelations>> {
    this.validateRequired(receiverId, 'receiverId', 'getReceivedMessages')

    let query = this.supabase
      .from('private_messages')
      .select(
        `
        *,
        sender:sender_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `,
      )
      .eq('receiver_id', receiverId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }
    if (filters?.offset) {
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit || 50) - 1,
      )
    }

    const response = await query
    return this.handleResponse(
      response,
      'getReceivedMessages',
    ) as Array<PrivateMessageWithRelations>
  }

  /**
   * Get unread messages
   */
  async getUnreadMessages(
    userId: string,
    filters?: MessageFilters,
  ): Promise<Array<PrivateMessageWithRelations>> {
    this.validateRequired(userId, 'userId', 'getUnreadMessages')

    let query = this.supabase
      .from('private_messages')
      .select(
        `
        *,
        sender:sender_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `,
      )
      .eq('receiver_id', userId)
      .is('read_at', null)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }
    if (filters?.offset) {
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit || 50) - 1,
      )
    }

    const response = await query
    return this.handleResponse(
      response,
      'getUnreadMessages',
    ) as Array<PrivateMessageWithRelations>
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    this.validateRequired(userId, 'userId', 'getUnreadCount')

    const response = await this.supabase
      .from('private_messages')
      .select('id', { count: 'exact' })
      .eq('receiver_id', userId)
      .is('read_at', null)
      .is('deleted_at', null)

    const data = this.handleResponse(response, 'getUnreadCount')
    return data.length || 0
  }

  /**
   * Get message replies
   */
  async getMessageReplies(
    messageId: string,
  ): Promise<Array<PrivateMessageWithRelations>> {
    this.validateRequired(messageId, 'messageId', 'getMessageReplies')

    const response = await this.supabase
      .from('private_messages')
      .select(
        `
        *,
        sender:sender_id (
          id,
          username,
          full_name,
          avatar_url
        ),
        receiver:receiver_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `,
      )
      .eq('reply_to', messageId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    return this.handleResponse(
      response,
      'getMessageReplies',
    ) as Array<PrivateMessageWithRelations>
  }

  /**
   * Search messages
   */
  async searchMessages(
    searchQuery: string,
    userId?: string,
    limit = 50,
  ): Promise<Array<PrivateMessageWithRelations>> {
    this.validateRequired(searchQuery, 'searchQuery', 'searchMessages')

    let query = this.supabase
      .from('private_messages')
      .select(
        `
        *,
        sender:sender_id (
          id,
          username,
          full_name,
          avatar_url
        ),
        receiver:receiver_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `,
      )
      .ilike('message', `%${searchQuery}%`)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (userId) {
      query = query.or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    }

    query = query.limit(limit)

    const response = await query
    return this.handleResponse(
      response,
      'searchMessages',
    ) as Array<PrivateMessageWithRelations>
  }

  /**
   * Send a private message
   */
  async sendMessage(messageData: {
    receiver_id: string
    message: string
    message_type?: 'text' | 'image' | 'file' | 'location'
    attachment_url?: string
    attachment_type?: string
    reply_to?: string
  }): Promise<PrivateMessageWithRelations> {
    this.validateRequired(messageData, 'messageData', 'sendMessage')
    this.validateRequired(messageData.receiver_id, 'receiver_id', 'sendMessage')
    this.validateRequired(messageData.message, 'message', 'sendMessage')

    const response = await this.supabase
      .from('private_messages')
      .insert({
        receiver_id: messageData.receiver_id,
        message: messageData.message,
        message_type: messageData.message_type || 'text',
        attachment_url: messageData.attachment_url,
        attachment_type: messageData.attachment_type,
        reply_to: messageData.reply_to,
      })
      .select(
        `
        *,
        sender:sender_id (
          id,
          username,
          full_name,
          avatar_url
        ),
        receiver:receiver_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `,
      )
      .single()

    return this.handleResponse(
      response,
      'sendMessage',
    ) as PrivateMessageWithRelations
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<PrivateMessage> {
    this.validateRequired(messageId, 'messageId', 'markAsRead')

    const response = await this.supabase
      .from('private_messages')
      .update({
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .select()
      .single()

    return this.handleResponse(response, 'markAsRead') as PrivateMessage
  }

  /**
   * Mark conversation as read
   */
  async markConversationAsRead(
    otherUserId: string,
    currentUserId: string,
  ): Promise<Array<PrivateMessage>> {
    this.validateRequired(otherUserId, 'otherUserId', 'markConversationAsRead')
    this.validateRequired(
      currentUserId,
      'currentUserId',
      'markConversationAsRead',
    )

    const response = await this.supabase
      .from('private_messages')
      .update({
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('sender_id', otherUserId)
      .is('read_at', null)
      .is('deleted_at', null)
      .select()

    return this.handleResponse(
      response,
      'markConversationAsRead',
    ) as Array<PrivateMessage>
  }

  /**
   * Soft delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    this.validateRequired(messageId, 'messageId', 'deleteMessage')

    const response = await this.supabase
      .from('private_messages')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId)

    this.handleResponse(response, 'deleteMessage')
  }

  /**
   * Soft delete conversation
   */
  async deleteConversation(
    otherUserId: string,
    currentUserId: string,
  ): Promise<void> {
    this.validateRequired(otherUserId, 'otherUserId', 'deleteConversation')
    this.validateRequired(currentUserId, 'currentUserId', 'deleteConversation')

    const response = await this.supabase
      .from('private_messages')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .or(
        `(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId}),(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId})`,
      )
      .is('deleted_at', null)

    this.handleResponse(response, 'deleteConversation')
  }
}
