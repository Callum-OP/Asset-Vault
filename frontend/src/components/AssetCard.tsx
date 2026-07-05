import { Link } from 'react-router-dom'

import type { Asset } from '../api/types'

const TYPE_LABELS: Record<Asset['asset_type'], string> = {
  image: 'Image',
  gif: 'GIF',
  video: 'Video',
  model_3d: '3D Model',
  texture: 'Texture',
  other: 'File',
}

export function AssetCard({ asset }: { asset: Asset }) {
  const thumbnailUrl = asset.thumbnail_path ? `/storage/${asset.thumbnail_path}` : null

  return (
    <Link
      to={`/assets/${asset.id}`}
      className="group block overflow-hidden rounded-xl border border-border bg-surface transition duration-200 hover:-translate-y-1 hover:border-accent/40 hover:shadow-[var(--shadow-glow)]">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-surface-2">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={asset.original_filename}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="text-sm font-medium text-subtle">
            {TYPE_LABELS[asset.asset_type]}
          </span>
        )}
        {asset.asset_type === 'video' && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white shadow-sm">
              <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-sm ring-1 ring-white/10">
          {TYPE_LABELS[asset.asset_type]}
        </span>
        {asset.is_public && (
          <span
            title="Public"
            className="absolute right-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-sm ring-1 ring-white/10"
          >
            🌐
          </span>
        )}
      </div>

      <div className="space-y-2 p-3">
        <p className="truncate text-sm font-medium text-fg" title={asset.original_filename}>
          {asset.original_filename}
        </p>
        {asset.dominant_colors && asset.dominant_colors.length > 0 && (
          <div className="flex gap-1">
            {asset.dominant_colors.slice(0, 5).map((color, i) => (
              <span
                key={`${color}-${i}`}
                className="h-4 w-4 rounded-full ring-1 ring-white/10"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        )}
        {asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {asset.tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
        {(asset.like_count > 0 || asset.comment_count > 0) && (
          <div className="flex items-center gap-3 text-xs text-muted">
            {asset.like_count > 0 && (
              <span className="flex items-center gap-1">
                <span className={asset.liked_by_me ? 'text-red-400' : ''}>
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
