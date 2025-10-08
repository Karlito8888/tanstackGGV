import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { User } from '@supabase/supabase-js'

interface MyRouterContext {
  auth: User | null
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: () => (
    <>
      <Outlet />
    </>
  ),
})
