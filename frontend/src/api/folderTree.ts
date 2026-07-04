import type { FolderWithCount } from './types'

export interface FolderNode extends FolderWithCount {
  children: FolderNode[]
}

/**
 * Nest a flat list of folders into a tree by `parent_id`, sorted by name at
 * each level. Folders whose parent is missing (shouldn't happen) are treated
 * as roots so nothing silently disappears.
 */
export function buildFolderTree(folders: FolderWithCount[]): FolderNode[] {
  const byId = new Map<number, FolderNode>()
  for (const f of folders) byId.set(f.id, { ...f, children: [] })

  const roots: FolderNode[] = []
  for (const node of byId.values()) {
    const parent = node.parent_id != null ? byId.get(node.parent_id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const sort = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name))
    nodes.forEach((n) => sort(n.children))
  }
  sort(roots)
  return roots
}

/** Ancestor chain (root → folder) for a folder id, for breadcrumbs. */
export function folderPath(
  folders: FolderWithCount[],
  folderId: number,
): FolderWithCount[] {
  const byId = new Map<number, FolderWithCount>()
  for (const f of folders) byId.set(f.id, f)

  const path: FolderWithCount[] = []
  let current = byId.get(folderId)
  while (current) {
    path.unshift(current)
    current = current.parent_id != null ? byId.get(current.parent_id) : undefined
  }
  return path
}
