'use client'

import { useState } from 'react'
import type { Match, ScoringSystem } from '@/types'

interface TossData {
  toss_winner: 1 | 2
  toss_choice: 'serve' | 'receive' | 'side_left' | 'side_right'
  serving_team: 1 | 2
  side_entry1: 'near' | 'far'
  current_server_id: string | null
  scoring_system?: string
}

const SCORING_OPTIONS: { value: ScoringSystem; label: string; sub: string }[] = [
  { value: 'best_of_2_sets_super_tb', label: 'Dobles',       sub: '2 sets + Super TB a 10' },
  { value: '7_games_tb',              label: 'Individual',    sub: '7 juegos + TB' },
  { value: 'best_of_3_sets_tb',       label: '3 Sets',        sub: 'Mejor de 3 con TB' },
  { value: 'short_sets',              label: 'Sets cortos',   sub: '4 juegos + TB' },
  { value: 'pro_set',                 label: 'Pro Set',       sub: '1 set largo' },
]

function fullTeamName(entry: any): { line1: string; line2: string | null } {
  if (!entry) return { line1: 'Equipo', line2: null }
  const p1 = entry.player1 ? `${entry.player1.first_name} ${entry.player1.last_name}` : null
  const p2 = entry.player2 ? `${entry.player2.first_name} ${entry.player2.last_name}` : null
  return { line1: p1 ?? 'Equipo', line2: p2 }
}

