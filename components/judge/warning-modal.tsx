'use client'

import { useState } from 'react'
import type { WarningType, PenaltyLevel, MatchWarnings } from '@/types'

interface Props {
  warnings: MatchWarnings
  team1Name: string
  team2Name: string
  onConfirm: (team: 1 | 2, type: WarningType) => void
  onClose: () => void
}

interface ViolationOption {
  type: WarningType
  label: string
  sublabel: string
  color: string
}

const VIOLATIONS: ViolationOption[] = [
  { type: 'conduct',        label: 'CONDUCTA',      sublabel: 'Antideportiva',     color: 'bg-red-800 hover:bg-red-700' },
  { type: 'time',           label: 'TIEMPO',        sublabel: 'Violación de tiempo (20s)', color: 'bg-orange-700 hover:bg-orange-600' },
  { type: 'coaching',       label: 'COACHING',      sublabel: 'Descalificación directa',   color: 'bg-purple-800 hover:bg-purple-700' },
  { type: 'equipment_abuse',label: 'MATERIAL',      sublabel: 'Abuso de raqueta/equipo',  color: 'bg-yellow-700 hover:bg-yellow-600' },
  { type: 'obscenity',      label: 'LENGUAJE',      sublabel: 'Ofensivo / Obscenidad',    color: 'bg-pink-800 hover:bg-pink-700' },
  { type: 'other',          label: 'OTRA',          sublabel: 'Otra infracción',           color: 'bg-gray-700 hover:bg-gray-600' },
]

const PENALTY_LABELS: Record<PenaltyLevel, string> = {
  warning:       'ADVERTENCIA',
  point_penalty: 'PENALIZACIÓN: PUNTO',
  game_penalty:  'PENALIZACIÓN: JUEGO',
  default:       'DESCALIFICACIÓN',
}

const PENALTY_COLORS: Record<PenaltyLevel, string> = {
  warning:       'text-yellow-400 bg-yellow-900/30 border-yellow-700',
  point_penalty: 'text-orange-400 bg-orange-900/30 border-orange-700',
  game_penalty:  'text-red-400 bg-red-900/30 border-red-700',
  default:       'text-red-300 bg-red-950 border-red-600',
}

function nextPenalty(existingCount: number, type: WarningType): PenaltyLevel {
  if (type === 'coaching') return 'default'
  const levels: PenaltyLevel[] = ['warning', 'point_penalty', 'game_penalty', 'default']
  return levels[Math.min(existingCount, 3)]
}

export function WarningModal({ warnings, team1Name, team2Name, onConfirm, onClose }: Props) {
  const [selectedTeam, setSelectedTeam] = useState<1 | 2 | null>(null)
  const [selectedType, setSelectedType] = useState<WarningType | null>(null)

  const count = selectedTeam === 1 ? warnings.t1.length : selectedTeam === 2 ? warnings.t2.length : 0
  const penalty = selectedType ? nextPenalty(count, selectedType) : null

  function handleConfirm() {
    if (!selectedTeam || !selectedType) return
    onConfirm(selectedTeam, selectedType)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col justify-end md:justify-center p-4">
      <div className="bg-gray-900 rounded-3xl border border-gray-700 overflow-hidden max-w-lg w-full mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <p className="text-white font-black font-score text-xl">SANCIÓN</p>
          <button onClick={onClose}
            className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <span className="text-xl font-black">✕</span>
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Team selector */}
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Equipo infractor</p>
            <div className="grid grid-cols-2 gap-3">
              {([1, 2] as const).map((t) => (
                <button key={t} onClick={() => setSelectedTeam(t)}
                  className={`py-3 px-4 rounded-xl font-bold text-sm transition-colors border ${selectedTeam === t ? 'bg-brand-red border-brand-red text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'}`}>
                  <span className="block text-xs text-gray-400 mb-0.5">Equipo {t}</span>
                  {t === 1 ? team1Name : team2Name}
                </button>
              ))}
            </div>
          </div>

          {/* Penalty preview */}
          {selectedTeam && (
            <div className={`rounded-xl px-4 py-3 border text-sm font-bold ${penalty ? PENALTY_COLORS[penalty] : 'text-gray-500 bg-gray-800 border-gray-700'}`}>
              {penalty
                ? <>Penalización: {PENALTY_LABELS[penalty]} <span className="font-normal opacity-70">({count + 1}ª infracción)</span></>
                : 'Selecciona el tipo de infracción'
              }
            </div>
          )}

          {/* Violation type grid */}
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Tipo de infracción</p>
            <div className="grid grid-cols-2 gap-2">
              {VIOLATIONS.map((v) => (
                <button key={v.type} onClick={() => setSelectedType(v.type)}
                  className={`${v.color} rounded-xl py-5 px-4 text-left transition-all border-2 min-h-[80px] flex flex-col justify-center ${selectedType === v.type ? 'border-white' : 'border-transparent'}`}>
                  <p className="text-white font-black text-base font-score">{v.label}</p>
                  <p className="text-gray-300 text-xs mt-1 leading-tight">{v.sublabel}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold transition-colors">
              Cancelar
            </button>
            <button onClick={handleConfirm} disabled={!selectedTeam || !selectedType}
              className="flex-1 py-3 rounded-xl font-black font-score transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-white"
              style={{ background: selectedTeam && selectedType ? 'linear-gradient(90deg,#f31948,#fc6f43)' : undefined }}>
              CONFIRMAR
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
