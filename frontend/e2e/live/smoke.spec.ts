import { expect, test } from '@playwright/test'

import { DEMO_EMAIL, DEMO_PASSWORD, backendIsUp } from './helpers'

// These run against the REAL backend + seeded Postgres. Each test skips itself
// when the backend isn't reachable, so the suite is a no-op unless the full
// stack is up. To run them for real:
//   1. cd backend && uv run uvicorn app.main:app --reload
//   2. cd backend && uv run python -m scripts.seed
//   3. cd frontend && npm run test:e2e
test.describe('Live backend smoke', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await backendIsUp(request)), 'Backend not running — start uvicorn + seed to run live tests')
  })

  test('the demo user can sign in and see their gallery', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill(DEMO_EMAIL)
    await page.getByPlaceholder('Password').fill(DEMO_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL('http://localhost:5173/')
    await expect(page.getByRole('heading', { name: 'All my assets' })).toBeVisible()
    // The seeded demo user owns five private assets.
    await expect(page.getByText(/item\(s\)/)).toBeVisible()
    await expect(page.getByRole('button', { name: /log out/i })).toBeVisible()
  })

  test('bad credentials are rejected', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill(DEMO_EMAIL)
    await page.getByPlaceholder('Password').fill('definitely-wrong')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page.getByText('Incorrect email or password')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test("the public 'Others' assets' view is reachable", async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill(DEMO_EMAIL)
    await page.getByPlaceholder('Password').fill(DEMO_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL('http://localhost:5173/')

    await page.getByRole('button', { name: /others' assets/i }).click()
    await expect(page.getByRole('heading', { name: "Others' assets" })).toBeVisible()
  })
})
