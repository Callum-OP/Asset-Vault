import axios from 'axios'

const TOKEN_KEY = 'av_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

// Requests are same-origin in dev (Vite proxies to the backend), so no baseURL.
export const api = axios.create()

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On an expired/invalid token, drop it and bounce to login — except for the
// auth endpoints themselves, where a 401 is a normal "bad credentials" result.
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/google']

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url ?? ''
    const isAuthCall = AUTH_PATHS.some((p) => url.includes(p))
    if (error.response?.status === 401 && !isAuthCall) {
      setToken(null)
      if (window.location.pathname !== '/login') window.location.assign('/login')
    }
    return Promise.reject(error)
  },
)
