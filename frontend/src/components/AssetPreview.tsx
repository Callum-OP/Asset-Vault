import { lazy, Suspense, useCallback, useRef } from 'react'

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
      <div className="h-[480px] overflow-hidden rounded-xl border border-border bg-gradient-to-b from-surface-2 to-canvas">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-subtle">
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
    return <VideoPreview asset={asset} onCapture={onCapture} />
  }

  if (asset.asset_type === 'image' || asset.asset_type === 'gif' || asset.asset_type === 'texture') {
    return (
      <img
        src={fileUrl}
        alt={asset.original_filename}
        className="max-h-[480px] w-full rounded-xl border border-border bg-surface-2 object-contain"
      />
    )
  }

  return (
    <div className="flex h-[300px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface text-muted">
      <span className="text-sm">No preview available for this file type.</span>
      <a href={fileUrl} download className="text-sm font-medium text-accent hover:text-accent-hover">
        Download original
      </a>
    </div>
  )
}

/**
 * Video player that can grab a still frame for the gallery thumbnail — the
 * browser already decodes the video, so no server-side ffmpeg is needed. When
 * `onCapture` is set and the video has no thumbnail yet, one frame is captured
 * automatically the first time it's opened; the button lets you scrub to a
 * nicer frame and set it manually.
 */
function VideoPreview({
  asset,
  onCapture,
}: {
  asset: Asset
  onCapture?: (image: Blob) => void
}) {
  const fileUrl = `/storage/${asset.file_path}`
  const videoRef = useRef<HTMLVideoElement>(null)
  const autoCaptured = useRef(false)

  const capture = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.videoWidth || !onCapture) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => blob && onCapture(blob), 'image/png')
  }, [onCapture])

  // Auto-grab a representative frame (~1s in) the first time an
  // un-thumbnailed video is opened.
  function handleLoadedData() {
    const video = videoRef.current
    if (!video || autoCaptured.current || !onCapture || asset.thumbnail_path) return
    autoCaptured.current = true
    const target = Math.min(1, (video.duration || 2) / 2)
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      capture()
    }
    video.addEventListener('seeked', onSeeked)
    try {
      video.currentTime = target
    } catch {
      video.removeEventListener('seeked', onSeeked)
      capture()
    }
  }

  return (
    <div className="space-y-2">
      <video
        ref={videoRef}
        src={fileUrl}
        controls
        preload="auto"
        onLoadedData={handleLoadedData}
        className="max-h-[480px] w-full rounded-xl border border-border bg-black"
      />
      {onCapture && (
        <button type="button" onClick={capture} className="btn btn-ghost px-3 py-1.5">
          Set current frame as thumbnail
        </button>
      )}
    </div>
  )
}
