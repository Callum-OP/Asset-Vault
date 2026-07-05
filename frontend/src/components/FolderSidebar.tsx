import { useState } from 'react'

import type { FolderNode } from '../api/folderTree'
import type { FolderWithCount } from '../api/types'

/** What the gallery is currently showing. */
export type FolderSelection = 'all' | 'unfiled' | 'public' | number

interface FolderSidebarProps {
  tree: FolderNode[]
  selection: FolderSelection
  onSelect: (selection: FolderSelection) => void
  onCreate: (name: string, parentId: number | null) => void
  onRename: (id: number, name: string) => void
  onDelete: (folder: FolderWithCount) => void
}

const ROW_BASE =
  'group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm cursor-pointer select-none transition'
const ROW_ACTIVE = 'bg-accent/15 text-accent'
const ROW_IDLE = 'text-muted hover:bg-surface-2 hover:text-fg'

export function FolderSidebar({
  tree,
  selection,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: FolderSidebarProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

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

  return (
    <nav className="w-56 shrink-0 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-subtle">Folders</h2>
        <button
          type="button"
          onClick={() => promptCreate(null)}
          className="rounded-md border border-border px-2 py-0.5 text-xs text-muted transition hover:border-border-strong hover:text-fg"
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
            className={`${ROW_BASE} ${selection === 'unfiled' ? ROW_ACTIVE : ROW_IDLE}`}
            onClick={() => onSelect('unfiled')}
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
}: FolderTreeNodeProps) {
  const hasChildren = node.children.length > 0
  const open = expanded.has(node.id)
  const active = selection === node.id

  return (
    <li>
      <div
        className={`${ROW_BASE} ${active ? ROW_ACTIVE : ROW_IDLE}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => onSelect(node.id)}
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
