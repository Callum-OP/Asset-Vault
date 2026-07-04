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
      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
        isDragActive
          ? 'border-violet-500 bg-violet-50'
          : 'border-gray-300 bg-white hover:border-violet-400'
      }`}
    >
      <input {...getInputProps()} />
      <p className="text-sm font-medium text-gray-700">
        {busy
          ? 'Uploading…'
          : isDragActive
            ? 'Drop the files here…'
            : 'Drag & drop assets here, or click to browse'}
      </p>
      <p className="mt-1 text-xs text-gray-400">Images, GIFs, videos, and 3D models</p>
    </div>
  )
}
