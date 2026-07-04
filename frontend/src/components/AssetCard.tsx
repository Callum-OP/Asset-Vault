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
      className="group block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="relative flex aspect-square items-center justify-center bg-gray-100">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={asset.original_filename}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-sm font-medium text-gray-400">
            {TYPE_LABELS[asset.asset_type]}
          </span>
        )}
        <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">
          {TYPE_LABELS[asset.asset_type]}
        </span>
      </div>

      <div className="space-y-2 p-3">
        <p className="truncate text-sm font-medium" title={asset.original_filename}>
          {asset.original_filename}
        </p>
        {asset.dominant_colors && asset.dominant_colors.length > 0 && (
          <div className="flex gap-1">
            {asset.dominant_colors.slice(0, 5).map((color, i) => (
              <span
                key={`${color}-${i}`}
                className="h-4 w-4 rounded-full border border-black/10"
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
                className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] text-violet-700"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
