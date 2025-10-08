/**
 * Forum Service
 *
 * Service layer for all forum-related operations following the
 * Supabase Services & Hooks pattern.
 */

import { BaseService } from './base.service'
import type { InsertRow, Row } from '../lib/database-types'

type Forum = Row<'forums'>
type ForumInsert = InsertRow<'forums'>

export interface ForumWithCreator extends Forum {
  creator: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
  threads_count?: number | Array<{ count: number }>
}

export interface ForumListResult {
  data: Array<ForumWithCreator>
  count: number | null
}

export interface ForumFilters {
  creatorId?: string
  search?: string
  limit?: number
  offset?: number
}

export class ForumService extends BaseService {
  /**
   * Get a forum by ID with creator information
   */
  async getForum(id: string): Promise<ForumWithCreator | null> {
    this.validateRequired(id, 'id', 'ForumService.getForum')

    const response = await this.supabase
      .from('forums')
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
      .eq('id', id)
      .single()

    return this.handleOptionalResponse(response, 'ForumService.getForum')
  }

  /**
   * Get forums list with filters and pagination
   */
  async getForumsList(filters?: ForumFilters): Promise<ForumListResult> {
    let query = this.supabase.from('forums').select(
      `
        *,
        creator:created_by (
          id,
          username,
          full_name,
          avatar_url
        ),
        threads_count:threads(count)
      `,
      { count: 'exact' },
    )

    if (filters?.creatorId) {
      query = query.eq('created_by', filters.creatorId)
    }
    if (filters?.search) {
      query = query.or(
        `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`,
      )
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }
    if (filters?.offset) {
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit || 10) - 1,
      )
    }

    query = query.order('created_at', { ascending: false })

    const response = await query

    if (response.error) {
      this.handleError(response.error, 'ForumService.getForumsList')
    }

    // Normalize threads_count for each forum
    const normalizedData = response.data.map((forum) => ({
      ...forum,
      threads_count: Array.isArray(forum.threads_count)
        ? (forum.threads_count as Array<{ count: number }>)[0]?.count || 0
        : (forum.threads_count as number) || 0,
    }))

    return {
      data: normalizedData,
      count: response.count || null,
    }
  }

  /**
   * Get forums by creator
   */
  async getForumsByCreator(
    creatorId: string,
  ): Promise<Array<ForumWithCreator & { threads_count: number }>> {
    this.validateRequired(
      creatorId,
      'creatorId',
      'ForumService.getForumsByCreator',
    )

    const response = await this.supabase
      .from('forums')
      .select(
        `
        *,
        creator:created_by (
          id,
          username,
          full_name,
          avatar_url
        ),
        threads_count:threads(count)
      `,
      )
      .eq('created_by', creatorId)
      .order('created_at', { ascending: false })

    const data = this.handleResponse(
      response,
      'ForumService.getForumsByCreator',
    )
    return data.map((forum) => ({
      ...forum,
      threads_count: Array.isArray(forum.threads_count)
        ? (forum.threads_count as Array<{ count: number }>)[0]?.count || 0
        : (forum.threads_count as number) || 0,
    }))
  }

  /**
   * Search forums
   */
  async searchForums(
    searchQuery: string,
    limit: number = 20,
  ): Promise<Array<ForumWithCreator>> {
    this.validateRequired(
      searchQuery,
      'searchQuery',
      'ForumService.searchForums',
    )

    const response = await this.supabase
      .from('forums')
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
      .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
      .order('created_at', { ascending: false })
      .limit(limit)

    return this.handleResponse(response, 'ForumService.searchForums')
  }

  /**
   * Create a new forum
   */
  async createForum(forumData: ForumInsert): Promise<ForumWithCreator> {
    const response = await this.supabase
      .from('forums')
      .insert(forumData)
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
      .single()

    return this.handleResponse(response, 'ForumService.createForum')
  }

  /**
   * Update a forum (restricted by RLS policies)
   */
  async updateForum(
    id: string,
    updates: Partial<ForumInsert>,
  ): Promise<ForumWithCreator> {
    this.validateRequired(id, 'id', 'ForumService.updateForum')

    const response = await this.supabase
      .from('forums')
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
        )
      `,
      )
      .single()

    return this.handleResponse(response, 'ForumService.updateForum')
  }

  /**
   * Delete a forum (restricted by RLS policies)
   */
  async deleteForum(id: string): Promise<boolean> {
    this.validateRequired(id, 'id', 'ForumService.deleteForum')

    const { error } = await this.supabase.from('forums').delete().eq('id', id)

    if (error) {
      this.handleError(error, 'ForumService.deleteForum')
    }

    return true
  }
}

// Export singleton instance
export const forumService = new ForumService()
