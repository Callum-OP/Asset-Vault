import { useState } from 'react'
import type { DragEvent, HTMLAttributes } from 'react'

import type { FolderNode } from '../api/folderTree'
import type { FolderWithCount } from '../api/types'
import { ASSET_DND_MIME } from './AssetCard'

/** What the gallery is currently showing. */
export type FolderSelection = 'all' | 'unfiled' | 'public' | number

interface FolderSidebarProps {
  tree: FolderNode[]
  selection: FolderSelection
  onSelect: (selection: FolderSelection) => void
  onCreate: (name: string, parentId: number | null) => void
  onRename: (id: number, name: string) => void
  onDelete: (folder: FolderWithCount) => void
  // Re-file a dragged asset. folderId is null for "Unfiled".
  onMoveAsset?: (assetId: number, folderId: number | null) => void
}

const ROW_BASE =
  'group flex items-center gap-1.5 rounded-xl px-3 py-2 text-base cursor-pointer select-none transition duration-200'
const ROW_ACTIVE = 'bg-gradient-to-r from-accent/15 to-grape/15 font-semibold text-accent'
const ROW_IDLE = 'text-muted hover:bg-surface-2 hover:text-fg'
// Applied to a folder row while an asset is hovering over it, ready to drop.
const ROW_DROP = 'ring-2 ring-inset ring-accent bg-accent/10 text-accent'

/** Handlers + hover flag for a folder that accepts dropped assets. */
export interface DropTarget {
  isOver: boolean
  dropProps: Pick<HTMLAttributes<HTMLDivElement>, 'onDragOver' | 'onDragLeave' | 'onDrop'>
}

export function FolderSidebar({
  tree,
  selection,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onMoveAsset,
}: FolderSidebarProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const expand = (id: number) => setExpanded((prev) => new Set(prev).add(id))

  function promptCreate(parentId: number | null) {
    const name = window.prompt(parentId ? 'New subfolder name' : 'New folder name')?.trim()
    if (name) {
      if (parentId) expand(parentId)
      onCreate(name, parentId)
    }
  }

  // Build drop-target behaviour for one row. No-op when dragging isn't enabled.
  function dropTarget(key: string, folderId: number | null): DropTarget {
    if (!onMoveAsset) return { isOver: false, dropProps: {} }
    return {
      isOver: dragOverKey === key,
      dropProps: {
        onDragOver: (e: DragEvent<HTMLDivElement>) => {
          if (!e.dataTransfer.types.includes(ASSET_DND_MIME)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          if (dragOverKey !== key) setDragOverKey(key)
        },
        onDragLeave: () => setDragOverKey((k) => (k === key ? null : k)),
        onDrop: (e: DragEvent<HTMLDivElement>) => {
          const raw = e.dataTransfer.getData(ASSET_DND_MIME)
          setDragOverKey(null)
          if (!raw) return
          e.preventDefault()
          onMoveAsset(Number(raw), folderId)
        },
      },
    }
  }

  const unfiledDrop = dropTarget('unfiled', null)

  return (
    <nav className="w-64 shrink-0 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest text-subtle">Folders</h2>
        <button
          type="button"
          onClick={() => promptCreate(null)}
          className="rounded-full border border-border px-3 py-1 text-sm font-medium text-muted transition hover:border-accent/50 hover:text-accent"
        >
          + New
        </button>
      </div>

      <ul className="space-y-0.5">
        <li>
          <div
            className={`${ROW_BASE} ${selection === 'public' ? ROW_ACTIVE : ROW_IDLE}`}
            onClick={() => onSelect('public')}
          >
            <span className="w-3" />
            <span>🌐 Others' assets</span>
          </div>
        </li>
        <li>
          <div
            className={`${ROW_BASE} ${selection === 'all' ? ROW_ACTIVE : ROW_IDLE}`}
            onClick={() => onSelect('all')}
          >
            <span className="w-3" />
            <span>🗂️ All my assets</span>
          </div>
        </li>
        <li>
          <div
            className={`${ROW_BASE} ${
              unfiledDrop.isOver ? ROW_DROP : selection === 'unfiled' ? ROW_ACTIVE : ROW_IDLE
            }`}
            onClick={() => onSelect('unfiled')}
            {...unfiledDrop.dropProps}
          >
            <span className="w-3" />
            <span>📥 Unfiled</span>
          </div>
        </li>
      </ul>

      {tree.length > 0 && (
        <ul className="space-y-0.5">
          {tree.map((node) => (
            <FolderTreeNode
              key={node.id}
              node={node}
              depth={0}
              selection={selection}
              expanded={expanded}
              onToggle={toggle}
              onSelect={onSelect}
              onAddChild={promptCreate}
              onRename={onRename}
              onDelete={onDelete}
              dropTarget={dropTarget}
            />
          ))}
        </ul>
      )}
    </nav>
  )
}

interface FolderTreeNodeProps {
  node: FolderNode
  depth: number
  selection: FolderSelection
  expanded: Set<number>
  onToggle: (id: number) => void
  onSelect: (selection: FolderSelection) => void
  onAddChild: (parentId: number) => void
  onRename: (id: number, name: string) => void
  onDelete: (folder: FolderWithCount) => void
  dropTarget: (key: string, folderId: number | null) => DropTarget
}

function FolderTreeNode({
  node,
  depth,
  selection,
  expanded,
  onToggle,
  onSelect,
  onAddChild,
  onRename,
  onDelete,
  dropTarget,
}: FolderTreeNodeProps) {
  const hasChildren = node.children.length > 0
  const open = expanded.has(node.id)
  const active = selection === node.id
  const { isOver, dropProps } = dropTarget(`f${node.id}`, node.id)

  return (
    <li>
      <div
        className={`${ROW_BASE} ${isOver ? ROW_DROP : active ? ROW_ACTIVE : ROW_IDLE}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => onSelect(node.id)}
        {...dropProps}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (hasChildren) onToggle(node.id)
          }}
          className={`w-3 shrink-0 text-xs text-subtle ${hasChildren ? '' : 'invisible'}`}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {open ? '▾' : '▸'}
        </button>
        <span className="truncate">📁 {node.name}</span>
        {node.asset_count > 0 && (
          <span className="ml-1 text-xs text-subtle">{node.asset_count}</span>
        )}
        <span className="ml-auto hidden shrink-0 items-center gap-1 pl-2 group-hover:flex">
          <IconButton title="New subfolder" onClick={() => onAddChild(node.id)}>
            +
          </IconButton>
          <IconButton
            title="Rename"
            onClick={() => {
              const name = window.prompt('Rename folder', node.name)?.trim()
              if (name && name !== node.name) onRename(node.id, name)
            }}
          >
            ✎
          </IconButton>
          <IconButton title="Delete" onClick={() => onDelete(node)}>
            ×
          </IconButton>
        </span>
      </div>
      {hasChildren && open && (
        <ul>
          {node.children.map((child) => (
            <FolderTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selection={selection}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onRename={onRename}
              onDelete={onDelete}
              dropTarget={dropTarget}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function IconButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="flex h-5 w-5 items-center justify-center rounded text-subtle transition hover:bg-surface-3 hover:text-fg"
    >
      {children}
    </button>
  )
}
