import { useState } from 'react'
import type { FormEvent } from 'react'
import { AxiosError } from 'axios'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { GoogleButton } from '../components/GoogleButton'
import { Wordmark } from '../components/Wordmark'
import { GOOGLE_CLIENT_ID } from '../config'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await register(email, password)
      navigate('/')
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 409) {
        setError('That email is already registered')
      } else if (err instanceof AxiosError && err.response?.status === 422) {
        setError('Password must be at least 8 characters')
      } else {
        setError('Could not create your account')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(40rem 30rem at 50% -20%, rgba(244,185,66,0.12), transparent 60%)',
        }}
      />
      <div className="surface relative w-full max-w-sm p-8 shadow-[var(--shadow-panel)]">
        <div className="mb-6">
          <Wordmark size="lg" />
          <p className="mt-3 text-sm text-muted">Create an account and start cataloging.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={busy} className="btn btn-accent w-full">
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>

        {GOOGLE_CLIENT_ID && (
          <div className="mt-4">
            <div className="my-3 flex items-center gap-3 text-xs text-subtle">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>
            <div className="flex justify-center">
              <GoogleButton onError={setError} />
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent hover:text-accent-hover">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
