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

// Sacador gana el punto (5 opciones)
const SERVER_OPTS: Option[] = [
  { pointType: 'ace',            shotDirection: 'serve', label: 'ACE',              color: 'bg-yellow-500' },
  { pointType: 'winner',         shotDirection: null,    label: 'WINNER',           color: 'bg-green-600' },
  { pointType: 'forced_error',   shotDirection: null,    label: 'ERROR FORZADO',    color: 'bg-orange-600' },
  { pointType: 'unforced_error', shotDirection: null,    label: 'ERROR NO FORZADO', color: 'bg-red-700' },
  { pointType: 'forbidden_zone', shotDirection: null,    label: 'ZONA PROHIBIDA',   color: 'bg-purple-700' },
]

// Restador gana el punto (6 opciones — 1 saque sin segundo servicio RFET 2026 art.8)
const RETURNER_OPTS: Option[] = [
  { pointType: 'serve_fault',    shotDirection: null,    label: 'FALTA DE SAQUE',   color: 'bg-red-600' },
  { pointType: 'winner',         shotDirection: null,    label: 'WINNER',           color: 'bg-green-600' },
  { pointType: 'forced_error',   shotDirection: null,    label: 'ERROR FORZADO',    color: 'bg-orange-600' },
  { pointType: 'unforced_error', shotDirection: null,    label: 'ERROR NO FORZADO', color: 'bg-red-700' },
  { pointType: 'forbidden_zone', shotDirection: null,    label: 'ZONA PROHIBIDA',   color: 'bg-purple-700' },
  { pointType: 'foot_fault',     shotDirection: null,    label: 'FALTA DE PIE',     color: 'bg-amber-600' },
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

  useEffect(() => {
    const start = Date.now()
    const tick = setInterval(() => {
      const rem = Math.max(0, AUTO_MS - (Date.now() - start))
      setRemaining(rem)
      if (rem === 0) { clearInterval(tick); finish('winner', null) }
    }, 50)
    return () => clearInterval(tick)
  }, [])

  const progress = (remaining / AUTO_MS) * 100
  const accent = winnerTeam === 1 ? 'text-brand-red' : 'text-brand-pink'
  const isReturner = !isServer

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col justify-center p-4">
      <div className="bg-gray-900 rounded-3xl border border-gray-700 overflow-hidden max-w-lg w-full mx-auto">

        {/* Countdown bar */}
        <div className="h-1.5 bg-gray-800">
          <div className="h-full bg-brand-orange transition-all duration-100 ease-linear" style={{ width: `${progress}%` }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <p className={`text-xs uppercase tracking-widest ${accent} font-bold`}>
              Equipo {winnerTeam} · punto
            </p>
            <p className="text-white text-2xl font-black font-score mt-0.5">
              {isServer ? 'SACADOR gana' : 'RESTADOR gana'}
            </p>
          </div>
          <button onClick={() => finish('winner', null)} aria-label="Saltar"
            className="w-14 h-14 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-xl flex items-center justify-center text-white border border-gray-700 transition-transform">
            <span className="text-3xl font-black leading-none">✕</span>
          </button>
        </div>

        {/* Opciones — 2 columnas, última fila completa si impar */}
        <div className="p-4 grid grid-cols-2 gap-3">
          {options.map((opt, i) => {
            const isLastOdd = options.length % 2 !== 0 && i === options.length - 1
            return (
              <button key={i}
                onClick={() => finish(opt.pointType, opt.shotDirection)}
                className={`${opt.color} hover:brightness-110 active:scale-95 rounded-2xl h-24 flex items-center justify-center text-white font-black font-score text-xl text-center px-3 transition-all shadow-lg leading-tight ${isLastOdd ? 'col-span-2' : ''}`}>
                {opt.label}
              </button>
            )
          })}
        </div>

        <p className="text-center text-gray-600 text-xs pb-3">
          {Math.ceil(remaining / 1000)}s · Pulsa ✕ para omitir
        </p>
      </div>
    </div>
  )
}
