import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { getToken, setToken } from '../api/client'
import {
  fetchMe,
  googleLogin as apiGoogleLogin,
  guestLogin as apiGuestLogin,
  login as apiLogin,
  register as apiRegister,
} from '../api/auth'
import type { User } from '../api/types'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  loginWithGoogle: (idToken: string) => Promise<void>
  loginAsGuest: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Restore the session from a persisted token on first load.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    fetchMe()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  async function establish(token: string): Promise<void> {
    setToken(token)
    setUser(await fetchMe())
  }

  async function login(email: string, password: string): Promise<void> {
    const { access_token } = await apiLogin(email, password)
    await establish(access_token)
  }

  async function register(email: string, password: string): Promise<void> {
    await apiRegister(email, password)
    await login(email, password)
  }

  async function loginWithGoogle(idToken: string): Promise<void> {
    const { access_token } = await apiGoogleLogin(idToken)
    await establish(access_token)
  }

  async function loginAsGuest(): Promise<void> {
    const { access_token } = await apiGuestLogin()
    await establish(access_token)
  }

  function logout(): void {
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, loginWithGoogle, loginAsGuest, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
