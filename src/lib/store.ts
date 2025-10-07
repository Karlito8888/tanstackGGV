import { Store } from '@tanstack/store'

// Types for authentication state
export interface AuthState {
  user: {
    id: string
    email: string | null
    full_name: string | null
    username: string | null
    avatar_url: string | null
    is_admin: boolean
    coins: number
    onboarding_completed: boolean
  } | null
  session: {
    access_token: string
    refresh_token: string
    expires_at: number
  } | null
  isLoading: boolean
  error: string | null
}

// Types for UI state
export interface UIState {
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  notifications: Array<{
    id: string
    type: 'success' | 'error' | 'info' | 'warning'
    title: string
    message: string | null
    duration: number
    timestamp: number
  }>
}

// Separate stores for each domain (following TanStack Store best practices)
export const authStore = new Store<AuthState>({
  user: null,
  session: null,
  isLoading: true,
  error: null,
})

export const uiStore = new Store<UIState>({
  theme: 'light',
  sidebarOpen: false,
  notifications: [],
})

// Immutable actions for authStore
export const authActions = {
  setUser: (user: AuthState['user']) => {
    authStore.setState((state) => ({ ...state, user }))
  },

  setSession: (session: AuthState['session']) => {
    authStore.setState((state) => ({ ...state, session }))
  },

  setLoading: (isLoading: boolean) => {
    authStore.setState((state) => ({ ...state, isLoading }))
  },

  setError: (error: string | null) => {
    authStore.setState((state) => ({ ...state, error }))
  },

  logout: () => {
    authStore.setState((state) => ({
      ...state,
      user: null,
      session: null,
      error: null,
    }))
  },

  updateCoins: (coins: number) => {
    authStore.setState((state) => ({
      ...state,
      user: state.user ? { ...state.user, coins } : null,
    }))
  },

  completeOnboarding: () => {
    authStore.setState((state) => ({
      ...state,
      user: state.user ? { ...state.user, onboarding_completed: true } : null,
    }))
  },
}

// Immutable actions for uiStore
export const uiActions = {
  setTheme: (theme: UIState['theme']) => {
    uiStore.setState((state) => ({ ...state, theme }))
  },

  toggleSidebar: () => {
    uiStore.setState((state) => ({ ...state, sidebarOpen: !state.sidebarOpen }))
  },

  setSidebarOpen: (open: boolean) => {
    uiStore.setState((state) => ({ ...state, sidebarOpen: open }))
  },

  addNotification: (
    notification: Omit<UIState['notifications'][0], 'id' | 'timestamp'>,
  ) => {
    const id = crypto.randomUUID()
    const timestamp = Date.now()
    uiStore.setState((state) => ({
      ...state,
      notifications: [
        ...state.notifications,
        { ...notification, id, timestamp },
      ],
    }))
  },

  removeNotification: (id: string) => {
    uiStore.setState((state) => ({
      ...state,
      notifications: state.notifications.filter((n) => n.id !== id),
    }))
  },

  clearNotifications: () => {
    uiStore.setState((state) => ({ ...state, notifications: [] }))
  },
}
