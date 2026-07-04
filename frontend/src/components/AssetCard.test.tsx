import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { AssetCard } from './AssetCard'
import { makeAsset } from '../test/factories'

function renderCard(asset = makeAsset()) {
  return render(
    <MemoryRouter>
      <AssetCard asset={asset} />
    </MemoryRouter>,
  )
}

describe('AssetCard', () => {
  it('shows the filename, a thumbnail, and links to the details page', () => {
    renderCard(makeAsset({ id: 7, original_filename: 'sunset.png' }))
    expect(screen.getByText('sunset.png')).toBeInTheDocument()
    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.src).toContain('/storage/thumbnails/abc123.png')
    expect(screen.getByRole('link')).toHaveAttribute('href', '/assets/7')
  })

  it('shows a type placeholder for 3D models (no thumbnail)', () => {
    renderCard(makeAsset({ asset_type: 'model_3d', thumbnail_path: null, dominant_colors: null }))
    expect(screen.getAllByText('3D Model').length).toBeGreaterThan(0)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
