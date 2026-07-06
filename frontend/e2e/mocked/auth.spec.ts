import { expect, test } from '@playwright/test'

import { mockApi } from './fixtures'

test.describe('Authentication (mocked API)', () => {
  test('unauthenticated visits are redirected to the login page', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByPlaceholder('Email')).toBeVisible()
    await expect(page.getByPlaceholder('Password')).toBeVisible()
  })

  test('the sign-in button is disabled until both fields are filled', async ({ page }) => {
    await mockApi(page)
    await page.goto('/login')
    const signIn = page.getByRole('button', { name: /sign in/i })
    await expect(signIn).toBeDisabled()

    await page.getByPlaceholder('Email').fill('demo@example.com')
    await expect(signIn).toBeDisabled()

    await page.getByPlaceholder('Password').fill('demopass1')
    await expect(signIn).toBeEnabled()
  })

  test('a valid sign-in lands on the gallery', async ({ page }) => {
    await mockApi(page)
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill('demo@example.com')
    await page.getByPlaceholder('Password').fill('demopass1')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL('http://localhost:5173/')
    await expect(page.getByRole('heading', { name: 'All my assets' })).toBeVisible()
  })

  test('a rejected sign-in shows an error and stays on the login page', async ({ page }) => {
    await mockApi(page, { loginFails: true })
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill('demo@example.com')
    await page.getByPlaceholder('Password').fill('wrong')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page.getByText('Incorrect email or password')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('the register form requires an 8-character password', async ({ page }) => {
    await mockApi(page)
    await page.goto('/register')
    const create = page.getByRole('button', { name: /create account/i })

    await page.getByPlaceholder('Email').fill('new@example.com')
    await page.getByPlaceholder(/password/i).fill('short')
    await expect(create).toBeDisabled()

    await page.getByPlaceholder(/password/i).fill('longenough1')
    await expect(create).toBeEnabled()
  })

  test('registering a new account signs in and lands on the gallery', async ({ page }) => {
    await mockApi(page)
    await page.goto('/register')
    await page.getByPlaceholder('Email').fill('new@example.com')
    await page.getByPlaceholder(/password/i).fill('longenough1')
    await page.getByRole('button', { name: /create account/i }).click()

    await expect(page).toHaveURL('http://localhost:5173/')
    await expect(page.getByRole('heading', { name: 'All my assets' })).toBeVisible()
  })

  test('the login and register pages link to each other', async ({ page }) => {
    await mockApi(page)
    await page.goto('/login')
    await page.getByRole('link', { name: /create one/i }).click()
    await expect(page).toHaveURL(/\/register$/)

    await page.getByRole('link', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/login$/)
  })
})
