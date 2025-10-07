import { useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { loginWithPassword, signInWithOAuth, signUp } from '../lib/auth'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

export function AuthUI() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const search = useSearch({ from: '/' })

  // Login/SignUp mutation
  const authMutation = useMutation({
    mutationFn: async () => {
      if (isSignUp) {
        return await signUp(email, password)
      } else {
        return await loginWithPassword(email, password)
      }
    },
    onSuccess: () => {
      // Invalidate session to refetch user data
      queryClient.invalidateQueries({ queryKey: ['session'] })
      // Navigate to redirect URL or dashboard
      navigate({ to: search.redirect || '/dashboard' })
    },
    onError: (err: any) => {
      setError(err.message || 'Authentication failed')
    },
  })

  // Google OAuth mutation
  const googleMutation = useMutation({
    mutationFn: () => signInWithOAuth('google'),
    onError: (err: any) => {
      setError(err.message || 'Google sign in failed')
    },
  })

  // Facebook OAuth mutation
  const facebookMutation = useMutation({
    mutationFn: () => signInWithOAuth('facebook'),
    onError: (err: any) => {
      setError(err.message || 'Facebook sign in failed')
    },
  })

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    authMutation.mutate()
  }

  const isLoading =
    authMutation.isPending ||
    googleMutation.isPending ||
    facebookMutation.isPending

  return (
    <div className="space-y-6">
      <form onSubmit={handleAuth} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        {error && <div className="text-red-600 text-sm">{error}</div>}

        {isSignUp && !error && authMutation.isSuccess && (
          <div className="text-green-600 text-sm">
            Check your email for the confirmation link!
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {authMutation.isPending
            ? 'Loading...'
            : isSignUp
              ? 'Sign Up'
              : 'Sign In'}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-gray-50 px-2 text-gray-500">
            Or continue with
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => googleMutation.mutate()}
          disabled={isLoading}
        >
          Sign in with Google
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => facebookMutation.mutate()}
          disabled={isLoading}
        >
          Sign in with Facebook
        </Button>
      </div>

      <div className="text-center">
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-sm text-blue-600 hover:underline"
          disabled={isLoading}
        >
          {isSignUp
            ? 'Already have an account? Sign in'
            : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  )
}
