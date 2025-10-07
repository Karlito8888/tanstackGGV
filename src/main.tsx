import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { getRouter, useAuth } from './router'
import * as TanstackQuery from './integrations/tanstack-query/root-provider'
import './styles.css'

const rqContext = TanstackQuery.getContext()
const router = getRouter()

function InnerApp() {
  const { data, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <RouterProvider
      router={router}
      context={{
        auth: {
          user: data?.user ?? null,
          session: data?.session ?? null,
          isLoading: false,
        },
      }}
    />
  )
}

const rootElement = document.getElementById('root')!

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <TanstackQuery.Provider {...rqContext}>
      <InnerApp />
    </TanstackQuery.Provider>
  </React.StrictMode>,
)