export function TossScreen({ match, onComplete, saving }: {
  match: Match & { entry1: any; entry2: any; court?: any }
  onComplete: (data: TossData) => void
  saving: boolean
}) {
  const [step, setStep] = useState(1)
  const [tossWinner, setTossWinner] = useState<1 | 2 | null>(null)
  const [tossChoice, setTossChoice] = useState<TossData['toss_choice'] | null>(null)
  const [servingTeam, setServingTeam] = useState<1 | 2 | null>(null)
  const [sideEntry1, setSideEntry1] = useState<'near' | 'far' | null>(null)
  const [serverId, setServerId] = useState<string | null>(null)
  const [system, setSystem] = useState<ScoringSystem>(
    (match.scoring_system ?? 'best_of_2_sets_super_tb') as ScoringSystem
  )

  const isDoubles = (match as any).match_type !== 'singles'
  const hasSecondPlayer = isDoubles && (match.entry1 as any)?.player2
  const totalSteps = hasSecondPlayer ? 5 : 4
  const summaryStep = hasSecondPlayer ? 5 : 4

  const t1 = fullTeamName(match.entry1)
  const t2 = fullTeamName(match.entry2)

  function handleFinish() {
    if (!tossWinner || !tossChoice || !servingTeam || !sideEntry1) return
    onComplete({ toss_winner: tossWinner, toss_choice: tossChoice, serving_team: servingTeam, side_entry1: sideEntry1, current_server_id: serverId, scoring_system: system })
  }

  // Reusable team button
  function TeamButton({ team, onClick }: { team: 1 | 2; onClick: () => void }) {
    const name = team === 1 ? t1 : t2
    return (
      <button onClick={onClick}
        className="flex-1 min-h-[140px] bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl text-white transition-transform border-2 border-gray-700 hover:border-gray-500 flex flex-col items-center justify-center gap-1 px-4 py-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Equipo {team}</span>
        <p className="font-black font-score text-2xl text-center leading-tight">{name.line1}</p>
        {name.line2 && <p className="font-black font-score text-2xl text-center leading-tight">{name.line2}</p>}
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* Header */}
      <div className="bg-gray-900 px-6 py-5 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-red rounded-xl flex items-center justify-center text-white font-black text-xl font-score">
            {step}
          </div>
          <div>
            <p className="text-white font-bold text-lg">Sorteo · {match.round ?? 'Partido'}</p>
            <p className="text-gray-500 text-sm">{(match as any).court?.name ?? ''}</p>
          </div>
        </div>
        <div className="flex gap-1.5 mt-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${step >= i + 1 ? 'bg-brand-red' : 'bg-gray-800'}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">

        {/* Step 1 — Who wins toss */}
        {step === 1 && (
          <>
            <h2 className="text-white text-2xl font-black font-score text-center">¿Quién gana el sorteo?</h2>
            <div className="flex gap-4">
              <TeamButton team={1} onClick={() => { setTossWinner(1); setStep(2) }} />
              <TeamButton team={2} onClick={() => { setTossWinner(2); setStep(2) }} />
            </div>
          </>
        )}

        {/* Step 2 — Toss choice */}
        {step === 2 && (
          <>
            <h2 className="text-white text-2xl font-black font-score text-center">
              {tossWinner === 1 ? t1.line1 : t2.line1} elige:
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: 'serve',      label: 'SACAR',      sub: 'Elige saque' },
                { value: 'receive',    label: 'RESTAR',     sub: 'Elige recepción' },
                { value: 'side_left',  label: 'LADO IZQ.',  sub: 'Desde árbitro' },
                { value: 'side_right', label: 'LADO DER.',  sub: 'Desde árbitro' },
              ].map(({ value, label, sub }) => (
                <button key={value} onClick={() => {
                  setTossChoice(value as any)
                  if (value === 'serve') setServingTeam(tossWinner!)
                  else setServingTeam(tossWinner === 1 ? 2 : 1)
                  setStep(3)
                }}
                  className="h-28 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl text-white font-black font-score text-2xl transition-transform border border-gray-700 flex flex-col items-center justify-center gap-1">
                  {label}
                  <span className="text-gray-500 text-xs font-normal font-sans">{sub}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 3 — Side for entry1 */}
        {step === 3 && (
          <>
            <h2 className="text-white text-2xl font-black font-score text-center">¿Dónde juega el Equipo 1?</h2>
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-center mb-2">
              <p className="text-white font-bold">{t1.line1}</p>
              {t1.line2 && <p className="text-white font-bold">{t1.line2}</p>}
            </div>
            <p className="text-gray-500 text-center text-sm">Desde la posición del árbitro</p>
            <div className="flex gap-4">
              <button onClick={() => { setSideEntry1('near'); setStep(hasSecondPlayer ? 4 : summaryStep) }}
                className="flex-1 h-36 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl text-white font-black font-score text-2xl transition-transform border border-gray-700">
                ← IZQUIERDA
              </button>
              <button onClick={() => { setSideEntry1('far'); setStep(hasSecondPlayer ? 4 : summaryStep) }}
                className="flex-1 h-36 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl text-white font-black font-score text-2xl transition-transform border border-gray-700">
                DERECHA →
              </button>
            </div>
          </>
        )}

        {/* Step 4 — First server (doubles only) */}
        {step === 4 && hasSecondPlayer && (
          <>
            <h2 className="text-white text-2xl font-black font-score text-center">
              ¿Quién saca primero?
            </h2>
            <div className="bg-gray-900 rounded-2xl p-3 border border-gray-800 text-center mb-2">
              <p className="text-gray-400 text-xs uppercase tracking-widest">Equipo {servingTeam}</p>
            </div>
            {(() => {
              const entry = servingTeam === 1 ? match.entry1 as any : match.entry2 as any
              return (
                <div className="flex gap-4">
                  {[entry?.player1, entry?.player2].filter(Boolean).map((p: any) => (
                    <button key={p.id} onClick={() => { setServerId(p.id); setStep(summaryStep) }}
                      className="flex-1 min-h-[120px] bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl text-white font-bold text-xl transition-transform border border-gray-700 flex flex-col items-center justify-center px-4 gap-1">
                      <span className="text-2xl font-black font-score">{p.first_name}</span>
                      <span className="text-2xl font-black font-score">{p.last_name}</span>
                    </button>
                  ))}
                </div>
              )
            })()}
          </>
        )}

        {/* Summary step */}
        {step === summaryStep && (
          <>
            <h2 className="text-white text-2xl font-black font-score text-center">Confirmar y empezar</h2>

            {/* Summary card */}
            <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 space-y-3 text-base">
              <div className="flex justify-between items-start">
                <span className="text-gray-500 text-sm">Saque</span>
                <div className="text-right">
                  <p className="text-white font-bold">{servingTeam === 1 ? t1.line1 : t2.line1}</p>
                  {servingTeam === 1 && t1.line2 && <p className="text-gray-300 text-sm">{t1.line2}</p>}
                  {servingTeam === 2 && t2.line2 && <p className="text-gray-300 text-sm">{t2.line2}</p>}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">Eq.1 lado inicial</span>
                <span className="text-white font-bold">{sideEntry1 === 'near' ? 'Izquierda' : 'Derecha'}</span>
              </div>
              {serverId && (
                <div className="flex justify-between">
                  <span className="text-gray-500 text-sm">Primer sacador</span>
                  <span className="text-green-400 font-bold text-sm">✓ Asignado</span>
                </div>
              )}
            </div>

            {/* Scoring system selector */}
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-widest mb-3">Sistema de puntuación</p>
              <div className="grid grid-cols-1 gap-2">
                {SCORING_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setSystem(opt.value)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${system === opt.value ? 'bg-brand-red/20 border-brand-red text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'}`}>
                    <span className="font-bold">{opt.label}</span>
                    <span className="text-xs text-gray-400">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleFinish} disabled={saving}
              className="w-full h-20 disabled:opacity-50 rounded-2xl text-white font-black font-score text-2xl transition-colors active:scale-95"
              style={{ background: 'linear-gradient(90deg,#f31948,#fc6f43)' }}>
              {saving ? 'Iniciando...' : 'INICIAR PARTIDO →'}
            </button>

            <button onClick={() => setStep(1)} className="w-full text-gray-500 hover:text-gray-300 text-sm py-2">
              ← Empezar de nuevo
            </button>
          </>
        )}
      </div>
    </div>
  )
}
