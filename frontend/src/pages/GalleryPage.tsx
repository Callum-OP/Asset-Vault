import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { listAssets, updateAsset, uploadAsset } from '../api/assets'
import type { AssetQuery } from '../api/assets'
import { createFolder, deleteFolder, listFolders, updateFolder } from '../api/folders'
import { buildFolderTree, folderPath } from '../api/folderTree'
import type { FolderWithCount } from '../api/types'
import { AssetCard } from '../components/AssetCard'
import { FolderSidebar } from '../components/FolderSidebar'
import type { FolderSelection } from '../components/FolderSidebar'
import { UploadDropzone } from '../components/UploadDropzone'

export function GalleryPage() {
  const queryClient = useQueryClient()
  const [selection, setSelection] = useState<FolderSelection>('all')
  const [includeSubfolders, setIncludeSubfolders] = useState(true)

  const { data: folders } = useQuery({ queryKey: ['folders'], queryFn: listFolders })
  const tree = useMemo(() => buildFolderTree(folders ?? []), [folders])

  // If the viewed folder disappears (deleted, possibly via an ancestor
  // cascade), fall back to All assets so we never query a dead id.
  useEffect(() => {
    if (typeof selection === 'number' && folders && !folders.some((f) => f.id === selection)) {
      setSelection('all')
    }
  }, [folders, selection])

  const assetParams: AssetQuery = { limit: 100 }
  if (selection === 'unfiled') assetParams.unfiled = true
  else if (typeof selection === 'number') {
    assetParams.folder_id = selection
    assetParams.include_subfolders = includeSubfolders
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['assets', selection, includeSubfolders],
    queryFn: () => listAssets(assetParams),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['assets'] })
    queryClient.invalidateQueries({ queryKey: ['folders'] })
  }

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const asset = await uploadAsset(file)
      // Uploads land in the folder you're currently viewing.
      if (typeof selection === 'number') {
        return updateAsset(asset.id, { folder_id: selection })
      }
      return asset
    },
    onSuccess: invalidate,
  })

  const createFolderMutation = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: number | null }) =>
      createFolder(name, parentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['folders'] }),
  })
  const renameFolderMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => updateFolder(id, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['folders'] }),
  })
  const deleteFolderMutation = useMutation({
    mutationFn: (id: number) => deleteFolder(id),
    onSuccess: invalidate,
  })

  function handleFiles(files: File[]) {
    files.forEach((file) => upload.mutate(file))
  }

  function handleDeleteFolder(folder: FolderWithCount) {
    if (
      window.confirm(
        `Delete "${folder.name}"? Its subfolders are removed too; assets inside become unfiled (files are kept).`,
      )
    ) {
      deleteFolderMutation.mutate(folder.id)
    }
  }

  const assets = data?.items ?? []
  const crumbs = typeof selection === 'number' ? folderPath(folders ?? [], selection) : []

  const heading =
    selection === 'all' ? 'All assets' : selection === 'unfiled' ? 'Unfiled' : crumbs.at(-1)?.name

  return (
    <div className="flex gap-8">
      <FolderSidebar
        tree={tree}
        selection={selection}
        onSelect={setSelection}
        onCreate={(name, parentId) => createFolderMutation.mutate({ name, parentId })}
        onRename={(id, name) => renameFolderMutation.mutate({ id, name })}
        onDelete={handleDeleteFolder}
      />

      <div className="min-w-0 flex-1 space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <button className="hover:text-gray-800" onClick={() => setSelection('all')}>
                All
              </button>
              {crumbs.map((c) => (
                <span key={c.id} className="flex items-center gap-1">
                  <span className="text-gray-300">/</span>
                  <button className="hover:text-gray-800" onClick={() => setSelection(c.id)}>
                    {c.name}
                  </button>
                </span>
              ))}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
            <p className="text-sm text-gray-500">{data ? `${data.total} item(s)` : ' '}</p>
          </div>

          {typeof selection === 'number' && (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={includeSubfolders}
                onChange={(e) => setIncludeSubfolders(e.target.checked)}
              />
              Include subfolders
            </label>
          )}
        </div>

        <UploadDropzone onFiles={handleFiles} busy={upload.isPending} />
        {upload.isError && (
          <p className="text-sm text-red-600">
            Some files could not be uploaded (unsupported type or too large).
          </p>
        )}

        {isLoading && <p className="text-sm text-gray-500">Loading assets…</p>}
        {isError && <p className="text-sm text-red-600">Could not load your assets.</p>}

        {!isLoading && !isError && assets.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center text-gray-400">
            {selection === 'all'
              ? 'No assets yet — drop a file above to get started.'
              : 'This folder is empty — drop files above to add them here.'}
          </div>
        )}

        {assets.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {assets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
