'use client'

import { useState } from 'react'
import type { Match } from '@/types'

interface TossData {
  toss_winner: 1 | 2
  toss_choice: 'serve' | 'receive' | 'side_left' | 'side_right'
  serving_team: 1 | 2
  side_entry1: 'near' | 'far'  // near = left (desde árbitro), far = right
  current_server_id: string | null
  scoring_system?: string  // inherited from match, not selected here
}

export function TossScreen({ match, onComplete, saving }: {
  match: Match & { entry1: any; entry2: any }
  onComplete: (data: TossData) => void
  saving: boolean
}) {
  const [step, setStep] = useState(1)
  const [tossWinner, setTossWinner] = useState<1 | 2 | null>(null)
  const [tossChoice, setTossChoice] = useState<TossData['toss_choice'] | null>(null)
  const [servingTeam, setServingTeam] = useState<1 | 2 | null>(null)
  const [sideEntry1, setSideEntry1] = useState<'near' | 'far' | null>(null)
  const [serverId, setServerId] = useState<string | null>(null)

  const isDoubles = (match as any).match_type === 'doubles'
  const hasSecondPlayer = isDoubles && (match.entry1 as any)?.player2

  function team1Name(): string {
    const e = match.entry1 as any
    if (!e) return 'Equipo 1'
    const p1 = e.player1 ? `${e.player1.first_name} ${e.player1.last_name}` : ''
    const p2 = e.player2 ? ` / ${e.player2.first_name} ${e.player2.last_name}` : ''
    return p1 + p2 || 'Equipo 1'
  }

  function team2Name(): string {
    const e = match.entry2 as any
    if (!e) return 'Equipo 2'
    const p1 = e.player1 ? `${e.player1.first_name} ${e.player1.last_name}` : ''
    const p2 = e.player2 ? ` / ${e.player2.first_name} ${e.player2.last_name}` : ''
    return p1 + p2 || 'Equipo 2'
  }

  function handleFinish() {
    if (!tossWinner || !tossChoice || !servingTeam || !sideEntry1) return
    onComplete({
      toss_winner: tossWinner,
      toss_choice: tossChoice,
      serving_team: servingTeam,
      side_entry1: sideEntry1,
      current_server_id: serverId,
    })
  }

  const totalSteps = hasSecondPlayer ? 5 : 4
  const summaryStep = hasSecondPlayer ? 5 : 4

  return (
    <div className="min-h-screen bg-[#111111] flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 px-6 py-5 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-red rounded-xl flex items-center justify-center text-white font-bold text-xl">
            {step}
          </div>
          <div>
            <p className="text-white font-bold text-lg">Sorteo · {match.round ?? 'Partido'}</p>
            <p className="text-gray-500 text-sm">{match.court?.name}</p>
          </div>
        </div>
        <div className="flex gap-1.5 mt-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${step >= i + 1 ? 'bg-brand-red' : 'bg-gray-800'}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {/* Step 1 - Who wins toss */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-white text-2xl font-black font-score text-center">¿Quién gana el sorteo?</h2>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => { setTossWinner(1); setStep(2) }}
                className="h-36 bg-brand-red hover:bg-red-500 active:scale-95 rounded-2xl text-white font-black font-score text-2xl transition-transform px-4 leading-tight">
                {team1Name().split('/')[0].trim()}
              </button>
              <button onClick={() => { setTossWinner(2); setStep(2) }}
                className="h-36 bg-brand-pink hover:bg-pink-500 active:scale-95 rounded-2xl text-white font-black font-score text-2xl transition-transform px-4 leading-tight">
                {team2Name().split('/')[0].trim()}
              </button>
            </div>
          </div>
        )}

        {/* Step 2 - Toss choice */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-white text-2xl font-black font-score text-center">
              {tossWinner === 1 ? team1Name().split('/')[0] : team2Name().split('/')[0]} elige:
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: 'serve',      label: 'SACAR' },
                { value: 'receive',    label: 'RESTAR' },
                { value: 'side_left',  label: 'LADO IZQ.' },
                { value: 'side_right', label: 'LADO DER.' },
              ].map(({ value, label }) => (
                <button key={value} onClick={() => {
                  setTossChoice(value as any)
                  if (value === 'serve') setServingTeam(tossWinner!)
                  if (value === 'receive') setServingTeam(tossWinner === 1 ? 2 : 1)
                  if (value === 'side_left' || value === 'side_right') setServingTeam(tossWinner! === 1 ? 2 : 1)
                  setStep(3)
                }}
                  className="h-28 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl text-white font-black font-score text-2xl transition-transform border border-gray-700">
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3 - Side assignment (left/right from judge's POV) */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-white text-2xl font-black font-score text-center">
              ¿En qué lado juega {team1Name().split('/')[0]}?
            </h2>
            <p className="text-gray-500 text-center text-base">Desde la posición del árbitro</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => { setSideEntry1('near'); setStep(hasSecondPlayer ? 4 : summaryStep) }}
                className="h-36 bg-brand-red hover:bg-red-500 active:scale-95 rounded-2xl text-white font-black font-score text-3xl transition-transform">
                ← IZQUIERDA
              </button>
              <button onClick={() => { setSideEntry1('far'); setStep(hasSecondPlayer ? 4 : summaryStep) }}
                className="h-36 bg-brand-pink hover:bg-pink-500 active:scale-95 rounded-2xl text-white font-black font-score text-3xl transition-transform">
                DERECHA →
              </button>
            </div>
          </div>
        )}

        {/* Step 4 - Who serves first (doubles only) */}
        {step === 4 && hasSecondPlayer && (
          <div className="space-y-6">
            <h2 className="text-white text-2xl font-black font-score text-center">
              ¿Quién saca primero en Equipo {servingTeam}?
            </h2>
            {(() => {
              const entry = servingTeam === 1 ? match.entry1 as any : match.entry2 as any
              const players = [entry?.player1, entry?.player2].filter(Boolean)
              return (
                <div className="space-y-4">
                  {players.map((p: any) => (
                    <button key={p.id} onClick={() => { setServerId(p.id); setStep(summaryStep) }}
                      className="w-full h-24 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl text-white font-bold text-2xl transition-transform border border-gray-700 px-4">
                      {p.first_name} {p.last_name}
                    </button>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {/* Confirm */}
        {step === summaryStep && (
          <div className="space-y-6">
            <h2 className="text-white text-2xl font-black font-score text-center">Confirma y empieza</h2>

            <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 space-y-3 text-base">
              <div className="flex justify-between"><span className="text-gray-500">Saque</span><span className="text-white font-bold">Equipo {servingTeam}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Lado Eq. 1</span><span className="text-white font-bold">{sideEntry1 === 'near' ? 'Izquierda' : 'Derecha'}</span></div>
              {serverId && <div className="flex justify-between"><span className="text-gray-500">Primer sacador</span><span className="text-white">asignado ✓</span></div>}
            </div>

            <button onClick={handleFinish} disabled={saving}
              className="w-full h-20 bg-brand-red hover:bg-red-500 disabled:opacity-50 rounded-2xl text-white font-black font-score text-2xl transition-colors active:scale-95">
              {saving ? 'Iniciando...' : 'INICIAR PARTIDO →'}
            </button>

            <button onClick={() => setStep(1)}
              className="w-full text-gray-500 hover:text-gray-300 text-sm py-2">
              ← Empezar de nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
