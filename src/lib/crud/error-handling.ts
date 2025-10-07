/**
 * Error handling system for TanStack Query operations
 * Follows TanStack Query official patterns and handles RLS errors
 */

import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Extended RLS error interface for Supabase Row Level Security errors
 */
export interface RLSError extends PostgrestError {
  code: string
  message: string
  details: string
  hint: string
}

/**
 * Type guard to detect RLS (Row Level Security) errors
 * RLS errors use PostgreSQL code 42501 for insufficient privilege
 */
export function isRLSError(error: unknown): error is RLSError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as any).code === '42501'
  )
}

/**
 * Type guard to detect network errors
 */
export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('Failed to fetch') ||
      error.name === 'TypeError')
  )
}

/**
 * Type guard to detect 4xx client errors
 */
export function isClientError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false

  // Check for status property in common error types
  if ('status' in error) {
    const status = (error as any).status
    return typeof status === 'number' && status >= 400 && status < 500
  }

  // Check for HTTP status in message
  if ('message' in error && typeof (error as any).message === 'string') {
    const message = (error as any).message
    const statusMatch = message.match(/status\s+(\d{3})/i)
    if (statusMatch) {
      const status = parseInt(statusMatch[1])
      return status >= 400 && status < 500
    }
  }

  return false
}

/**
 * Handle mutation errors with appropriate user feedback
 * Integrates with UI Store for notifications
 */
export function handleMutationError(
  error: unknown,
  operation: 'create' | 'update' | 'delete',
): void {
  console.error(`Mutation error (${operation}):`, error)

  let message: string
  let title = 'Error'

  if (isRLSError(error)) {
    // Specific handling for RLS permission errors
    const operationText = {
      create: 'create',
      update: 'modify',
      delete: 'delete',
    }[operation]

    title = 'Permission Denied'
    message = `You don't have permission to ${operationText} this resource.`
  } else if (isNetworkError(error)) {
    // Network connectivity issues
    title = 'Network Error'
    message = 'Please check your internet connection and try again.'
  } else if (isClientError(error)) {
    // 4xx errors - don't retry, show immediate feedback
    title = 'Request Error'
    message = error instanceof Error ? error.message : 'Invalid request'
  } else if (error instanceof Error) {
    // Generic JavaScript errors
    message = error.message
  } else {
    // Unknown error type
    message = 'An unexpected error occurred. Please try again.'
  }

  // Add error notification to UI Store
  // Note: This will be used when UI Store is available
  // uiActions.addNotification({
  //   type: 'error',
  //   title,
  //   message,
  //   duration: 5000,
  // })

  // For now, just log the structured error
  console.warn('Error notification:', { title, message, error })
}

/**
 * Handle query errors with appropriate user feedback
 * Less intrusive than mutation errors since queries retry automatically
 */
export function handleQueryError(error: unknown): void {
  console.error('Query error:', error)

  if (isRLSError(error)) {
    // RLS errors for queries - access denied
    console.warn('RLS access denied:', error)

    // Add notification for RLS errors
    // uiActions.addNotification({
    //   type: 'error',
    //   title: 'Access Denied',
    //   message: 'You don\'t have permission to access this data.',
    //   duration: 5000,
    // })
  } else if (isNetworkError(error)) {
    // Network errors are handled by retry logic, just log
    console.warn('Network error, retrying:', error)
  } else if (isClientError(error)) {
    // 4xx errors won't retry, show user feedback
    console.warn('Client error, no retry:', error)

    // uiActions.addNotification({
    //   type: 'warning',
    //   title: 'Data Load Error',
    //   message: 'Unable to load data. Please refresh the page.',
    //   duration: 3000,
    // })
  } else {
    // Other errors
    console.warn('Unexpected query error:', error)
  }
}

/**
 * Determine if an error should be retried based on TanStack Query best practices
 */
export function shouldRetryError(
  failureCount: number,
  error: unknown,
): boolean {
  // Don't retry on 4xx client errors
  if (isClientError(error)) {
    return false
  }

  // Don't retry on RLS errors (permission issues won't change)
  if (isRLSError(error)) {
    return false
  }

  // Retry network errors and server errors (5xx)
  // Limit to 3 attempts as per TanStack Query defaults
  return failureCount < 3
}

/**
 * Calculate retry delay with exponential backoff
 * Follows TanStack Query pattern: Math.min(1000 * 2 ** attemptIndex, 30000)
 */
export function getRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 30000)
}

/**
 * Extract user-friendly error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (isRLSError(error)) {
    return 'Permission denied. You may not have access to this resource.'
  }

  if (isNetworkError(error)) {
    return 'Network connection error. Please check your internet connection.'
  }

  if (isClientError(error)) {
    if (error instanceof Error) {
      return error.message
    }
    return 'Request failed. Please check your input and try again.'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'An unexpected error occurred.'
}

/**
 * Error boundary fallback for React components using TanStack Query
 */
export function getErrorFallback(
  error: unknown,
  resetError: () => void,
): {
  title: string
  message: string
  canRetry: boolean
  onRetry: () => void
} {
  const canRetry = !isClientError(error) && !isRLSError(error)

  return {
    title: isRLSError(error) ? 'Access Denied' : 'Something went wrong',
    message: getErrorMessage(error),
    canRetry,
    onRetry: resetError,
  }
}
