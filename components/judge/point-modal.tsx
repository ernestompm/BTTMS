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
  onClassify: (pointType: PointType, shotDirection: ShotDirection | null) => void
  onDismiss: () => void
}

const AUTO_MS = 6000

// Sacador gana el punto (5 opciones)
const SERVER_OPTS: Option[] = [
  { pointType: 'ace',            shotDirection: 'serve', label: 'ACE',              color: 'bg-yellow-500' },
  { pointType: 'winner',         shotDirection: null,    label: 'WINNER',           color: 'bg-green-600' },
  { pointType: 'forced_error',   shotDirection: null,    label: 'ERROR FORZADO',    color: 'bg-orange-600' },
  { pointType: 'unforced_error', shotDirection: null,    label: 'ERROR NO FORZADO', color: 'bg-red-700' },
  { pointType: 'forbidden_zone', shotDirection: null,    label: 'ZONA PROHIBIDA',   color: 'bg-purple-700' },
]

// Restador gana el punto (6 opciones)
const RETURNER_OPTS: Option[] = [
  { pointType: 'serve_fault',    shotDirection: null,    label: 'FALTA DE SAQUE',   color: 'bg-red-600' },
  { pointType: 'winner',         shotDirection: null,    label: 'WINNER',           color: 'bg-green-600' },
  { pointType: 'forced_error',   shotDirection: null,    label: 'ERROR FORZADO',    color: 'bg-orange-600' },
  { pointType: 'unforced_error', shotDirection: null,    label: 'ERROR NO FORZADO', color: 'bg-red-700' },
  { pointType: 'forbidden_zone', shotDirection: null,    label: 'ZONA PROHIBIDA',   color: 'bg-purple-700' },
  { pointType: 'foot_fault',     shotDirection: null,    label: 'FALTA DE PIE',     color: 'bg-amber-600' },
]

// The score is already registered. This panel is a non-blocking refinement for stats.
export function PointModal({ winnerTeam, servingTeam, onClassify, onDismiss }: Props) {
  const isServer = winnerTeam === servingTeam
  const options = isServer ? SERVER_OPTS : RETURNER_OPTS
  const [remaining, setRemaining] = useState(AUTO_MS)
  const doneRef = useRef(false)

  function finish(pointType: PointType, shotDirection: ShotDirection | null) {
    if (doneRef.current) return
    doneRef.current = true
    onClassify(pointType, shotDirection)
  }

  function dismiss() {
    if (doneRef.current) return
    doneRef.current = true
    onDismiss()
  }

  useEffect(() => {
    const start = Date.now()
    const tick = setInterval(() => {
      const rem = Math.max(0, AUTO_MS - (Date.now() - start))
      setRemaining(rem)
      if (rem === 0) { clearInterval(tick); dismiss() }
    }, 50)
    return () => clearInterval(tick)
  }, [])

  const progress = (remaining / AUTO_MS) * 100
  const accent = winnerTeam === 1 ? 'text-brand-red' : 'text-brand-pink'

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex flex-col justify-end p-4">
      <div className="bg-gray-900 rounded-3xl border border-gray-700 overflow-hidden max-w-lg w-full mx-auto">

        {/* Countdown bar */}
        <div className="h-1 bg-gray-800">
          <div className="h-full bg-brand-orange transition-all duration-100 ease-linear" style={{ width: `${progress}%` }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div>
            <p className={`text-xs uppercase tracking-widest ${accent} font-bold`}>
              Punto registrado · Equipo {winnerTeam}
            </p>
            <p className="text-white text-lg font-black font-score mt-0.5">
              {isServer ? 'SACADOR gana' : 'RESTADOR gana'} — clasificar punto
            </p>
          </div>
          <button onClick={dismiss} aria-label="Omitir"
            className="w-12 h-12 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-xl flex items-center justify-center text-white border border-gray-700 transition-transform">
            <span className="text-2xl font-black leading-none">✕</span>
          </button>
        </div>

        {/* Options */}
        <div className="p-3 grid grid-cols-2 gap-2">
          {options.map((opt, i) => {
            const isLastOdd = options.length % 2 !== 0 && i === options.length - 1
            return (
              <button key={i}
                onClick={() => finish(opt.pointType, opt.shotDirection)}
                className={`${opt.color} hover:brightness-110 active:scale-95 rounded-2xl h-16 flex items-center justify-center text-white font-black font-score text-lg text-center px-3 transition-all shadow-lg leading-tight ${isLastOdd ? 'col-span-2' : ''}`}>
                {opt.label}
              </button>
            )
          })}
        </div>

        <p className="text-center text-gray-600 text-xs pb-2.5">
          {Math.ceil(remaining / 1000)}s · El punto ya está registrado
        </p>
      </div>
    </div>
  )
}
