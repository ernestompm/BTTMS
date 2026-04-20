'use client'

export function FlagImg({ nationality, className }: { nationality: string; className?: string }) {
  return (
    <img
      src={`/Flags/${nationality.toUpperCase()}.jpg`}
      alt={nationality}
      className={className ?? 'w-5 h-3.5 object-cover rounded-sm'}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )
}
