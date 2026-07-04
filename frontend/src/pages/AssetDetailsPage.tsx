import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  addAssetTags,
  deleteAsset,
  getAsset,
  removeAssetTag,
  setAssetThumbnail,
  updateAsset,
} from '../api/assets'
import type { AssetUpdate } from '../api/assets'
import { listFolders } from '../api/folders'
import { folderPath } from '../api/folderTree'
import { createCategory, createTag, listCategories, listTags } from '../api/taxonomy'
import { AssetPreview } from '../components/AssetPreview'
import { RatingStars } from '../components/RatingStars'

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(1)} ${units[i]}`
}

export function AssetDetailsPage() {
  const { id } = useParams()
  const assetId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: asset, isLoading, isError } = useQuery({
    queryKey: ['asset', assetId],
    queryFn: () => getAsset(assetId),
    enabled: Number.isFinite(assetId),
  })
  const { data: tags } = useQuery({ queryKey: ['tags'], queryFn: listTags })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: listCategories })
  const { data: folders } = useQuery({ queryKey: ['folders'], queryFn: listFolders })

  // Full-path labels ("Project / sub") so the flat dropdown reads as a tree.
  const folderOptions = (folders ?? [])
    .map((f) => ({
      id: f.id,
      label: folderPath(folders ?? [], f.id)
        .map((p) => p.name)
        .join(' / '),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const [description, setDescription] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [newCategory, setNewCategory] = useState('')

  // Seed editable fields when the asset loads / changes.
  useEffect(() => {
    if (asset) {
      setDescription(asset.description ?? '')
      setSourceUrl(asset.source_url ?? '')
    }
  }, [asset])

  const invalidateAsset = () => {
    queryClient.invalidateQueries({ queryKey: ['asset', assetId] })
    queryClient.invalidateQueries({ queryKey: ['assets'] })
    queryClient.invalidateQueries({ queryKey: ['folders'] })
  }

  const patch = useMutation({
    mutationFn: (update: AssetUpdate) => updateAsset(assetId, update),
    onSuccess: invalidateAsset,
  })
  const attach = useMutation({
    mutationFn: (tagIds: number[]) => addAssetTags(assetId, tagIds),
    onSuccess: invalidateAsset,
  })
  const detach = useMutation({
    mutationFn: (tagId: number) => removeAssetTag(assetId, tagId),
    onSuccess: invalidateAsset,
  })
  const createTagMutation = useMutation({
    mutationFn: (name: string) => createTag(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
  })
  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => createCategory(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  })
  const remove = useMutation({
    mutationFn: () => deleteAsset(assetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      navigate('/')
    },
  })
  const saveThumbnail = useMutation({
    mutationFn: (image: Blob) => setAssetThumbnail(assetId, image),
    onSuccess: invalidateAsset,
  })

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>
  if (isError || !asset) return <p className="text-sm text-red-600">Asset not found.</p>

  async function handleAddTag(event: FormEvent) {
    event.preventDefault()
    const name = tagInput.trim()
    if (!name) return
    const existing = (tags ?? []).find((t) => t.name.toLowerCase() === name.toLowerCase())
    const tag = existing ?? (await createTagMutation.mutateAsync(name))
    if (!asset!.tags.some((t) => t.id === tag.id)) await attach.mutateAsync([tag.id])
    setTagInput('')
  }

  async function handleCreateCategory() {
    const name = newCategory.trim()
    if (!name) return
    const category = await createCategoryMutation.mutateAsync(name)
    patch.mutate({ category_id: category.id })
    setNewCategory('')
  }

  return (
    <div className="space-y-6">
      <Link to="/" className="text-sm text-violet-600 hover:underline">
        ← Back to gallery
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        <AssetPreview
          asset={asset}
          onCapture={
            // 3D models auto-capture once when they still need a thumbnail;
            // videos can always (re)set a frame as the thumbnail.
            ((asset.asset_type === 'model_3d' && !asset.thumbnail_path) ||
              asset.asset_type === 'video') &&
            !saveThumbnail.isPending
              ? (image) => saveThumbnail.mutate(image)
              : undefined
          }
        />

        <div className="space-y-6">
          <div>
            <h1 className="break-words text-xl font-semibold">{asset.original_filename}</h1>
            <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm text-gray-600">
              <dt className="text-gray-400">Type</dt>
              <dd>{asset.asset_type}</dd>
              <dt className="text-gray-400">Size</dt>
              <dd>{humanSize(asset.file_size)}</dd>
              {asset.width && asset.height && (
                <>
                  <dt className="text-gray-400">Dimensions</dt>
                  <dd>
                    {asset.width} × {asset.height}
                  </dd>
                </>
              )}
              <dt className="text-gray-400">Uploaded</dt>
              <dd>{new Date(asset.created_at).toLocaleDateString()}</dd>
            </dl>
          </div>

          {asset.dominant_colors && asset.dominant_colors.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">Colors</p>
              <div className="flex gap-2">
                {asset.dominant_colors.map((color, i) => (
                  <span
                    key={`${color}-${i}`}
                    className="h-8 w-8 rounded-md border border-black/10"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">Rating</p>
            <RatingStars value={asset.rating} onChange={(v) => patch.mutate({ rating: v })} />
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">Folder</p>
            <select
              value={asset.folder_id ?? ''}
              onChange={(e) =>
                patch.mutate({ folder_id: e.target.value ? Number(e.target.value) : null })
              }
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">— Unfiled —</option>
              {folderOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">Category</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={asset.category_id ?? ''}
                onChange={(e) =>
                  patch.mutate({ category_id: e.target.value ? Number(e.target.value) : null })
                }
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">— None —</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New category"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
              <button
                onClick={handleCreateCategory}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
              >
                Add
              </button>
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">Tags</p>
            <div className="mb-2 flex flex-wrap gap-1">
              {asset.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700"
                >
                  {tag.name}
                  <button
                    onClick={() => detach.mutate(tag.id)}
                    aria-label={`Remove ${tag.name}`}
                    className="text-violet-500 hover:text-violet-900"
                  >
                    ×
                  </button>
                </span>
              ))}
              {asset.tags.length === 0 && <span className="text-sm text-gray-400">No tags yet</span>}
            </div>
            <form onSubmit={handleAddTag} className="flex gap-2">
              <input
                list="tag-options"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag…"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
              <datalist id="tag-options">
                {(tags ?? []).map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
              </datalist>
              <button
                type="submit"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
              >
                Add
              </button>
            </form>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              onClick={() => patch.mutate({ description: description || null })}
              disabled={description === (asset.description ?? '')}
              className="mt-1 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              Save description
            </button>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Source URL</label>
            <div className="flex gap-2">
              <input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://…"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
              <button
                onClick={() => patch.mutate({ source_url: sourceUrl || null })}
                disabled={sourceUrl === (asset.source_url ?? '')}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <button
              onClick={() => {
                if (window.confirm('Delete this asset permanently?')) remove.mutate()
              }}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Delete asset
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
