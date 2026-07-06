import type { Page, Route } from '@playwright/test'

// Mirrors the backend's User shape (see src/api/types.ts).
export const DEMO_USER = {
  id: 1,
  email: 'demo@example.com',
  full_name: 'Demo User',
  avatar_url: null,
  created_at: '2026-07-01T00:00:00Z',
}

// A minimal Asset matching src/api/types.ts / src/test/factories.ts.
export function makeAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    owner_id: 1,
    is_public: false,
    original_filename: 'hero.png',
    stored_filename: 'abc123.png',
    file_path: 'files/abc123.png',
    file_size: 1024,
    mime_type: 'image/png',
    asset_type: 'image',
    thumbnail_path: 'thumbnails/abc123.png',
    width: 64,
    height: 48,
    dominant_colors: ['#112233', '#445566'],
    description: null,
    source_url: null,
    category_id: null,
    category: null,
    folder_id: null,
    folder: null,
    tags: [],
    created_at: '2026-07-03T00:00:00Z',
    updated_at: '2026-07-03T00:00:00Z',
    owner_name: null,
    like_count: 0,
    comment_count: 0,
    liked_by_me: false,
    ...overrides,
  }
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

interface MockOptions {
  assets?: ReturnType<typeof makeAsset>[]
  user?: typeof DEMO_USER
  // When set, /auth/login returns 401 so we can exercise the error path.
  loginFails?: boolean
}

/**
 * Stub every backend route the app touches so the SPA runs with no server.
 * Call before navigating. Thumbnail image requests are answered with a 1x1 PNG
 * so <img> loads don't hang against the (absent) backend.
 */
export async function mockApi(page: Page, opts: MockOptions = {}) {
  const assets = opts.assets ?? []
  const user = opts.user ?? DEMO_USER

  await page.route('**/auth/login', (route) =>
    opts.loginFails
      ? json(route, { detail: 'Incorrect email or password' }, 401)
      : json(route, { access_token: 'test-token', token_type: 'bearer' }),
  )
  await page.route('**/auth/register', (route) =>
    json(route, { ...user, id: 2 }, 201),
  )
  await page.route('**/auth/me', (route) => json(route, user))

  // Gallery data. Match /assets and /assets?... but not /assets/:id detail.
  await page.route('**/assets?**', (route) =>
    json(route, { items: assets, total: assets.length, limit: 100, offset: 0 }),
  )
  await page.route('**/assets', (route) =>
    json(route, { items: assets, total: assets.length, limit: 100, offset: 0 }),
  )

  await page.route('**/folders', (route) => json(route, []))
  await page.route('**/categories', (route) => json(route, []))
  await page.route('**/tags', (route) => json(route, []))

  // 1x1 transparent PNG for thumbnail requests.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
    'base64',
  )
  await page.route('**/storage/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: png }),
  )
}

/** Seed a token in localStorage so the app boots straight into an authed session. */
export async function loginViaToken(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('av_token', 'test-token')
  })
}
