import { expect, test } from '@playwright/test'

import { loginViaToken, makeAsset, mockApi } from './fixtures'

test.describe('Gallery (mocked API)', () => {
  test('shows the empty state when there are no assets', async ({ page }) => {
    await loginViaToken(page)
    await mockApi(page, { assets: [] })
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'All my assets' })).toBeVisible()
    await expect(page.getByText(/no assets yet/i)).toBeVisible()
  })

  test('renders asset cards with filename, count, and a details link', async ({ page }) => {
    await loginViaToken(page)
    await mockApi(page, {
      assets: [
        makeAsset({ id: 1, original_filename: 'sunset.png' }),
        makeAsset({ id: 2, original_filename: 'character.fbx', asset_type: 'model_3d' }),
      ],
    })
    await page.goto('/')

    await expect(page.getByText('sunset.png')).toBeVisible()
    await expect(page.getByText('character.fbx')).toBeVisible()
    await expect(page.getByText('2 item(s)')).toBeVisible()

    // The card links to its details page.
    await expect(page.getByRole('link', { name: /sunset\.png/i })).toHaveAttribute(
      'href',
      '/assets/1',
    )
  })

  test('the current user and a log-out control appear in the header', async ({ page }) => {
    await loginViaToken(page)
    await mockApi(page, { assets: [] })
    await page.goto('/')

    await expect(page.getByText('Demo User')).toBeVisible()
    await expect(page.getByRole('button', { name: /log out/i })).toBeVisible()
  })

  test('logging out returns to the login page', async ({ page }) => {
    await loginViaToken(page)
    await mockApi(page, { assets: [] })
    await page.goto('/')

    await page.getByRole('button', { name: /log out/i }).click()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('a search query filters the request and narrows the grid', async ({ page }) => {
    await loginViaToken(page)
    await mockApi(page, {
      assets: [makeAsset({ id: 1, original_filename: 'sunset.png' })],
    })
    // Once a query is typed, return only the matching asset from the backend.
    await page.route('**/assets?**q=sun**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [makeAsset({ id: 1, original_filename: 'sunset.png' })],
          total: 1,
          limit: 100,
          offset: 0,
        }),
      }),
    )
    await page.goto('/')

    const search = page.getByPlaceholder(/search name & description/i)
    await search.fill('sun')
    // Debounced at 300ms; the request should carry the query and the card stays.
    await expect(page.getByText('sunset.png')).toBeVisible()
    await expect(page.getByText('1 item(s)')).toBeVisible()
  })

  test('selecting a type filter marks it active and offers a clear control', async ({ page }) => {
    await loginViaToken(page)
    await mockApi(page, { assets: [makeAsset()] })
    await page.goto('/')

    await page.getByRole('button', { name: 'Video', exact: true }).click()
    await expect(page.getByRole('button', { name: /clear \(1\)/i })).toBeVisible()
  })

  test('dragging an asset onto a folder re-files it (PATCH folder_id)', async ({ page }) => {
    await loginViaToken(page)
    await mockApi(page, {
      assets: [makeAsset({ id: 1, original_filename: 'sunset.png' })],
      folders: [{ id: 10, name: 'Project', parent_id: null, asset_count: 0 }],
    })

    // Capture the re-file PATCH the drop should trigger.
    let patchBody: unknown = null
    await page.route('**/assets/1', (route) => {
      if (route.request().method() === 'PATCH') {
        patchBody = route.request().postDataJSON()
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeAsset({ id: 1, folder_id: 10 })),
        })
      }
      return route.continue()
    })

    await page.goto('/')
    await expect(page.getByText('sunset.png')).toBeVisible()
    await expect(page.getByText('📁 Project')).toBeVisible()

    // Native HTML5 drag-and-drop with a shared DataTransfer: dispatch the drag
    // events directly so the card's dragstart and the folder's drop share data.
    await page.evaluate((folderName: string) => {
      const card = document.querySelector('a[href="/assets/1"]')!
      const folderRow = [...document.querySelectorAll('nav div')].find((el) =>
        el.textContent?.includes(folderName),
      )!
      const dt = new DataTransfer()
      const fire = (el: Element, type: string) =>
        el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }))
      fire(card, 'dragstart')
      fire(folderRow, 'dragover')
      fire(folderRow, 'drop')
      fire(card, 'dragend')
    }, 'Project')

    await expect.poll(() => patchBody).toEqual({ folder_id: 10 })
  })
})
