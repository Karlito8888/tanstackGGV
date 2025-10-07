import { createRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import * as TanstackQuery from './integrations/tanstack-query/root-provider'
import { getCurrentSession } from './lib/auth'
import { routeTree } from './routeTree.gen'

export const getRouter = () => {
  const rqContext = TanstackQuery.getContext()

  const router = createRouter({
    routeTree,
    context: {
      ...rqContext,
      // Auth will be passed from the component
      auth: {
        user: null,
        session: null,
        isLoading: true,
      },
    },
    defaultPreload: 'intent',
    Wrap: (props: { children: React.ReactNode }) => {
      return (
        <TanstackQuery.Provider {...rqContext}>
          {props.children}
        </TanstackQuery.Provider>
      )
    },
  })

  return router
}

// Hook to use in main.tsx
export function useAuth() {
  return useQuery({
    queryKey: ['session'],
    queryFn: getCurrentSession,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000, // Refetch every minute
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
