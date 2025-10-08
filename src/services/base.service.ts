/**
 * Base Service Architecture
 *
 * Following the Supabase Services & Hooks pattern from:
 * https://javascript.plainenglish.io/the-supabase-services-hooks-guide-that-will-transform-your-data-layer-architecture-301b79a8c411
 *
 * This base class provides:
 * - Centralized Supabase client configuration
 * - Consistent error handling across all services
 * - Type safety with Database types
 * - Foundation for all service classes
 */

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database-types'

export abstract class BaseService {
  protected supabase: SupabaseClient<Database>

  constructor() {
    // Use the existing supabase client configuration from the project
    this.supabase = createClient<Database>(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
    )
  }

  /**
   * Centralized error handling with context
   *
   * @param error - The error object from Supabase or other operations
   * @param context - The service method context for better debugging
   */
  protected handleError(error: any, context: string): never {
    // Log the full error for debugging
    console.error(`Error in ${context}:`, {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      context,
    })

    // Create a descriptive error message
    const errorMessage = error.message || 'Unknown error occurred'
    throw new Error(`${context}: ${errorMessage}`)
  }

  /**
   * Helper method to handle Supabase responses consistently
   *
   * @param response - Supabase response object
   * @param context - Service method context
   * @returns The data from the response
   */
  protected handleResponse<T>(
    response: { data: T | null; error: any },
    context: string,
  ): T {
    if (response.error) {
      this.handleError(response.error, context)
    }

    if (response.data === null) {
      this.handleError(new Error('No data returned'), context)
    }

    return response.data
  }

  /**
   * Helper method for optional data responses (can be null)
   *
   * @param response - Supabase response object
   * @param context - Service method context
   * @returns The data from the response or null
   */
  protected handleOptionalResponse<T>(
    response: { data: T | null; error: any },
    context: string,
  ): T | null {
    if (response.error) {
      this.handleError(response.error, context)
    }

    return response.data
  }

  /**
   * Helper method to validate required parameters
   *
   * @param value - Value to check
   * @param paramName - Parameter name for error message
   * @param context - Service method context
   */
  protected validateRequired(
    value: any,
    paramName: string,
    context: string,
  ): void {
    if (value === undefined || value === null || value === '') {
      this.handleError(new Error(`${paramName} is required`), context)
    }
  }

  /**
   * Helper method to create optimistic update data
   *
   * @param updates - The updates being applied
   * @returns Optimistic update object with timestamp
   */
  protected createOptimisticUpdate<T extends Record<string, any>>(
    updates: T,
  ): T & { updated_at: string } {
    return {
      ...updates,
      updated_at: new Date().toISOString(),
    }
  }
}

/**
 * Type helper for service constructor
 */
export abstract class ServiceConstructor extends BaseService {
  // This ensures all services extend BaseService
  // and can be used with the ServiceFactory pattern if needed
}

/**
 * Service Factory for managing service instances
 * (Following the article pattern for future extensibility)
 */
export class ServiceFactory {
  private static services: Map<string, BaseService> = new Map()

  static getService<T extends BaseService>(
    ServiceClass: new () => T,
    key?: string,
  ): T {
    const serviceKey = key || ServiceClass.name

    if (!this.services.has(serviceKey)) {
      this.services.set(serviceKey, new ServiceClass())
    }

    return this.services.get(serviceKey) as T
  }

  static clearCache(): void {
    this.services.clear()
  }

  static removeService(key: string): void {
    this.services.delete(key)
  }
}
