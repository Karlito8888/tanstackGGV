import { Outlet, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChatBubbleLeftRightIcon,
  HomeIcon,
  MapPinIcon,
  ShoppingBagIcon,
  UserIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import { Button } from '../ui/button'
import { signOut } from '../../lib/auth'

interface MobileLayoutProps {
  children?: React.ReactNode
}

export function MobileLayout({ children }: MobileLayoutProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const logoutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session'] })
      navigate({ to: '/', search: { redirect: '/dashboard' } })
    },
  })

  const navigation = [
    { name: 'Home', icon: HomeIcon, to: '/dashboard' },
    { name: 'Profile', icon: UserIcon, to: '/profile' },
    { name: 'Chat', icon: ChatBubbleLeftRightIcon, to: '/chat' },
    { name: 'Marketplace', icon: ShoppingBagIcon, to: '/marketplace' },
    { name: 'Community', icon: UsersIcon, to: '/community' },
    { name: 'Locations', icon: MapPinIcon, to: '/locations' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">GGV Connect</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? '...' : 'Logout'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-16">
        {children || <Outlet />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="grid grid-cols-6 gap-1 px-1 py-2">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.name}
                onClick={() => navigate({ to: item.to })}
                className="flex flex-col items-center justify-center py-2 px-1 text-xs text-gray-600 hover:text-blue-600 focus:outline-none focus:text-blue-600 transition-colors"
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="truncate">{item.name}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
