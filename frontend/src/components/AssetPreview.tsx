import { lazy, Suspense } from 'react'

import type { Asset } from '../api/types'

// Three.js is heavy, so the 3D viewer is code-split and only loaded when an
// actual model is displayed.
const ModelViewer = lazy(() =>
  import('./ModelViewer').then((m) => ({ default: m.ModelViewer })),
)

interface Props {
  asset: Asset
  // Called with a canvas snapshot for 3D models that still need a thumbnail.
  onCapture?: (image: Blob) => void
}

export function AssetPreview({ asset, onCapture }: Props) {
  const fileUrl = `/storage/${asset.file_path}`

  if (asset.asset_type === 'model_3d') {
    return (
      <div className="h-[480px] overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-gray-200">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              Loading 3D viewer…
            </div>
          }
        >
          <ModelViewer key={fileUrl} url={fileUrl} onCapture={onCapture} />
        </Suspense>
      </div>
    )
  }

  if (asset.asset_type === 'video') {
    return (
      <video
        src={fileUrl}
        controls
        className="max-h-[480px] w-full rounded-xl border border-gray-200 bg-black"
      />
    )
  }

  if (asset.asset_type === 'image' || asset.asset_type === 'gif' || asset.asset_type === 'texture') {
    return (
      <img
        src={fileUrl}
        alt={asset.original_filename}
        className="max-h-[480px] w-full rounded-xl border border-gray-200 object-contain"
        style={{ backgroundColor: '#f3f4f6' }}
      />
    )
  }

  return (
    <div className="flex h-[300px] flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500">
      <span className="text-sm">No preview available for this file type.</span>
      <a href={fileUrl} download className="text-sm font-medium text-violet-600 hover:underline">
        Download original
      </a>
    </div>
  )
}
