import { lazy, Suspense, useCallback, useRef, useState } from 'react'

import { downloadAsset } from '../api/assets'
import type { Asset } from '../api/types'
import { FullscreenViewer } from './FullscreenViewer'

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
  const [expanded, setExpanded] = useState(false)
  const expand = () => setExpanded(true)

  function renderPreview() {
    if (asset.asset_type === 'model_3d') {
      return (
        <div className="relative h-[480px] overflow-hidden rounded-xl border border-border bg-gradient-to-b from-surface-2 to-canvas">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-subtle">
                Loading 3D viewer…
              </div>
            }
          >
            <ModelViewer key={fileUrl} url={fileUrl} onCapture={onCapture} />
          </Suspense>
          <ExpandButton onClick={expand} />
        </div>
      )
    }

    if (asset.asset_type === 'video') {
      return <VideoPreview asset={asset} onCapture={onCapture} onExpand={expand} />
    }

    if (asset.asset_type === 'image' || asset.asset_type === 'gif' || asset.asset_type === 'texture') {
      return (
        <div className="relative">
          <img
            src={fileUrl}
            alt={asset.original_filename}
            className="max-h-[480px] w-full rounded-xl border border-border bg-surface-2 object-contain"
          />
          <ExpandButton onClick={expand} />
        </div>
      )
    }

    return (
      <div className="flex h-[300px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface text-muted">
        <span className="text-sm">No preview available for this file type.</span>
        <button
          type="button"
          onClick={() => downloadAsset(asset.id, asset.original_filename)}
          className="text-sm font-medium text-accent hover:text-accent-hover"
        >
          Download original
        </button>
      </div>
    )
  }

  return (
    <>
      {renderPreview()}
      {expanded && <FullscreenViewer asset={asset} onClose={() => setExpanded(false)} />}
    </>
  )
}

/** Small overlay button that opens the fullscreen viewer. */
function ExpandButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="View fullscreen"
      title="View fullscreen"
      className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      </svg>
    </button>
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
  onExpand,
}: {
  asset: Asset
  onCapture?: (image: Blob) => void
  onExpand: () => void
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
      <div className="relative">
        <video
          ref={videoRef}
          src={fileUrl}
          controls
          preload="auto"
          onLoadedData={handleLoadedData}
          className="max-h-[480px] w-full rounded-xl border border-border bg-black"
        />
        <ExpandButton onClick={onExpand} />
      </div>
      {onCapture && (
        <button type="button" onClick={capture} className="btn btn-ghost px-3 py-1.5">
          Set current frame as thumbnail
        </button>
      )}
    </div>
  )
}
