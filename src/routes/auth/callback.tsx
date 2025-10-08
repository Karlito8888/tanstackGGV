import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/auth/callback')({
  component: CallbackComponent,
})

function CallbackComponent() {
  useEffect(() => {
    // Handle the OAuth callback
    const handleCallback = async () => {
      try {
        // Exchange the code for a session
        const { error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        )

        if (error) {
          console.error('Error during OAuth callback:', error)
          // Redirect to login with error
          window.location.href = '/login?error=auth_callback_failed'
          return
        }

        // Get the redirect URL from session storage or default to dashboard
        const redirectTo = sessionStorage.getItem('auth_redirect') || '/dashboard'
        sessionStorage.removeItem('auth_redirect')

        // Redirect to the intended destination
        window.location.href = redirectTo
      } catch (err) {
        console.error('Unexpected error during callback:', err)
        window.location.href = '/login?error=unexpected_error'
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Completing sign in...
        </p>
      </div>
    </div>
  )
}
