'use client'

import { useState } from 'react'
import type { Match } from '@/types'

interface TossData {
  toss_winner: 1 | 2
  toss_choice: 'serve' | 'receive' | 'side_left' | 'side_right'
  serving_team: 1 | 2
  side_entry1: 'near' | 'far'
  current_server_id: string | null
  scoring_system: string
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
  const [scoringSystem, setScoringSystem] = useState('best_of_2_sets_super_tb')

  const isDoubles = (match as any).match_type === 'doubles'

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
      scoring_system: scoringSystem,
    })
  }

  const BtnPair = ({ label1, label2, onSelect1, onSelect2 }: any) => (
    <div className="grid grid-cols-2 gap-4">
      <button onClick={onSelect1} className="h-24 bg-brand-red hover:bg-red-500 active:scale-95 rounded-2xl text-white font-bold font-score text-lg transition-transform">
        {label1}
      </button>
      <button onClick={onSelect2} className="h-24 bg-brand-pink hover:bg-pink-500 active:scale-95 rounded-2xl text-white font-bold font-score text-lg transition-transform">
        {label2}
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#111111] flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center text-white font-bold">
            {step}
          </div>
          <div>
            <p className="text-white font-semibold">Sorteo · {match.round ?? 'Partido'}</p>
            <p className="text-gray-500 text-xs">{match.court?.name}</p>
          </div>
        </div>
        {/* Progress */}
        <div className="flex gap-1 mt-3">
          {[1,2,3,4,isDoubles?5:null].filter(Boolean).map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${(step ?? 0) >= (s ?? 0) ? 'bg-brand-red' : 'bg-gray-800'}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 p-5 space-y-6">
        {/* Step 1 - Who wins toss */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-white text-xl font-bold font-score text-center">¿Quién gana el sorteo?</h2>
            <BtnPair
              label1={team1Name().split('/')[0].trim()} label2={team2Name().split('/')[0].trim()}
              onSelect1={() => { setTossWinner(1); setStep(2) }}
              onSelect2={() => { setTossWinner(2); setStep(2) }}
            />
          </div>
        )}

        {/* Step 2 - Toss choice */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-white text-xl font-bold font-score text-center">
              {tossWinner === 1 ? team1Name().split('/')[0] : team2Name().split('/')[0]} elige:
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: 'serve', label: 'Sacar' },
                { value: 'receive', label: 'Restar' },
                { value: 'side_left', label: 'Lado Izq.' },
                { value: 'side_right', label: 'Lado Der.' },
              ].map(({ value, label }) => (
                <button key={value} onClick={() => {
                  setTossChoice(value as any)
                  // Determine serving team from choice
                  if (value === 'serve') setServingTeam(tossWinner!)
                  if (value === 'receive') setServingTeam(tossWinner === 1 ? 2 : 1)
                  setStep(3)
                }}
                  className="h-20 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl text-white font-bold font-score text-lg transition-transform border border-gray-700">
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3 - Side assignment */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-white text-xl font-bold font-score text-center">
              ¿En qué lado está {team1Name().split('/')[0]}?
            </h2>
            <p className="text-gray-500 text-sm text-center">Mirando desde el árbitro</p>
            <BtnPair
              label1="Lado CERCA (Near)" label2="Lado LEJOS (Far)"
              onSelect1={() => { setSideEntry1('near'); setStep(isDoubles ? 4 : 4) }}
              onSelect2={() => { setSideEntry1('far'); setStep(isDoubles ? 4 : 4) }}
            />
          </div>
        )}

        {/* Step 4 - Who serves (doubles) */}
        {step === 4 && isDoubles && (match.entry1 as any)?.player2 && (
          <div className="space-y-4">
            <h2 className="text-white text-xl font-bold font-score text-center">
              ¿Quién saca primero en el Equipo {servingTeam}?
            </h2>
            {(() => {
              const entry = servingTeam === 1 ? match.entry1 as any : match.entry2 as any
              const players = [entry?.player1, entry?.player2].filter(Boolean)
              return (
                <div className="space-y-3">
                  {players.map((p: any) => (
                    <button key={p.id} onClick={() => { setServerId(p.id); setStep(5) }}
                      className="w-full h-16 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl text-white font-medium text-lg transition-transform border border-gray-700">
                      {p.first_name} {p.last_name}
                    </button>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {/* Step 4/5 - Scoring system + confirm */}
        {(step === 4 && !isDoubles) || (step === 5 && isDoubles) || (step === 4 && isDoubles && !(match.entry1 as any)?.player2) ? (
          <div className="space-y-4">
            <h2 className="text-white text-xl font-bold font-score text-center">Sistema de puntuación</h2>
            <div className="space-y-2">
              {[
                { value: 'best_of_2_sets_super_tb', label: 'Mejor de 2 sets + Super TB (Dobles Absoluto)' },
                { value: '7_games_tb', label: '7 juegos + TB si 6-6 (Individual)' },
                { value: 'pro_set', label: 'Pro Set (1 set a 7)' },
                { value: 'short_sets', label: 'Sets cortos a 4' },
              ].map(({ value, label }) => (
                <button key={value} onClick={() => setScoringSystem(value)}
                  className={`w-full px-4 py-3 rounded-xl text-sm text-left transition-colors border ${scoringSystem === value ? 'border-brand-red bg-brand-red/10 text-white' : 'border-gray-700 bg-gray-800 text-gray-400'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 space-y-2 text-sm">
              <p className="text-gray-400">Resumen del sorteo:</p>
              <p className="text-white">Saca: Equipo {servingTeam}</p>
              <p className="text-white">Lado Eq.1: {sideEntry1 === 'near' ? 'Cerca' : 'Lejos'}</p>
              {serverId && <p className="text-white">Primer sacador asignado ✓</p>}
            </div>

            <button onClick={handleFinish} disabled={saving}
              className="w-full h-16 bg-brand-red hover:bg-red-500 disabled:opacity-50 rounded-2xl text-white font-bold font-score text-xl transition-colors active:scale-95">
              {saving ? 'Iniciando...' : 'INICIAR PARTIDO →'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
