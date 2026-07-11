import { isAxiosError } from 'axios'

import { api } from './client'
import type { Asset, AssetList } from './types'

export interface DuplicateInfo {
  message: string
  existing_asset_id: number
  existing_filename: string
}

/** Extract the duplicate payload from a rejected upload, or null if it wasn't a 409. */
export function duplicateInfoFromError(err: unknown): DuplicateInfo | null {
  if (isAxiosError(err) && err.response?.status === 409) {
    const detail = err.response.data?.detail
    if (detail && typeof detail === 'object' && 'existing_asset_id' in detail) {
      return detail as DuplicateInfo
    }
  }
  return null
}

export interface AssetUpdate {
  description?: string | null
  source_url?: string | null
  category_id?: number | null
  folder_id?: number | null
  is_public?: boolean
}

export interface AssetQuery {
  limit?: number
  offset?: number
  scope?: 'mine' | 'public'
  q?: string
  type?: string
  category?: string
  tag?: string[]
  color?: string
  folder_id?: number
  include_subfolders?: boolean
  unfiled?: boolean
  sort?: string
  order?: string
}

export async function listAssets(params: AssetQuery = {}): Promise<AssetList> {
  const { data } = await api.get<AssetList>('/assets', { params })
  return data
}

export async function uploadAsset(file: File, allowDuplicate = false): Promise<Asset> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<Asset>('/assets', form, {
    params: allowDuplicate ? { allow_duplicate: true } : undefined,
  })
  return data
}

export async function getAsset(id: number): Promise<Asset> {
  const { data } = await api.get<Asset>(`/assets/${id}`)
  return data
}

export async function updateAsset(id: number, patch: AssetUpdate): Promise<Asset> {
  const { data } = await api.patch<Asset>(`/assets/${id}`, patch)
  return data
}

export async function deleteAsset(id: number): Promise<void> {
  await api.delete(`/assets/${id}`)
}

export async function addAssetTags(id: number, tagIds: number[]): Promise<Asset> {
  const { data } = await api.post<Asset>(`/assets/${id}/tags`, { tag_ids: tagIds })
  return data
}

export async function removeAssetTag(id: number, tagId: number): Promise<Asset> {
  const { data } = await api.delete<Asset>(`/assets/${id}/tags/${tagId}`)
  return data
}

export async function downloadAsset(id: number, filename: string): Promise<void> {
  // Fetch through the authenticated client (adds the JWT) so downloads work
  // for public assets too, then trigger a save under the original filename —
  // the raw /storage URL would save under the random stored name instead.
  const { data } = await api.get<Blob>(`/assets/${id}/download`, { responseType: 'blob' })
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function setAssetThumbnail(id: number, image: Blob): Promise<Asset> {
  const form = new FormData()
  form.append('file', new File([image], 'thumbnail.png', { type: 'image/png' }))
  const { data } = await api.put<Asset>(`/assets/${id}/thumbnail`, form)
  return data
}
