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
      className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition duration-300 ${
        isDragActive
          ? 'scale-[1.01] border-accent bg-accent/10 shadow-[var(--shadow-glow)]'
          : 'border-border-strong bg-surface/60 hover:border-accent/60 hover:bg-surface hover:shadow-[var(--shadow-panel)]'
      }`}
    >
      <input {...getInputProps()} />
      <div
        className={`mb-4 grid h-14 w-14 place-items-center rounded-2xl transition duration-300 group-hover:-translate-y-1 ${
          isDragActive
            ? 'bg-gradient-to-br from-accent to-grape text-white'
            : 'bg-surface-2 text-muted group-hover:bg-gradient-to-br group-hover:from-accent group-hover:to-grape group-hover:text-white'
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 16V4m0 0 4 4m-4-4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-lg font-semibold text-fg">
        {busy
          ? 'Uploading…'
          : isDragActive
            ? 'Drop the files here…'
            : 'Drag & drop assets here, or click to browse'}
      </p>
      <p className="mt-1.5 text-sm text-subtle">Images, GIFs, videos, and 3D models</p>
    </div>
  )
}
