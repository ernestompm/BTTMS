import type { GraphicKey } from '@/types/streaming'

export interface GraphicMeta {
  key: GraphicKey
  label: string
  group: 'presentation' | 'live' | 'stats' | 'utility'
  hotkey?: string               // keyboard shortcut in operator panel
  description: string
  zIndex: number
  exclusive?: GraphicKey[]      // other graphics that MUST hide when this shows
  defaultHoldMs?: number        // for auto-hide suggestion in operator
}

// Lower z => back, higher z => front.
// scorebug always on top so it remains visible alongside everything else.
export const GRAPHICS: Record<GraphicKey, GraphicMeta> = {
  tournament_intro: {
    key: 'tournament_intro',
    label: 'Intro torneo',
    group: 'presentation',
    hotkey: '1',
    description: 'Presentación del torneo (fullscreen)',
    zIndex: 400,
    exclusive: ['venue_card','match_presentation','coin_toss','results_grid','player_bio','stats_panel','big_scoreboard','scorebug','referee_lower_third'],
    defaultHoldMs: 8000,
  },
  venue_card: {
    key: 'venue_card',
    label: 'Venue',
    group: 'presentation',
    hotkey: '2',
    description: 'Presentación de sede (nombre + ciudad)',
    zIndex: 400,
    exclusive: ['tournament_intro','match_presentation','coin_toss','results_grid','player_bio','stats_panel','big_scoreboard','scorebug','referee_lower_third'],
    defaultHoldMs: 7000,
  },
  match_presentation: {
    key: 'match_presentation',
    label: 'Presentación partido',
    group: 'presentation',
    hotkey: '3',
    description: 'Presentación de jugadores (VS, fase)',
    zIndex: 400,
    exclusive: ['tournament_intro','venue_card','coin_toss','results_grid','player_bio','stats_panel','big_scoreboard','scorebug','referee_lower_third'],
    defaultHoldMs: 12000,
  },
  player_bio: {
    key: 'player_bio',
    label: 'Bio jugador',
    group: 'presentation',
    hotkey: '4',
    description: 'Biografía de un jugador (lateral)',
    zIndex: 600,
    defaultHoldMs: 10000,
  },
  coin_toss: {
    key: 'coin_toss',
    label: 'Sorteo',
    group: 'presentation',
    hotkey: '5',
    description: 'Ganador del sorteo y su elección',
    zIndex: 450,
    defaultHoldMs: 7000,
  },
  referee_lower_third: {
    key: 'referee_lower_third',
    label: 'Árbitro',
    group: 'utility',
    hotkey: '6',
    description: 'Lower third con el nombre del árbitro',
    zIndex: 800,
    defaultHoldMs: 8000,
  },
  scorebug: {
    key: 'scorebug',
    label: 'Scorebug',
    group: 'live',
    hotkey: 'Q',
    description: 'Marcador compacto (persistente en juego)',
    zIndex: 1000,
  },
  big_scoreboard: {
    key: 'big_scoreboard',
    label: 'Marcador grande',
    group: 'live',
    hotkey: 'W',
    description: 'Lower third con marcador completo, tiempos y patrocinador',
    zIndex: 850,
    defaultHoldMs: 10000,
  },
  stats_panel: {
    key: 'stats_panel',
    label: 'Estadísticas',
    group: 'stats',
    hotkey: 'E',
    description: 'Panel lateral de estadísticas (set o totales)',
    zIndex: 700,
    defaultHoldMs: 15000,
  },
  results_grid: {
    key: 'results_grid',
    label: 'Resultados',
    group: 'utility',
    hotkey: 'R',
    description: 'Cuadro de resultados con el partido seleccionado resaltado',
    zIndex: 500,
    defaultHoldMs: 12000,
  },
}

export const GRAPHIC_ORDER: GraphicKey[] = [
  'tournament_intro','venue_card','match_presentation','coin_toss','player_bio',
  'referee_lower_third','scorebug','big_scoreboard','stats_panel','results_grid',
]

export const GROUP_LABELS: Record<GraphicMeta['group'], string> = {
  presentation: 'Presentación',
  live:         'En vivo',
  stats:        'Estadísticas',
  utility:      'Utilidades',
}
