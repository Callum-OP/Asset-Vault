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
  owner_id: number
  is_public: boolean
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
  category_id: number | null
  category: Category | null
  folder_id: number | null
  folder: Folder | null
  tags: Tag[]
  created_at: string
  updated_at: string
  owner_name: string | null
  like_count: number
  comment_count: number
  liked_by_me: boolean
}

export interface Comment {
  id: number
  asset_id: number
  user_id: number
  parent_id: number | null
  author_name: string
  body: string
  created_at: string
}

export interface LikeStatus {
  liked_by_me: boolean
  like_count: number
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
  is_guest: boolean
  created_at: string
}

export interface Token {
  access_token: string
  token_type: string
}
