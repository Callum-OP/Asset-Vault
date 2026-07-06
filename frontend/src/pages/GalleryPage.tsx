import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { listAssets, updateAsset, uploadAsset } from '../api/assets'
import type { AssetQuery } from '../api/assets'
import { createFolder, deleteFolder, listFolders, updateFolder } from '../api/folders'
import { buildFolderTree, folderPath } from '../api/folderTree'
import { listCategories, listTags } from '../api/taxonomy'
import type { FolderWithCount } from '../api/types'
import { AssetCard } from '../components/AssetCard'
import { FilterBar, EMPTY_FILTERS, activeFilterCount } from '../components/FilterBar'
import type { Filters } from '../components/FilterBar'
import { FolderSidebar } from '../components/FolderSidebar'
import type { FolderSelection } from '../components/FolderSidebar'
import { UploadDropzone } from '../components/UploadDropzone'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

export function GalleryPage() {
  const queryClient = useQueryClient()
  const [selection, setSelection] = useState<FolderSelection>('all')
  const [includeSubfolders, setIncludeSubfolders] = useState(true)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)

  const patchFilters = (patch: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...patch }))
  const clearFilters = () =>
    setFilters((prev) => ({ ...EMPTY_FILTERS, sort: prev.sort, order: prev.order }))

  const { data: folders } = useQuery({ queryKey: ['folders'], queryFn: listFolders })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: listCategories })
  const { data: tags } = useQuery({ queryKey: ['tags'], queryFn: listTags })
  const tree = useMemo(() => buildFolderTree(folders ?? []), [folders])

  // If the viewed folder disappears (deleted, possibly via an ancestor
  // cascade), fall back to All assets so we never query a dead id.
  useEffect(() => {
    if (typeof selection === 'number' && folders && !folders.some((f) => f.id === selection)) {
      setSelection('all')
    }
  }, [folders, selection])

  const debouncedQ = useDebouncedValue(filters.q.trim(), 300)

  const isPublicView = selection === 'public'

  const assetParams: AssetQuery = { limit: 100, sort: filters.sort, order: filters.order }
  if (isPublicView) assetParams.scope = 'public'
  else if (selection === 'unfiled') assetParams.unfiled = true
  else if (typeof selection === 'number') {
    assetParams.folder_id = selection
    assetParams.include_subfolders = includeSubfolders
  }
  if (debouncedQ) assetParams.q = debouncedQ
  if (filters.type) assetParams.type = filters.type
  if (filters.category) assetParams.category = filters.category
  if (filters.tags.length) assetParams.tag = filters.tags
  if (filters.color) assetParams.color = filters.color

  const { data, isLoading, isError } = useQuery({
    queryKey: ['assets', selection, includeSubfolders, { ...filters, q: debouncedQ }],
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
  const filtersActive = activeFilterCount(filters) > 0

  const heading =
    selection === 'all'
      ? 'All my assets'
      : selection === 'unfiled'
        ? 'Unfiled'
        : selection === 'public'
          ? "Others' assets"
          : crumbs.at(-1)?.name

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
            <div className="flex items-center gap-1 text-sm text-muted">
              <button className="transition hover:text-accent" onClick={() => setSelection('all')}>
                All
              </button>
              {crumbs.map((c) => (
                <span key={c.id} className="flex items-center gap-1">
                  <span className="text-subtle">/</span>
                  <button className="transition hover:text-accent" onClick={() => setSelection(c.id)}>
                    {c.name}
                  </button>
                </span>
              ))}
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-gradient">{heading}</h1>
            <p className="mt-1 text-base text-muted">
              {isPublicView
                ? `${data ? data.total : 0} public item(s) · shared by you and other users`
                : data
                  ? `${data.total} item(s)`
                  : ' '}
            </p>
          </div>

          {typeof selection === 'number' && (
            <label className="flex cursor-pointer items-center gap-2 text-base text-muted">
              <input
                type="checkbox"
                checked={includeSubfolders}
                onChange={(e) => setIncludeSubfolders(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              Include subfolders
            </label>
          )}
        </div>

        {!isPublicView && (
          <>
            <UploadDropzone onFiles={handleFiles} busy={upload.isPending} />
            {upload.isError && (
              <p className="text-sm text-red-500">
                Some files could not be uploaded (unsupported type or too large).
              </p>
            )}
          </>
        )}

        <FilterBar
          filters={filters}
          onChange={patchFilters}
          onClear={clearFilters}
          categories={categories ?? []}
          tags={tags ?? []}
        />

        {isLoading && <p className="text-base text-muted">Loading assets…</p>}
        {isError && <p className="text-base text-red-500">Could not load your assets.</p>}

        {!isLoading && !isError && assets.length === 0 && (
          <div className="fade-up rounded-2xl border-2 border-dashed border-border bg-surface/60 py-20 text-center text-base text-muted">
            {filtersActive ? (
              <>
                No assets match your filters.{' '}
                <button onClick={clearFilters} className="text-accent hover:text-accent-hover">
                  Clear filters
                </button>
              </>
            ) : isPublicView ? (
              'No public assets yet — make one public from its details page.'
            ) : selection === 'all' ? (
              'No assets yet — drop a file above to get started.'
            ) : (
              'This folder is empty — drop files above to add them here.'
            )}
          </div>
        )}

        {assets.length > 0 && (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {assets.map((asset, i) => (
              <AssetCard key={asset.id} asset={asset} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
