import { Link, Outlet } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { Wordmark } from './Wordmark'

export function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="relative min-h-full">
      {/* Playful pastel blobs drifting behind the canvas for depth. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="animate-float absolute -left-32 -top-24 h-96 w-96 rounded-full opacity-60 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(255,92,157,0.35), transparent 70%)' }}
        />
        <div
          className="animate-float absolute -right-24 top-16 h-[28rem] w-[28rem] rounded-full opacity-50 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(154,107,255,0.32), transparent 70%)',
            animationDelay: '-3s',
          }}
        />
        <div
          className="animate-float absolute bottom-0 left-1/3 h-80 w-80 rounded-full opacity-40 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(53,214,191,0.3), transparent 70%)',
            animationDelay: '-6s',
          }}
        />
      </div>

      <header className="sticky top-0 z-20 border-b border-border/60 bg-canvas/70 backdrop-blur-xl">
        <div className="flex w-full items-center justify-between px-6 py-5 sm:px-10 xl:px-16">
          <Link to="/" className="transition-transform duration-200 hover:-translate-y-0.5 hover:scale-[1.02]">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-5 text-lg">
            {user?.avatar_url && (
              <img
                src={user.avatar_url}
                alt=""
                className="h-10 w-10 rounded-full ring-2 ring-accent/30"
              />
            )}
            <span className="hidden font-medium text-muted sm:inline">
              {user?.full_name ?? user?.email}
            </span>
            <button onClick={logout} className="btn btn-ghost">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="w-full px-6 py-10 sm:px-10 xl:px-16">
        <Outlet />
      </main>
    </div>
  )
}
