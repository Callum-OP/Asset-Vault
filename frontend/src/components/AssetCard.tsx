import { Link } from 'react-router-dom'

import type { Asset } from '../api/types'
// MIME-ish key used to carry an asset id between a dragged card and a folder
// drop target. Kept in sync with FolderSidebar.
export const ASSET_DND_MIME = 'application/x-asset-id'

const TYPE_LABELS: Record<Asset['asset_type'], string> = {
  image: 'Image',
  gif: 'GIF',
  video: 'Video',
  model_3d: '3D Model',
  texture: 'Texture',
  other: 'File',
}

export function AssetCard({
  asset,
  index = 0,
  draggable = false,
}: {
  asset: Asset
  index?: number
  // When true, the card can be dragged onto a sidebar folder to re-file it.
  draggable?: boolean
}) {
  const thumbnailUrl = asset.thumbnail_path ? `/storage/${asset.thumbnail_path}` : null

  return (
    <Link
      to={`/assets/${asset.id}`}
      draggable={draggable}
      onDragStart={
        draggable
          ? (e) => {
              e.dataTransfer.setData(ASSET_DND_MIME, String(asset.id))
              e.dataTransfer.effectAllowed = 'move'
            }
          : undefined
      }
      // Springy entrance, staggered by grid position; lifts and tilts a touch on hover.
      className={`group pop-in block overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-panel)] transition duration-300 ease-out hover:-translate-y-1.5 hover:rotate-[-0.6deg] hover:border-accent/50 hover:shadow-[var(--shadow-glow)] ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      style={{ animationDelay: `${Math.min(index, 16) * 45}ms` }}
    >
      <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-gradient-to-br from-surface-2 to-surface-3">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={asset.original_filename}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.07]"
          />
        ) : (
          <span className="text-base font-semibold text-subtle">
            {TYPE_LABELS[asset.asset_type]}
          </span>
        )}
        {asset.asset_type === 'video' && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 text-white shadow-lg backdrop-blur-sm transition duration-300 group-hover:scale-110">
              <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        )}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          {TYPE_LABELS[asset.asset_type]}
        </span>
        {asset.is_public && (
          <span
            title="Public"
            className="absolute right-2.5 top-2.5 rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm"
          >
            🌐
          </span>
        )}
      </div>

      <div className="space-y-2.5 p-4">
        <p className="truncate text-lg font-semibold text-fg" title={asset.original_filename}>
          {asset.original_filename}
        </p>
        {asset.dominant_colors && asset.dominant_colors.length > 0 && (
          <div className="flex gap-1.5">
            {asset.dominant_colors.slice(0, 5).map((color, i) => (
              <span
                key={`${color}-${i}`}
                className="h-5 w-5 rounded-full ring-1 ring-black/5"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        )}
        {asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {asset.tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
        {(asset.like_count > 0 || asset.comment_count > 0) && (
          <div className="flex items-center gap-3 text-sm text-muted">
            {asset.like_count > 0 && (
              <span className="flex items-center gap-1">
                <span className={asset.liked_by_me ? 'text-accent' : ''}>
                  {asset.liked_by_me ? '❤️' : '🤍'}
                </span>
                {asset.like_count}
              </span>
            )}
            {asset.comment_count > 0 && (
              <span className="flex items-center gap-1">💬 {asset.comment_count}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
