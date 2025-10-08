import { Outlet, useNavigate } from '@tanstack/react-router'

import {
  ChatBubbleLeftRightIcon,
  HomeIcon,
  MapPinIcon,
  ShoppingBagIcon,
  UserIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'

import { DarkModeToggle } from '../ui/dark-mode-toggle'

interface MobileLayoutProps {
  children?: React.ReactNode
}

export function MobileLayout({ children }: MobileLayoutProps) {
  const navigate = useNavigate()

  const navigation = [
    { name: 'Home', icon: HomeIcon, to: '/dashboard' },
    { name: 'Profile', icon: UserIcon, to: '/profile' },
    { name: 'Chat', icon: ChatBubbleLeftRightIcon, to: '/chat' },
    { name: 'Marketplace', icon: ShoppingBagIcon, to: '/marketplace' },
    { name: 'Community', icon: UsersIcon, to: '/community' },
    { name: 'Locations', icon: MapPinIcon, to: '/locations' },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-background shadow-sm border-b border-border">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-foreground">
              GGV Connect
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-16 relative">
        {/* Dark Mode Toggle - Absolute positioned */}
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-background/80 backdrop-blur-sm border border-border rounded-md p-1 shadow-sm">
            <DarkModeToggle />
          </div>
        </div>

        {children || <Outlet />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border">
        <div className="grid grid-cols-6 gap-1 px-1 py-2">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.name}
                onClick={() => navigate({ to: item.to })}
                className="flex flex-col items-center justify-center py-2 px-1 text-xs text-muted-foreground hover:text-primary focus:outline-none focus:text-primary transition-colors"
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
