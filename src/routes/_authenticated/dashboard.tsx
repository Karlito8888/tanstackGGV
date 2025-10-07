import { createFileRoute } from '@tanstack/react-router'
import {
  ChatBubbleLeftRightIcon,
  MapPinIcon,
  ShoppingBagIcon,
  UserCircleIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: Dashboard,
})

function Dashboard() {
  const { auth } = Route.useRouteContext()

  const quickActions = [
    {
      title: 'Update Profile',
      description: 'Edit your personal information',
      icon: UserCircleIcon,
      to: '/profile',
      color: 'bg-blue-500',
    },
    {
      title: 'Find Locations',
      description: 'Discover places near you',
      icon: MapPinIcon,
      to: '/locations',
      color: 'bg-green-500',
    },
    {
      title: 'Start Chat',
      description: 'Connect with others',
      icon: ChatBubbleLeftRightIcon,
      to: '/chat',
      color: 'bg-purple-500',
    },
    {
      title: 'Browse Marketplace',
      description: 'Buy and sell items',
      icon: ShoppingBagIcon,
      to: '/marketplace',
      color: 'bg-orange-500',
    },
    {
      title: 'Join Community',
      description: 'Participate in forums',
      icon: UsersIcon,
      to: '/community',
      color: 'bg-pink-500',
    },
  ]

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Welcome back!</h1>
        <p className="text-blue-100 mb-4">
          Ready to connect with your community?
        </p>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
          <p className="text-sm text-blue-50">{auth.user?.email}</p>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.title}
                onClick={() => (window.location.href = action.to)}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div
                  className={`${action.color} w-12 h-12 rounded-lg flex items-center justify-center mb-3 mx-auto`}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-medium text-gray-900 text-sm mb-1">
                  {action.title}
                </h3>
                <p className="text-xs text-gray-500 line-clamp-2">
                  {action.description}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Recent Activity
        </h2>
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <p className="text-sm text-gray-600">Welcome to GGV Connect! 🎉</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <p className="text-sm text-gray-600">
              Your profile is ready to customize
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            <p className="text-sm text-gray-600">
              Start exploring the community features
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
