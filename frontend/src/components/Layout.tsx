import { Link, Outlet } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { Wordmark } from './Wordmark'

export function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="relative min-h-full">
      {/* Ambient amber glow behind the canvas for depth. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60rem 40rem at 15% -10%, rgba(244,185,66,0.08), transparent 60%), radial-gradient(50rem 30rem at 100% 0%, rgba(120,140,255,0.05), transparent 55%)',
        }}
      />

      <header className="sticky top-0 z-20 border-b border-border/70 bg-canvas/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link to="/" className="transition-opacity hover:opacity-80">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            {user?.avatar_url && (
              <img
                src={user.avatar_url}
                alt=""
                className="h-7 w-7 rounded-full ring-1 ring-border"
              />
            )}
            <span className="hidden text-muted sm:inline">{user?.full_name ?? user?.email}</span>
            <button onClick={logout} className="btn btn-ghost px-3 py-1.5">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
