import type { APIRequestContext } from '@playwright/test'

// The demo account created by `backend/scripts/seed.py` (see README).
export const DEMO_EMAIL = 'demo@example.com'
export const DEMO_PASSWORD = 'demopass1'

// Probe the backend directly (bypassing the Vite proxy) so live tests can skip
// themselves when the stack isn't running. Use 127.0.0.1 to match uvicorn's
// IPv4 bind on Windows.
const HEALTH_URL = process.env.VITE_API_TARGET
  ? `${process.env.VITE_API_TARGET}/health`
  : 'http://127.0.0.1:8000/health'

export async function backendIsUp(request: APIRequestContext): Promise<boolean> {
  try {
    const res = await request.get(HEALTH_URL, { timeout: 2000 })
    return res.ok()
  } catch {
    return false
  }
}
