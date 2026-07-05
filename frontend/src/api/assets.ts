import { api } from './client'
import type { Asset, AssetList } from './types'

export interface AssetUpdate {
  description?: string | null
  source_url?: string | null
  rating?: number | null
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
  min_rating?: number
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

export async function uploadAsset(file: File): Promise<Asset> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<Asset>('/assets', form)
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

export async function setAssetThumbnail(id: number, image: Blob): Promise<Asset> {
  const form = new FormData()
  form.append('file', new File([image], 'thumbnail.png', { type: 'image/png' }))
  const { data } = await api.put<Asset>(`/assets/${id}/thumbnail`, form)
  return data
}
