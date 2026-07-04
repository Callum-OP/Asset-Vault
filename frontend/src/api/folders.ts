import { api } from './client'
import type { Folder, FolderWithCount } from './types'

export async function listFolders(): Promise<FolderWithCount[]> {
  const { data } = await api.get<FolderWithCount[]>('/folders')
  return data
}

export async function createFolder(
  name: string,
  parentId: number | null = null,
): Promise<Folder> {
  const { data } = await api.post<Folder>('/folders', { name, parent_id: parentId })
  return data
}

export interface FolderPatch {
  name?: string
  parent_id?: number | null
}

export async function updateFolder(id: number, patch: FolderPatch): Promise<Folder> {
  const { data } = await api.patch<Folder>(`/folders/${id}`, patch)
  return data
}

export async function deleteFolder(id: number): Promise<void> {
  await api.delete(`/folders/${id}`)
}
