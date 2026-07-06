import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { addComment, deleteComment, likeAsset, listComments, unlikeAsset } from '../api/social'
import type { Asset, Comment } from '../api/types'

interface Props {
  asset: Asset
  currentUserId: number | null
}

/** Likes and threaded comments for a public asset (the social surface). */
export function AssetSocial({ asset, currentUserId }: Props) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

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
    mutationFn: ({ body, parentId }: { body: string; parentId: number | null }) =>
      addComment(asset.id, body, parentId),
    onSuccess: (created) => {
      setDraft('')
      setReplyDraft('')
      setReplyingTo(null)
      // Auto-expand the parent so the new reply is visible.
      if (created.parent_id !== null) {
        setExpanded((prev) => new Set(prev).add(created.parent_id as number))
      }
      refreshComments()
    },
  })
  const removeComment = useMutation({
    mutationFn: (commentId: number) => deleteComment(asset.id, commentId),
    onSuccess: refreshComments,
  })

  const canDelete = (comment: Comment) =>
    currentUserId === comment.user_id || currentUserId === asset.owner_id

  const childrenOf = (parentId: number | null) =>
    (comments ?? []).filter((c) => c.parent_id === parentId)

  const toggleExpanded = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const body = draft.trim()
    if (body) postComment.mutate({ body, parentId: null })
  }

  function handleReplySubmit(event: FormEvent, parentId: number) {
    event.preventDefault()
    const body = replyDraft.trim()
    if (body) postComment.mutate({ body, parentId })
  }

  function renderNode(comment: Comment, depth: number) {
    const replies = childrenOf(comment.id)
    const isOpen = expanded.has(comment.id)
    return (
      <div key={comment.id} style={{ marginLeft: Math.min(depth, 5) * 20 }}>
        <div className="group rounded-lg bg-surface-2/60 px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-fg">{comment.author_name}</span>
            <span className="flex items-center gap-2">
              <time className="text-xs text-subtle">
                {new Date(comment.created_at).toLocaleDateString()}
              </time>
              {canDelete(comment) && (
                <button
                  onClick={() => removeComment.mutate(comment.id)}
                  aria-label="Delete comment"
                  className="text-xs text-subtle opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                >
                  ×
                </button>
              )}
            </span>
          </div>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-muted">
            {comment.body}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <button
              onClick={() => {
                setReplyingTo((cur) => (cur === comment.id ? null : comment.id))
                setReplyDraft('')
              }}
              className="text-xs font-medium text-subtle transition hover:text-accent"
            >
              {replyingTo === comment.id ? 'Cancel' : 'Reply'}
            </button>
            {replies.length > 0 && (
              <button
                onClick={() => toggleExpanded(comment.id)}
                className="text-xs font-medium text-accent transition hover:text-accent-hover"
              >
                {isOpen
                  ? 'Hide replies'
                  : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
              </button>
            )}
          </div>
        </div>

        {replyingTo === comment.id && (
          <form onSubmit={(e) => handleReplySubmit(e, comment.id)} className="mt-2 flex gap-2">
            <input
              autoFocus
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              placeholder={`Reply to ${comment.author_name}…`}
              maxLength={2000}
              className="input flex-1 py-1.5"
            />
            <button
              type="submit"
              disabled={!replyDraft.trim() || postComment.isPending}
              className="btn btn-accent px-3 py-1.5"
            >
              Reply
            </button>
          </form>
        )}

        {isOpen && <div className="mt-2 space-y-2">{replies.map((r) => renderNode(r, depth + 1))}</div>}
      </div>
    )
  }

  const topLevel = childrenOf(null)

  return (
    <div className="space-y-5 border-t border-border pt-5">
      {asset.owner_name && (
        <p className="text-sm text-muted">
          Shared by <span className="font-medium text-fg">{asset.owner_name}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="button"
          onClick={() => toggleLike.mutate()}
          disabled={toggleLike.isPending}
          aria-pressed={asset.liked_by_me}
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-base font-medium transition active:scale-95 ${
            asset.liked_by_me
              ? 'border-accent/40 bg-accent/10 text-accent'
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
        {topLevel.map((comment) => renderNode(comment, 0))}
        {comments && topLevel.length === 0 && (
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
