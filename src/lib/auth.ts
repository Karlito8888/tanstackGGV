import { supabase } from './supabase'
import type { Session, User } from '@supabase/supabase-js'

// Query function to get current session
export async function getCurrentSession(): Promise<{
  session: Session | null
  user: User | null
}> {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    console.warn('Session error:', error)
    return { session: null, user: null }
  }
  return {
    session: data.session,
    user: data.session?.user ?? null,
  }
}

// Login function
export async function loginWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

// Sign up function
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  if (error) throw error
  return data
}

// Sign out function
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// OAuth functions
export async function signInWithOAuth(provider: 'google' | 'facebook') {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
    },
  })
  if (error) throw error
  return data
}
