/**
 * Helpers de formato compartidos. Antes estaban repetidos en
 * múltiples pages (teamName en 7 archivos, fechas con opciones
 * distintas en cada vista, etc.).
 */

// ── Nombres de equipos / jugadores ────────────────────────────────────────

interface PlayerLike {
  first_name?: string | null
  last_name?: string | null
}

interface EntryLike {
  player1?: PlayerLike | null
  player2?: PlayerLike | null
}

/** "Carlos García" o "Carlos García / Antonio Jiménez" según haya pareja. */
export function teamName(entry: EntryLike | null | undefined, fallback = 'Por determinar'): string {
  if (!entry) return fallback
  const p1 = entry.player1 ? `${entry.player1.first_name ?? ''} ${entry.player1.last_name ?? ''}`.trim() : ''
  const p2 = entry.player2 ? `${entry.player2.first_name ?? ''} ${entry.player2.last_name ?? ''}`.trim() : ''
  if (p1 && p2) return `${p1} / ${p2}`
  return p1 || p2 || fallback
}

/** Versión compacta con iniciales: "C. García / A. Jiménez". */
export function teamShortName(entry: EntryLike | null | undefined, fallback = '—'): string {
  if (!entry) return fallback
  function shortOne(p: PlayerLike | null | undefined): string {
    if (!p) return ''
    const initial = (p.first_name ?? '').charAt(0).toUpperCase()
    const last = (p.last_name ?? '').toUpperCase()
    return initial ? `${initial}.${last}` : last
  }
  const p1 = shortOne(entry.player1)
  const p2 = shortOne(entry.player2)
  if (p1 && p2) return `${p1} / ${p2}`
  return p1 || p2 || fallback
}

/** Solo apellidos (para scorebug y marcadores compactos). */
export function teamLastName(entry: EntryLike | null | undefined, fallback = '—'): { main: string, partner: string | null } {
  if (!entry) return { main: fallback, partner: null }
  return {
    main: (entry.player1?.last_name ?? fallback).toUpperCase(),
    partner: entry.player2?.last_name ? entry.player2.last_name.toUpperCase() : null,
  }
}

// ── Fechas ─────────────────────────────────────────────────────────────────

/** Solo hora: "18:30". */
export function fmtTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

/** Solo fecha corta: "12 jun". */
export function fmtDateShort(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

/** Fecha + hora: "12 jun · 18:30". */
export function fmtDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (isNaN(d.getTime())) return '—'
  return `${fmtDateShort(d)} · ${fmtTime(d)}`
}

/** Fecha larga: "viernes 12 de junio". */
export function fmtDateLong(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ── Duraciones ─────────────────────────────────────────────────────────────

/** Segundos → "1:23" (mm:ss) o "1:23:45" (hh:mm:ss). */
export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

/** Millisegundos → "1h 23m" o "23m" si <1h. */
export function fmtElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m`
}
