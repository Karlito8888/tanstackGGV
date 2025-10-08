/**
 * Thread Service
 *
 * Handles forum thread operations with mobile-first optimizations.
 * Includes forum relationships, nested replies, voting system, and CRUD operations.
 */

import { BaseService } from './base.service'
import type { Database } from '../lib/database-types'

type Thread = Database['public']['Tables']['threads']['Row']
type ThreadInsert = Database['public']['Tables']['threads']['Insert']
type ThreadUpdate = Database['public']['Tables']['threads']['Update']

export interface ThreadWithRelations extends Thread {
  creator: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
  forum: {
    id: string
    title: string
    icon: string | null
  } | null
}

export interface ThreadFilters {
  forumId?: string
  creatorId?: string
  search?: string
  limit?: number
  offset?: number
}

export interface ThreadListResult {
  data: Array<ThreadWithRelations>
  count: number
}

export class ThreadService extends BaseService {
  /**
   * Get a single thread with relations
   */
  async getThread(id: string): Promise<ThreadWithRelations> {
    this.validateRequired(id, 'id', 'getThread')

    const response = await this.supabase
      .from('threads')
      .select(
        `
        *,
        creator:created_by (
          id,
          username,
          full_name,
          avatar_url
        ),
        forum:forum_id (
          id,
          title,
          icon
        )
      `,
      )
      .eq('id', id)
      .single()

    return this.handleResponse(response, 'getThread') as ThreadWithRelations
  }

  /**
   * Get threads list with filtering and pagination
   */
  async getThreads(filters?: ThreadFilters): Promise<ThreadListResult> {
    let query = this.supabase.from('threads').select(
      `
      *,
      creator:created_by (
        id,
        username,
        full_name,
        avatar_url
      ),
      forum:forum_id (
        id,
        title,
        icon
      )
    `,
      { count: 'exact' },
    )

    // Apply filters
    if (filters?.forumId) {
      query = query.eq('forum_id', filters.forumId)
    }
    if (filters?.creatorId) {
      query = query.eq('created_by', filters.creatorId)
    }
    if (filters?.search) {
      query = query.ilike('title', `%${filters.search}%`)
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
    const data = this.handleResponse(response, 'getThreads')

    return {
      data: data as Array<ThreadWithRelations>,
      count: response.count || 0,
    }
  }

  /**
   * Get threads by forum
   */
  async getThreadsByForum(
    forumId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Array<ThreadWithRelations>> {
    this.validateRequired(forumId, 'forumId', 'getThreadsByForum')

    let query = this.supabase
      .from('threads')
      .select(
        `
        *,
        creator:created_by (
          id,
          username,
          full_name,
          avatar_url
        )
      `,
      )
      .eq('forum_id', forumId)
      .order('created_at', { ascending: false })

    if (options?.limit) {
      query = query.limit(options.limit)
    }
    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 20) - 1,
      )
    }

    const response = await query
    return this.handleResponse(
      response,
      'getThreadsByForum',
    ) as Array<ThreadWithRelations>
  }

  /**
   * Get threads by creator
   */
  async getThreadsByCreator(creatorId: string): Promise<Array<ThreadWithRelations>> {
    this.validateRequired(creatorId, 'creatorId', 'getThreadsByCreator')

    const response = await this.supabase
      .from('threads')
      .select(
        `
        *,
        forum:forum_id (
          id,
          title,
          icon
        )
      `,
      )
      .eq('created_by', creatorId)
      .order('created_at', { ascending: false })

    return this.handleResponse(
      response,
      'getThreadsByCreator',
    ) as Array<ThreadWithRelations>
  }

  /**
   * Search threads
   */
  async searchThreads(
    searchQuery: string,
    limit = 20,
  ): Promise<Array<ThreadWithRelations>> {
    this.validateRequired(searchQuery, 'searchQuery', 'searchThreads')

    const response = await this.supabase
      .from('threads')
      .select(
        `
        *,
        creator:created_by (
          id,
          username,
          full_name,
          avatar_url
        ),
        forum:forum_id (
          id,
          title,
          icon
        )
      `,
      )
      .ilike('title', `%${searchQuery}%`)
      .order('created_at', { ascending: false })
      .limit(limit)

    return this.handleResponse(
      response,
      'searchThreads',
    ) as Array<ThreadWithRelations>
  }

  /**
   * Create a new thread
   */
  async createThread(threadData: ThreadInsert): Promise<ThreadWithRelations> {
    this.validateRequired(threadData, 'threadData', 'createThread')

    const response = await this.supabase
      .from('threads')
      .insert(threadData)
      .select(
        `
        *,
        creator:created_by (
          id,
          username,
          full_name,
          avatar_url
        ),
        forum:forum_id (
          id,
          title,
          icon
        )
      `,
      )
      .single()

    return this.handleResponse(response, 'createThread') as ThreadWithRelations
  }

  /**
   * Update a thread
   */
  async updateThread(
    id: string,
    updates: ThreadUpdate,
  ): Promise<ThreadWithRelations> {
    this.validateRequired(id, 'id', 'updateThread')
    this.validateRequired(updates, 'updates', 'updateThread')

    const response = await this.supabase
      .from('threads')
      .update(this.createOptimisticUpdate(updates))
      .eq('id', id)
      .select(
        `
        *,
        creator:created_by (
          id,
          username,
          full_name,
          avatar_url
        ),
        forum:forum_id (
          id,
          title,
          icon
        )
      `,
      )
      .single()

    return this.handleResponse(response, 'updateThread') as ThreadWithRelations
  }

  /**
   * Delete a thread (admin only)
   */
  async deleteThread(id: string): Promise<void> {
    this.validateRequired(id, 'id', 'deleteThread')

    const response = await this.supabase.from('threads').delete().eq('id', id)

    this.handleResponse(response, 'deleteThread')
  }
}
