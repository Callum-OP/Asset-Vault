interface Props {
  value: number | null
  onChange?: (value: number | null) => void
}

/** Five-star rating. Clicking the current rating again clears it. */
export function RatingStars({ value, onChange }: Props) {
  const current = value ?? 0
  const readOnly = !onChange

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
          onClick={() => onChange?.(current === star ? null : star)}
          className={`text-xl leading-none ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${
            star <= current ? 'text-yellow-400' : 'text-gray-300'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  )
}
