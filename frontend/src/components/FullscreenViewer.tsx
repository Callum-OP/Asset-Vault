import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { downloadAsset } from '../api/assets'
import type { Asset } from '../api/types'

// Shares the same code-split chunk as AssetPreview's inline viewer.
const ModelViewer = lazy(() =>
  import('./ModelViewer').then((m) => ({ default: m.ModelViewer })),
)

/**
 * A full-viewport lightbox for viewing an asset large. Closes on Escape or a
 * backdrop click, and offers a true OS-level fullscreen toggle on top of the
 * in-app overlay (handy for inspecting 3D models and high-res textures).
 */
export function FullscreenViewer({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const fileUrl = `/storage/${asset.file_path}`
  const rootRef = useRef<HTMLDivElement>(null)
  const [isNativeFs, setIsNativeFs] = useState(false)

  // Close on Escape (unless we're in native fullscreen, where Esc exits that
  // first), and lock background scroll while the overlay is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  // Keep the toggle in sync if the user leaves native fullscreen via Esc/F11.
  useEffect(() => {
    const onFsChange = () => setIsNativeFs(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const toggleNativeFs = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen()
    else rootRef.current?.requestFullscreen?.().catch(() => {})
  }, [])

  function renderMedia() {
    if (asset.asset_type === 'model_3d') {
      return (
        <div className="h-[88vh] w-[94vw]">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-white/70">
                Loading 3D viewer…
              </div>
            }
          >
            <ModelViewer key={fileUrl} url={fileUrl} />
          </Suspense>
        </div>
      )
    }
    if (asset.asset_type === 'video') {
      return (
        <video
          src={fileUrl}
          controls
          autoPlay
          className="max-h-[92vh] max-w-[94vw] rounded-lg"
        />
      )
    }
    if (['image', 'gif', 'texture'].includes(asset.asset_type)) {
      return (
        <img
          src={fileUrl}
          alt={asset.original_filename}
          className="max-h-[92vh] max-w-[94vw] object-contain"
        />
      )
    }
    return (
      <div className="flex flex-col items-center gap-3 text-white/80">
        <span>No preview available for this file type.</span>
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
    <div
      ref={rootRef}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${asset.original_filename} — fullscreen`}
    >
      {/* Top toolbar: filename + controls. */}
      <div
        className="absolute inset-x-0 top-0 flex items-center justify-between gap-4 px-5 py-4"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="truncate text-sm font-medium text-white/80" title={asset.original_filename}>
          {asset.original_filename}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleNativeFs}
            aria-label={isNativeFs ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isNativeFs ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
          >
            {isNativeFs ? <CollapseIcon /> : <ExpandIcon />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Clicking the media itself shouldn't dismiss (esp. dragging a 3D model). */}
      <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
        {renderMedia()}
      </div>
    </div>
  )
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  )
}

function CollapseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
