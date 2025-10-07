import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { MobileLayout } from '../components/layout/mobile-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    // Check if user is authenticated
    if (!context.auth.user) {
      throw redirect({
        to: '/',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return (
    <MobileLayout>
      <Outlet />
    </MobileLayout>
  )
}
