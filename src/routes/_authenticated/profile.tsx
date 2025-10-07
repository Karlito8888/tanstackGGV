import { createFileRoute } from '@tanstack/react-router'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { filipinoContext } from '@/lib/filipino-context'

export const Route = createFileRoute('/_authenticated/profile')({
  component: Profile,
})

function Profile() {
  const context = filipinoContext

  return (
    <div className="p-4 pb-20">
      <div className="space-y-6">
        {/* Profile Header */}
        <Card className="p-6">
          <div className="flex items-center space-x-4">
            <Avatar size="lg" />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">
                Juan Dela Cruz
              </h1>
              <p className="text-sm text-gray-600">Member since October 2024</p>
              <div className="mt-2">
                <Badge variant="success">Verified</Badge>
                <Badge variant="info" className="ml-2">
                  Active
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Filipino Cultural Section */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            {context.greetings.evening}
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Region:</span>
              <span className="font-medium">National Capital Region</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Language:</span>
              <span className="font-medium">Tagalog, English</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Timezone:</span>
              <span className="font-medium">PST (UTC+8)</span>
            </div>
          </div>
        </Card>

        {/* Business Information */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Business Services</h3>
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900">Digital Marketing</h4>
              <p className="text-sm text-blue-700 mt-1">
                Helping businesses grow online
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-900">Content Creation</h4>
              <p className="text-sm text-green-700 mt-1">
                Social media and blog content
              </p>
            </div>
          </div>
        </Card>

        {/* Community Activity */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Community Activity</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">24</div>
              <div className="text-sm text-gray-600">Posts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">156</div>
              <div className="text-sm text-gray-600">Connections</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">8</div>
              <div className="text-sm text-gray-600">Services</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">4.8</div>
              <div className="text-sm text-gray-600">Rating</div>
            </div>
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full p-3 text-left bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span className="font-medium">Edit Profile</span>
            </button>
            <button className="w-full p-3 text-left bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span className="font-medium">Manage Services</span>
            </button>
            <button className="w-full p-3 text-left bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span className="font-medium">Settings</span>
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
