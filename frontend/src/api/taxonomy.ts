import { api } from './client'
import type { Category, Tag } from './types'

export async function listTags(): Promise<Tag[]> {
  const { data } = await api.get<Tag[]>('/tags')
  return data
}

export async function createTag(name: string): Promise<Tag> {
  const { data } = await api.post<Tag>('/tags', { name })
  return data
}

export async function listCategories(): Promise<Category[]> {
  const { data } = await api.get<Category[]>('/categories')
  return data
}

export async function createCategory(name: string): Promise<Category> {
  const { data } = await api.post<Category>('/categories', { name })
  return data
}
