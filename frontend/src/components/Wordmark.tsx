/** The LocalAsset Vault brand lockup: an amber diamond mark + wordmark. */
export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const lg = size === 'lg'
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`grid place-items-center rounded-md bg-accent text-accent-contrast shadow-[0_4px_16px_-4px_rgba(244,185,66,0.7)] ${
          lg ? 'h-9 w-9' : 'h-7 w-7'
        }`}
      >
        <svg viewBox="0 0 24 24" className={lg ? 'h-5 w-5' : 'h-4 w-4'} fill="currentColor" aria-hidden>
          {/* Faceted gem — nods to "asset vault". */}
          <path d="M12 2 4 9l8 13 8-13-8-7Zm0 2.6L17.4 9 12 18 6.6 9 12 4.6Z" />
        </svg>
      </span>
      <span className={`font-semibold tracking-tight ${lg ? 'text-2xl' : 'text-lg'}`}>
        <span className="text-muted">LocalAsset</span> <span className="text-accent">Vault</span>
      </span>
    </span>
  )
}
