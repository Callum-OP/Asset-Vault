import type { Asset } from '../api/types'

export function makeAsset(overrides: Partial<Asset> = {}): Asset {
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
    rating: null,
    category_id: null,
    category: null,
    folder_id: null,
    folder: null,
    tags: [],
    created_at: '2026-07-03T00:00:00Z',
    updated_at: '2026-07-03T00:00:00Z',
    ...overrides,
  }
}
