import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system'

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function getStoredTheme(): Theme | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem('theme') as Theme | null
  } catch {
    return null
  }
}

function setStoredTheme(theme: Theme): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem('theme', theme)
  } catch {
    console.warn('Failed to save theme preference to localStorage')
  }
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement
  const isDark =
    theme === 'dark' || (theme === 'system' && getSystemTheme() === 'dark')

  if (isDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export function useDarkMode() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = getStoredTheme()
    return stored || 'system'
  })

  const [isDark, setIsDark] = useState(() => {
    const stored = getStoredTheme()
    if (stored === 'dark') return true
    if (stored === 'light') return false
    return getSystemTheme() === 'dark'
  })

  useEffect(() => {
    const stored = getStoredTheme()
    const initialTheme = stored || 'system'
    setTheme(initialTheme)

    const isDarkMode =
      initialTheme === 'dark' ||
      (initialTheme === 'system' && getSystemTheme() === 'dark')
    setIsDark(isDarkMode)
    applyTheme(initialTheme)
  }, [])

  useEffect(() => {
    applyTheme(theme)

    const isDarkMode =
      theme === 'dark' || (theme === 'system' && getSystemTheme() === 'dark')
    setIsDark(isDarkMode)
  }, [theme])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = () => {
      if (theme === 'system') {
        const isDarkMode = mediaQuery.matches
        setIsDark(isDarkMode)
        applyTheme('system')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const toggleTheme = () => {
    const newTheme: Theme = isDark ? 'light' : 'dark'
    setTheme(newTheme)
    setStoredTheme(newTheme)
  }

  const setThemeMode = (newTheme: Theme) => {
    setTheme(newTheme)
    setStoredTheme(newTheme)
  }

  return {
    theme,
    isDark,
    toggleTheme,
    setTheme: setThemeMode,
    systemTheme: getSystemTheme(),
  }
}
