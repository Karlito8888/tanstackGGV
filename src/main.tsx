import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'

import { getRouter } from './router'
import { AuthProvider, useAuth } from './contexts/AuthContext'

// Inner component that uses the auth context
function AppContent() {
  const { user } = useAuth()
  const router = React.useMemo(() => getRouter(user), [user])
  
  return <RouterProvider router={router} />
}

// Main App component wrapped with AuthProvider
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

const rootElement = document.getElementById('root')!

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
