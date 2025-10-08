import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithProvider: (provider: 'google' | 'facebook') => Promise<{ error?: string }>
  signOut: () => Promise<{ error?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      setLoading(false)
    })

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithProvider = async (
    provider: 'google' | 'facebook'
  ): Promise<{ error?: string }> => {
    try {
      // Store the current redirect parameter if it exists
      const urlParams = new URLSearchParams(window.location.search)
      const redirectTo = urlParams.get('redirect')
      if (redirectTo) {
        sessionStorage.setItem('auth_redirect', redirectTo)
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      return {}
    } catch (error) {
      console.error('OAuth login error:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred during login'
      return { error: errorMessage }
    }
  }

  const signOut = async (): Promise<{ error?: string }> => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      return {}
    } catch (error) {
      console.error('Sign out error:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred during sign out'
      return { error: errorMessage }
    }
  }

  const value: AuthContextType = {
    user,
    session,
    loading,
    signInWithProvider,
    signOut,
  }

  // Show loading spinner during initial session verification
  if (loading) {
    return (
      <AuthContext.Provider value={value}>
        <LoadingSpinner fullScreen size="lg" />
      </AuthContext.Provider>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
