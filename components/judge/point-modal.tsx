'use client'

import type { PointType, ShotDirection } from '@/types'

interface PointOption {
  pointType: PointType
  shotDirection: ShotDirection | null
  label: string
  emoji?: string
  color?: string
}

interface Props {
  winnerTeam: 1 | 2
  servingTeam: 1 | 2
  onSelect: (winnerTeam: 1 | 2, pointType: PointType, shotDirection: ShotDirection | null) => void
  onClose: () => void
}

export function PointModal({ winnerTeam, servingTeam, onSelect, onClose }: Props) {
  const isServer = winnerTeam === servingTeam

  // Case A: Server wins
  const serverWinOptions: PointOption[] = [
    { pointType: 'ace', shotDirection: 'serve', label: 'ACE', emoji: '🚀', color: 'bg-yellow-600 hover:bg-yellow-500' },
    { pointType: 'winner', shotDirection: 'forehand', label: 'Winner Derecha', emoji: '💥' },
    { pointType: 'winner', shotDirection: 'backhand', label: 'Winner Revés', emoji: '💥' },
    { pointType: 'winner', shotDirection: 'volley_fh', label: 'Winner Volea', emoji: '🏓' },
    { pointType: 'winner', shotDirection: 'overhead', label: 'Winner Remate', emoji: '⬆️' },
    { pointType: 'forced_error', shotDirection: null, label: 'Error Forzado (rival)', emoji: '↩️' },
  ]

  // Case B: Returner wins
  const returnerWinOptions: PointOption[] = [
    { pointType: 'serve_fault', shotDirection: null, label: 'Falta Red', emoji: '🕸️', color: 'bg-blue-700 hover:bg-blue-600' },
    { pointType: 'serve_fault', shotDirection: null, label: 'Falta Larga', emoji: '📏', color: 'bg-blue-700 hover:bg-blue-600' },
    { pointType: 'serve_fault', shotDirection: null, label: 'Falta de Pie', emoji: '👟', color: 'bg-blue-700 hover:bg-blue-600' },
    { pointType: 'winner', shotDirection: 'forehand', label: 'Winner Resto', emoji: '⚡', color: 'bg-green-700 hover:bg-green-600' },
    { pointType: 'winner', shotDirection: 'forehand', label: 'Winner Rally', emoji: '💥' },
    { pointType: 'unforced_error', shotDirection: 'forehand', label: 'Error No Forz. (Der)', emoji: '😬' },
    { pointType: 'unforced_error', shotDirection: 'backhand', label: 'Error No Forz. (Rev)', emoji: '😬' },
    { pointType: 'unforced_error', shotDirection: 'volley_fh', label: 'Error No Forz. (Volea)', emoji: '😬' },
    { pointType: 'forced_error', shotDirection: null, label: 'Error Forzado (sacador)', emoji: '↩️' },
  ]

  // Case C/D: Rally options
  const rallyOptions: PointOption[] = [
    { pointType: 'winner', shotDirection: 'forehand', label: 'Winner Derecha', emoji: '💥' },
    { pointType: 'winner', shotDirection: 'backhand', label: 'Winner Revés', emoji: '💥' },
    { pointType: 'winner', shotDirection: 'volley_fh', label: 'Winner Volea', emoji: '🏓' },
    { pointType: 'winner', shotDirection: 'overhead', label: 'Winner Remate', emoji: '⬆️' },
    { pointType: 'winner', shotDirection: 'lob', label: 'Winner Lob', emoji: '🌈' },
    { pointType: 'unforced_error', shotDirection: 'forehand', label: 'Error No F. (Der)', emoji: '😬' },
    { pointType: 'unforced_error', shotDirection: 'backhand', label: 'Error No F. (Rev)', emoji: '😬' },
    { pointType: 'unforced_error', shotDirection: 'volley_fh', label: 'Error No F. (Volea)', emoji: '😬' },
    { pointType: 'forced_error', shotDirection: null, label: 'Error Forzado', emoji: '↩️' },
  ]

  const primaryOptions = isServer ? serverWinOptions : returnerWinOptions

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Sheet */}
      <div className="relative bg-gray-900 rounded-t-3xl border-t border-gray-700 slide-up" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
        <div className="sticky top-0 bg-gray-900 px-5 pt-4 pb-3 border-b border-gray-800 z-10">
          <div className="flex items-center justify-between">
            <div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${winnerTeam === 1 ? 'bg-brand-red/20 text-brand-red' : 'bg-brand-pink/20 text-brand-pink'}`}>
                <span className={`w-2 h-2 rounded-full ${winnerTeam === 1 ? 'bg-brand-red' : 'bg-brand-pink'}`} />
                Punto Equipo {winnerTeam}
              </span>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:text-white">✕</button>
          </div>
          <p className="text-gray-500 text-xs mt-2">
            {isServer ? '⚡ Equipo sacador gana el punto' : '🔄 Equipo restador gana el punto'}
          </p>
        </div>

        <div className="p-4 space-y-2">
          {primaryOptions.map((opt, i) => (
            <button key={i} onClick={() => onSelect(winnerTeam, opt.pointType, opt.shotDirection)}
              className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl text-white font-medium text-left transition-colors active:scale-98 ${opt.color ?? 'bg-gray-800 hover:bg-gray-700'}`}>
              {opt.emoji && <span className="text-xl">{opt.emoji}</span>}
              <span>{opt.label}</span>
            </button>
          ))}

          {/* Rally section separator */}
          {isServer && (
            <>
              <div className="py-2 border-t border-gray-800">
                <p className="text-gray-600 text-xs text-center">— Rally alternativo —</p>
              </div>
              {rallyOptions.map((opt, i) => (
                <button key={`rally-${i}`} onClick={() => onSelect(winnerTeam, opt.pointType, opt.shotDirection)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-800 font-medium text-left text-sm transition-colors">
                  {opt.emoji && <span>{opt.emoji}</span>}
                  <span>{opt.label}</span>
                </button>
              ))}
            </>
          )}

          {/* Special actions */}
          <div className="pt-2 border-t border-gray-800">
            <p className="text-gray-600 text-xs mb-2">Acciones especiales</p>
            <button onClick={() => onSelect(winnerTeam, 'double_fault', null)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-900/30 hover:bg-orange-900/50 text-orange-300 font-medium text-left text-sm transition-colors">
              <span>⚠️</span> Doble falta
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
