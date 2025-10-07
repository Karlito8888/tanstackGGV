import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthUI } from '../components/auth'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: (search.redirect as string) || '/dashboard',
  }),
  beforeLoad: ({ context, search }) => {
    // If already logged in, redirect to dashboard
    if (context.auth.user) {
      throw redirect({ to: search.redirect })
    }
  },
  component: Home,
})

function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Use email/password or social providers to sign in
          </p>
        </div>
        <AuthUI />
      </div>
    </div>
  )
}
