import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import type { Session, User } from '@supabase/supabase-js'

// Define router context with auth
interface MyRouterContext {
  queryClient: QueryClient
  auth: {
    user: User | null
    session: Session | null
    isLoading: boolean
  }
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  return <Outlet />
}
