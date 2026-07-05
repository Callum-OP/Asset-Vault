import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { addComment, deleteComment, likeAsset, listComments, unlikeAsset } from '../api/social'
import type { Asset } from '../api/types'

interface Props {
  asset: Asset
  currentUserId: number | null
}

/** Likes + comments for a public asset (the "Others' assets" social surface). */
export function AssetSocial({ asset, currentUserId }: Props) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')

  const refreshAsset = () => {
    queryClient.invalidateQueries({ queryKey: ['asset', asset.id] })
    queryClient.invalidateQueries({ queryKey: ['assets'] })
  }

  const toggleLike = useMutation({
    mutationFn: () => (asset.liked_by_me ? unlikeAsset(asset.id) : likeAsset(asset.id)),
    onSuccess: refreshAsset,
  })

  const { data: comments } = useQuery({
    queryKey: ['comments', asset.id],
    queryFn: () => listComments(asset.id),
  })

  const refreshComments = () => {
    queryClient.invalidateQueries({ queryKey: ['comments', asset.id] })
    refreshAsset()
  }

  const postComment = useMutation({
    mutationFn: (body: string) => addComment(asset.id, body),
    onSuccess: () => {
      setDraft('')
      refreshComments()
    },
  })
  const removeComment = useMutation({
    mutationFn: (commentId: number) => deleteComment(asset.id, commentId),
    onSuccess: refreshComments,
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const body = draft.trim()
    if (body) postComment.mutate(body)
  }

  return (
    <div className="space-y-4 border-t border-border pt-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => toggleLike.mutate()}
          disabled={toggleLike.isPending}
          aria-pressed={asset.liked_by_me}
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
            asset.liked_by_me
              ? 'border-red-400/40 bg-red-400/10 text-red-300'
              : 'border-border text-muted hover:border-border-strong hover:text-fg'
          }`}
        >
          <span>{asset.liked_by_me ? '❤️' : '🤍'}</span>
          {asset.like_count} {asset.like_count === 1 ? 'like' : 'likes'}
        </button>
        <span className="text-sm text-muted">
          💬 {asset.comment_count} {asset.comment_count === 1 ? 'comment' : 'comments'}
        </span>
      </div>

      <div className="space-y-3">
        {(comments ?? []).map((comment) => {
          const canDelete =
            currentUserId === comment.user_id || currentUserId === asset.owner_id
          return (
            <div key={comment.id} className="group rounded-lg bg-surface-2/60 px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-fg">{comment.author_name}</span>
                <span className="flex items-center gap-2">
                  <time className="text-xs text-subtle">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </time>
                  {canDelete && (
                    <button
                      onClick={() => removeComment.mutate(comment.id)}
                      aria-label="Delete comment"
                      className="text-xs text-subtle opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                    >
                      ×
                    </button>
                  )}
                </span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-muted">
                {comment.body}
              </p>
            </div>
          )
        })}
        {comments && comments.length === 0 && (
          <p className="text-sm text-subtle">No comments yet — be the first to comment.</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment…"
          maxLength={2000}
          className="input flex-1 py-1.5"
        />
        <button
          type="submit"
          disabled={!draft.trim() || postComment.isPending}
          className="btn btn-accent px-3 py-1.5"
        >
          Post
        </button>
      </form>
    </div>
  )
}
