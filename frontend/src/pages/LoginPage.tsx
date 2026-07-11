import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { GoogleButton } from '../components/GoogleButton'
import { Wordmark } from '../components/Wordmark'
import { GOOGLE_CLIENT_ID } from '../config'

export function LoginPage() {
  const { login, loginAsGuest } = useAuth()
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
      await login(email, password)
      navigate('/')
    } catch {
      setError('Incorrect email or password')
    } finally {
      setBusy(false)
    }
  }

  async function onGuest() {
    setError(null)
    setBusy(true)
    try {
      await loginAsGuest()
      navigate('/')
    } catch {
      setError('Could not start a guest session')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="animate-float absolute -left-20 top-10 h-96 w-96 rounded-full opacity-60 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(255,92,157,0.4), transparent 70%)' }}
        />
        <div
          className="animate-float absolute -right-16 bottom-0 h-[26rem] w-[26rem] rounded-full opacity-50 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(154,107,255,0.38), transparent 70%)',
            animationDelay: '-4s',
          }}
        />
      </div>
      <div className="surface pop-in relative w-full max-w-md p-10 shadow-[var(--shadow-glow)]">
        <div className="mb-8">
          <Wordmark size="lg" />
          <p className="mt-4 text-lg text-muted">Sign in to your vault.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
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
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
          {error && <p className="text-base text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={busy || !email.trim() || !password}
            className="btn btn-accent w-full"
          >
            {busy ? 'Signing in…' : 'Sign in'}
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

        <div className="mt-4">
          {!GOOGLE_CLIENT_ID && (
            <div className="my-3 flex items-center gap-3 text-xs text-subtle">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>
          )}
          <button type="button" onClick={onGuest} disabled={busy} className="btn btn-ghost w-full">
            Continue as guest
          </button>
          <p className="mt-2 text-center text-xs text-subtle">
            Browse and download shared assets — read-only.
          </p>
        </div>

        <p className="mt-8 text-center text-base text-muted">
          No account?{' '}
          <Link to="/register" className="font-semibold text-accent hover:text-accent-hover">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
