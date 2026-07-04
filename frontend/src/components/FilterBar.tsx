import type { AssetType, Category, Tag } from '../api/types'
import { RatingStars } from './RatingStars'

/** Gallery filter state, mirrored to the backend's list query params. */
export interface Filters {
  q: string
  type: AssetType | ''
  category: string
  tags: string[]
  color: string
  minRating: number
  sort: string
  order: 'asc' | 'desc'
}

export const EMPTY_FILTERS: Filters = {
  q: '',
  type: '',
  category: '',
  tags: [],
  color: '',
  minRating: 0,
  sort: 'created_at',
  order: 'desc',
}

/** Count of the "narrowing" filters set (ignores sort/order). */
export function activeFilterCount(f: Filters): number {
  return (
    (f.q.trim() ? 1 : 0) +
    (f.type ? 1 : 0) +
    (f.category ? 1 : 0) +
    f.tags.length +
    (f.color ? 1 : 0) +
    (f.minRating > 0 ? 1 : 0)
  )
}

const TYPE_OPTIONS: { value: AssetType; label: string }[] = [
  { value: 'image', label: 'Image' },
  { value: 'gif', label: 'GIF' },
  { value: 'video', label: 'Video' },
  { value: 'model_3d', label: '3D Model' },
  { value: 'texture', label: 'Texture' },
  { value: 'other', label: 'Other' },
]

// Named color buckets, matching the backend's classifier in services/color.py.
const COLOR_OPTIONS: { name: string; hex: string }[] = [
  { name: 'red', hex: '#e23b3b' },
  { name: 'orange', hex: '#e8862b' },
  { name: 'yellow', hex: '#edd11f' },
  { name: 'green', hex: '#3fae52' },
  { name: 'cyan', hex: '#28c3d4' },
  { name: 'blue', hex: '#3b6fe2' },
  { name: 'purple', hex: '#8b3be2' },
  { name: 'pink', hex: '#e23bb0' },
  { name: 'brown', hex: '#8a5a2b' },
  { name: 'black', hex: '#1b1b1b' },
  { name: 'white', hex: '#f5f5f5' },
  { name: 'gray', hex: '#9aa0a6' },
]

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'created_at', label: 'Date added' },
  { value: 'original_filename', label: 'Name' },
  { value: 'rating', label: 'Rating' },
  { value: 'file_size', label: 'Size' },
]

interface FilterBarProps {
  filters: Filters
  onChange: (patch: Partial<Filters>) => void
  onClear: () => void
  categories: Category[]
  tags: Tag[]
}

export function FilterBar({ filters, onChange, onClear, categories, tags }: FilterBarProps) {
  const active = activeFilterCount(filters)

  const toggleTag = (name: string) =>
    onChange({
      tags: filters.tags.includes(name)
        ? filters.tags.filter((t) => t !== name)
        : [...filters.tags, name],
    })

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      {/* Search + sort + clear */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={filters.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Search name & description…"
          className="min-w-48 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        />
        <select
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value })}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          aria-label="Sort by"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              Sort: {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onChange({ order: filters.order === 'asc' ? 'desc' : 'asc' })}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm hover:bg-gray-100"
          title={filters.order === 'asc' ? 'Ascending' : 'Descending'}
          aria-label="Toggle sort direction"
        >
          {filters.order === 'asc' ? '↑' : '↓'}
        </button>
        {active > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Clear ({active})
          </button>
        )}
      </div>

      {/* Type toggle */}
      <div className="flex flex-wrap gap-1">
        <TypeChip label="All" selected={filters.type === ''} onClick={() => onChange({ type: '' })} />
        {TYPE_OPTIONS.map((t) => (
          <TypeChip
            key={t.value}
            label={t.label}
            selected={filters.type === t.value}
            onClick={() => onChange({ type: filters.type === t.value ? '' : t.value })}
          />
        ))}
      </div>

      {/* Category + rating + color */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Category
          <select
            value={filters.category}
            onChange={(e) => onChange({ category: e.target.value })}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Min rating</span>
          <RatingStars value={filters.minRating || null} onChange={(v) => onChange({ minRating: v ?? 0 })} />
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Color</span>
          <div className="flex flex-wrap gap-1">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.name}
                type="button"
                title={c.name}
                onClick={() => onChange({ color: filters.color === c.name ? '' : c.name })}
                className={`h-6 w-6 rounded-full border transition ${
                  filters.color === c.name
                    ? 'ring-2 ring-violet-500 ring-offset-1'
                    : 'border-black/10 hover:scale-110'
                }`}
                style={{ backgroundColor: c.hex }}
                aria-label={`Filter by ${c.name}`}
                aria-pressed={filters.color === c.name}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Tag chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 border-t border-gray-100 pt-3">
          {tags.map((tag) => {
            const on = filters.tags.includes(tag.name)
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.name)}
                className={`rounded-full px-2 py-0.5 text-xs ${
                  on
                    ? 'bg-violet-600 text-white'
                    : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                }`}
              >
                {tag.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TypeChip({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm ${
        selected ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  )
}
