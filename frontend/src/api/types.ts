export type AssetType = 'image' | 'gif' | 'video' | 'model_3d' | 'texture' | 'other'

export interface Tag {
  id: number
  name: string
}

export interface Category {
  id: number
  name: string
}

export interface Folder {
  id: number
  name: string
  parent_id: number | null
}

export interface FolderWithCount extends Folder {
  asset_count: number
}

export interface Asset {
  id: number
  original_filename: string
  stored_filename: string
  file_path: string
  file_size: number
  mime_type: string
  asset_type: AssetType
  thumbnail_path: string | null
  width: number | null
  height: number | null
  dominant_colors: string[] | null
  description: string | null
  source_url: string | null
  rating: number | null
  category_id: number | null
  category: Category | null
  folder_id: number | null
  folder: Folder | null
  tags: Tag[]
  created_at: string
  updated_at: string
}

export interface AssetList {
  items: Asset[]
  total: number
  limit: number
  offset: number
}

export interface User {
  id: number
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface Token {
  access_token: string
  token_type: string
}
