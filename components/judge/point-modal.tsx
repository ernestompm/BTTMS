'use client'

import { useEffect, useRef, useState } from 'react'
import type { PointType, ShotDirection } from '@/types'

interface Option {
  pointType: PointType
  shotDirection: ShotDirection | null
  label: string
  color: string
}

interface Props {
  winnerTeam: 1 | 2
  servingTeam: 1 | 2
  onSelect: (winnerTeam: 1 | 2, pointType: PointType, shotDirection: ShotDirection | null) => void
  onClose: () => void
}

const AUTO_MS = 5000

// 4 opciones cuando gana el SACADOR
const SERVER_OPTS: Option[] = [
  { pointType: 'ace',            shotDirection: 'serve', label: 'ACE',              color: 'bg-yellow-500' },
  { pointType: 'winner',         shotDirection: null,    label: 'WINNER',           color: 'bg-green-600' },
  { pointType: 'forced_error',   shotDirection: null,    label: 'ERROR FORZADO',    color: 'bg-orange-600' },
  { pointType: 'unforced_error', shotDirection: null,    label: 'ERROR NO FORZADO', color: 'bg-red-700' },
]

// 4 opciones cuando gana el RESTADOR
const RETURNER_OPTS: Option[] = [
  { pointType: 'double_fault',   shotDirection: null,    label: 'DOBLE FALTA',      color: 'bg-red-600' },
  { pointType: 'winner',         shotDirection: null,    label: 'WINNER',           color: 'bg-green-600' },
  { pointType: 'forced_error',   shotDirection: null,    label: 'ERROR FORZADO',    color: 'bg-orange-600' },
  { pointType: 'unforced_error', shotDirection: null,    label: 'ERROR NO FORZADO', color: 'bg-red-700' },
]

export function PointModal({ winnerTeam, servingTeam, onSelect }: Props) {
  const isServer = winnerTeam === servingTeam
  const options = isServer ? SERVER_OPTS : RETURNER_OPTS
  const [remaining, setRemaining] = useState(AUTO_MS)
  const doneRef = useRef(false)

  function finish(pointType: PointType, shotDirection: ShotDirection | null) {
    if (doneRef.current) return
    doneRef.current = true
    onSelect(winnerTeam, pointType, shotDirection)
  }

  // Auto-skip timer → guarda el punto como 'winner' genérico
  useEffect(() => {
    const start = Date.now()
    const tick = setInterval(() => {
      const rem = Math.max(0, AUTO_MS - (Date.now() - start))
      setRemaining(rem)
      if (rem === 0) {
        clearInterval(tick)
        finish('winner', null)
      }
    }, 50)
    return () => clearInterval(tick)
  }, [])

  const progress = (remaining / AUTO_MS) * 100
  const accent = winnerTeam === 1 ? 'text-brand-red' : 'text-brand-pink'

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex flex-col justify-center p-4">
      <div className="bg-gray-900 rounded-3xl border border-gray-700 overflow-hidden max-w-3xl w-full mx-auto">
        {/* Countdown bar */}
        <div className="h-3 bg-gray-800">
          <div className="h-full bg-brand-orange transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }} />
        </div>

        {/* Header con X grande */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
          <div>
            <p className={`text-xs uppercase tracking-widest ${accent} font-bold`}>Equipo {winnerTeam} gana punto</p>
            <p className="text-white text-3xl font-black font-score mt-1">
              {isServer ? 'SACADOR gana' : 'RESTADOR gana'}
            </p>
          </div>
          <button onClick={() => finish('winner', null)}
            aria-label="Saltar stats"
            className="w-20 h-20 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl flex items-center justify-center text-white border border-gray-700 transition-transform">
            <span className="text-5xl font-black leading-none">✕</span>
          </button>
        </div>

        {/* 4 botones gigantes en grid 2x2 */}
        <div className="p-4 grid grid-cols-2 gap-4">
          {options.map((opt, i) => (
            <button key={i}
              onClick={() => finish(opt.pointType, opt.shotDirection)}
              className={`${opt.color} hover:brightness-110 active:scale-95 rounded-2xl h-36 md:h-40 flex items-center justify-center text-white font-black font-score text-2xl md:text-3xl text-center px-4 transition-all shadow-lg leading-tight`}>
              {opt.label}
            </button>
          ))}
        </div>

        <p className="text-center text-gray-600 text-sm pb-4">
          Se cierra en {Math.ceil(remaining / 1000)}s · Pulsa ✕ para omitir
        </p>
      </div>
    </div>
  )
}
