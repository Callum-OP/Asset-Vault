import { api } from './client'
import type { Comment, LikeStatus } from './types'

export async function likeAsset(id: number): Promise<LikeStatus> {
  const { data } = await api.post<LikeStatus>(`/assets/${id}/like`)
  return data
}

export async function unlikeAsset(id: number): Promise<LikeStatus> {
  const { data } = await api.delete<LikeStatus>(`/assets/${id}/like`)
  return data
}

export async function listComments(id: number): Promise<Comment[]> {
  const { data } = await api.get<Comment[]>(`/assets/${id}/comments`)
  return data
}

export async function addComment(
  id: number,
  body: string,
  parentId: number | null = null,
): Promise<Comment> {
  const { data } = await api.post<Comment>(`/assets/${id}/comments`, {
    body,
    parent_id: parentId,
  })
  return data
}

export async function deleteComment(assetId: number, commentId: number): Promise<void> {
  await api.delete(`/assets/${assetId}/comments/${commentId}`)
}
