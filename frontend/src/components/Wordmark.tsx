/** The LocalAsset Vault brand lockup: a candy gem mark + shimmering wordmark. */
export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const lg = size === 'lg'
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`grid place-items-center rounded-2xl bg-gradient-to-br from-accent to-grape text-white shadow-[0_8px_22px_-6px_rgba(255,92,157,0.8)] ${
          lg ? 'h-11 w-11' : 'h-9 w-9'
        }`}
      >
        <svg viewBox="0 0 24 24" className={lg ? 'h-6 w-6' : 'h-5 w-5'} fill="currentColor" aria-hidden>
          {/* Faceted gem — nods to "asset vault". */}
          <path d="M12 2 4 9l8 13 8-13-8-7Zm0 2.6L17.4 9 12 18 6.6 9 12 4.6Z" />
        </svg>
      </span>
      <span className={`font-extrabold tracking-tight ${lg ? 'text-3xl' : 'text-xl'}`}>
        <span className="text-fg">LocalAsset</span> <span className="shimmer-text">Vault</span>
      </span>
    </span>
  )
}
