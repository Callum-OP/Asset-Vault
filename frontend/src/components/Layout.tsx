import { Link, Outlet } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

export function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-full bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            LocalAsset <span className="text-violet-600">Vault</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            {user?.avatar_url && (
              <img src={user.avatar_url} alt="" className="h-7 w-7 rounded-full" />
            )}
            <span className="text-gray-500">{user?.full_name ?? user?.email}</span>
            <button
              onClick={logout}
              className="rounded-md border border-gray-300 px-3 py-1 font-medium hover:bg-gray-100"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
