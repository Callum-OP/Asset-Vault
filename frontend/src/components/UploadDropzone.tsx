import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

interface Props {
  onFiles: (files: File[]) => void
  busy: boolean
}

export function UploadDropzone({ onFiles, busy }: Props) {
  const onDrop = useCallback((accepted: File[]) => onFiles(accepted), [onFiles])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  return (
    <div
      {...getRootProps()}
      className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
        isDragActive
          ? 'border-accent bg-accent/10'
          : 'border-border bg-surface/50 hover:border-accent/60 hover:bg-surface'
      }`}
    >
      <input {...getInputProps()} />
      <div
        className={`mb-3 grid h-10 w-10 place-items-center rounded-full transition ${
          isDragActive ? 'bg-accent/20 text-accent' : 'bg-surface-2 text-muted group-hover:text-accent'
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 16V4m0 0 4 4m-4-4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-sm font-medium text-fg">
        {busy
          ? 'Uploading…'
          : isDragActive
            ? 'Drop the files here…'
            : 'Drag & drop assets here, or click to browse'}
      </p>
      <p className="mt-1 text-xs text-subtle">Images, GIFs, videos, and 3D models</p>
    </div>
  )
}
