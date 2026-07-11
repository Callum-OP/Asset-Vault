import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { duplicateInfoFromError, listAssets, updateAsset, uploadAsset } from '../api/assets'
import type { AssetQuery, DuplicateInfo } from '../api/assets'
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
import { useAuth } from '../auth/AuthContext'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

export function GalleryPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  // Guests are read-only visitors: they only ever see the shared/public gallery,
  // with no folders, uploads, or editing.
  const isGuest = !!user?.is_guest
  const [selection, setSelection] = useState<FolderSelection>(isGuest ? 'public' : 'all')
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

  const assetParams: AssetQuery = { sort: filters.sort, order: filters.order }
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

  const PAGE_SIZE = 30
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['assets', selection, includeSubfolders, { ...filters, q: debouncedQ }],
      queryFn: ({ pageParam }) =>
        listAssets({ ...assetParams, limit: PAGE_SIZE, offset: pageParam }),
      initialPageParam: 0,
      getNextPageParam: (lastPage) => {
        const loaded = lastPage.offset + lastPage.items.length
        return loaded < lastPage.total ? loaded : undefined
      },
    })

  // Auto-load the next page when the sentinel below the grid scrolls into view.
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = loadMoreRef.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '600px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['assets'] })
    queryClient.invalidateQueries({ queryKey: ['folders'] })
  }

  // Files the backend flagged as byte-identical to something already in the
  // library. We surface a warning and let the user upload anyway or skip.
  const [duplicates, setDuplicates] = useState<{ file: File; info: DuplicateInfo }[]>([])
  const [uploadFailed, setUploadFailed] = useState(false)

  const upload = useMutation({
    mutationFn: async ({ file, allowDuplicate }: { file: File; allowDuplicate?: boolean }) => {
      const asset = await uploadAsset(file, allowDuplicate)
      // Uploads land in the folder you're currently viewing.
      if (typeof selection === 'number') {
        return updateAsset(asset.id, { folder_id: selection })
      }
      return asset
    },
    onSuccess: invalidate,
    onError: (err, variables) => {
      const info = duplicateInfoFromError(err)
      if (info) {
        setDuplicates((prev) =>
          prev.some((d) => d.file === variables.file) ? prev : [...prev, { file: variables.file, info }],
        )
      } else {
        setUploadFailed(true)
      }
    },
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

  // Drag an asset card onto a sidebar folder (or "Unfiled") to re-file it.
  const moveAsset = useMutation({
    mutationFn: ({ assetId, folderId }: { assetId: number; folderId: number | null }) =>
      updateAsset(assetId, { folder_id: folderId }),
    onSuccess: invalidate,
  })

  function handleFiles(files: File[]) {
    setUploadFailed(false)
    files.forEach((file) => upload.mutate({ file }))
  }

  function uploadAnyway(file: File) {
    setDuplicates((prev) => prev.filter((d) => d.file !== file))
    upload.mutate({ file, allowDuplicate: true })
  }

  function skipDuplicate(file: File) {
    setDuplicates((prev) => prev.filter((d) => d.file !== file))
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

  const assets = data?.pages.flatMap((page) => page.items) ?? []
  const total = data?.pages[0]?.total ?? 0
  const crumbs = typeof selection === 'number' ? folderPath(folders ?? [], selection) : []
  const filtersActive = activeFilterCount(filters) > 0

  const heading =
    selection === 'all'
      ? 'All my assets'
      : selection === 'unfiled'
        ? 'Unfiled'
        : selection === 'public'
          ? isGuest
            ? 'Shared assets'
            : "Others' assets"
          : crumbs.at(-1)?.name

  return (
    <div className="flex gap-10">
      {!isGuest && (
        <FolderSidebar
          tree={tree}
          selection={selection}
          onSelect={setSelection}
          onCreate={(name, parentId) => createFolderMutation.mutate({ name, parentId })}
          onRename={(id, name) => renameFolderMutation.mutate({ id, name })}
          onDelete={handleDeleteFolder}
          onMoveAsset={(assetId, folderId) => moveAsset.mutate({ assetId, folderId })}
        />
      )}

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
            <h1 className="text-5xl font-extrabold tracking-tight text-gradient">{heading}</h1>
            <p className="mt-2 text-lg text-muted">
              {isPublicView
                ? isGuest
                  ? `${total} shared item(s) · read-only`
                  : `${total} public item(s) · shared by you and other users`
                : data
                  ? `${total} item(s)`
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
            {uploadFailed && (
              <p className="text-sm text-red-500">
                Some files could not be uploaded (unsupported type or too large).
              </p>
            )}
            {duplicates.map(({ file, info }) => (
              <div
                key={file.name}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-fg"
              >
                <span className="flex-1">
                  <strong>{file.name}</strong> looks identical to{' '}
                  <strong>{info.existing_filename}</strong>, already in your library.
                </span>
                <button
                  onClick={() => uploadAnyway(file)}
                  className="btn btn-ghost px-3 py-1.5"
                >
                  Upload anyway
                </button>
                <button
                  onClick={() => skipDuplicate(file)}
                  className="btn btn-ghost px-3 py-1.5"
                >
                  Skip
                </button>
              </div>
            ))}
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

        {moveAsset.isError && (
          <p className="text-sm text-red-500">Could not move that asset. Please try again.</p>
        )}

        {assets.length > 0 && (
          <>
            {!isPublicView && (
              <p className="text-sm text-subtle">
                Tip: drag an asset onto a folder in the sidebar to move it.
              </p>
            )}
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 min-[1800px]:grid-cols-7 min-[2200px]:grid-cols-8">
              {assets.map((asset, i) => (
                <AssetCard key={asset.id} asset={asset} index={i} draggable={!isPublicView} />
              ))}
            </div>
            {/* Sentinel: scrolling near this triggers the next page. */}
            <div ref={loadMoreRef} aria-hidden className="h-px" />
            {isFetchingNextPage && (
              <p className="py-4 text-center text-sm text-muted">Loading more…</p>
            )}
            {!hasNextPage && total > PAGE_SIZE && (
              <p className="py-4 text-center text-sm text-subtle">That's everything.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
