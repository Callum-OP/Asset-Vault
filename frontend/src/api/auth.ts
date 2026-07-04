import { api } from './client'
import type { Token, User } from './types'

export async function register(email: string, password: string): Promise<User> {
  const { data } = await api.post<User>('/auth/register', { email, password })
  return data
}

export async function login(email: string, password: string): Promise<Token> {
  // The OAuth2 password flow expects form-encoded fields; email is "username".
  const body = new URLSearchParams({ username: email, password })
  const { data } = await api.post<Token>('/auth/login', body)
  return data
}

export async function googleLogin(idToken: string): Promise<Token> {
  const { data } = await api.post<Token>('/auth/google', { id_token: idToken })
  return data
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me')
  return data
}
