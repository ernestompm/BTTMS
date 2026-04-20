'use client'

import type { Score } from '@/types'

const GAME_POINTS = ['0', '15', '30', '40']

function getGameDisplay(score: Score, team: 1 | 2): string {
  if (!score) return '0'
  if (score.super_tiebreak_active) return String(score.tiebreak_score?.[`t${team}` as 't1'|'t2'] ?? 0)
  if (score.tiebreak_active) return String(score.tiebreak_score?.[`t${team}` as 't1'|'t2'] ?? 0)
  if (score.advantage_team === team) return 'ADV'
  if (score.advantage_team !== null && score.advantage_team !== team) return '40'
  if (score.deuce) return 'DUC'
  const pts = score.current_game?.[`t${team}` as 't1'|'t2'] ?? 0
  return GAME_POINTS[pts] ?? '0'
}

export function ScoreDisplay({ score, servingTeam }: { score: Score | null; servingTeam: 1 | 2 | null }) {
  if (!score) {
    return (
      <div className="bg-gray-900/50 px-6 py-4 text-center">
        <p className="text-gray-600 text-sm">Partido sin iniciar</p>
      </div>
    )
  }

  const isTB = score.tiebreak_active
  const isSuperTB = score.super_tiebreak_active
  const label = isSuperTB ? 'SUPER TB' : isTB ? 'TIE-BREAK' : null

  return (
    <div className="bg-gray-900/50 px-4 py-3">
      {label && (
        <div className="text-center mb-2">
          <span className="bg-brand-orange/20 border border-brand-orange/50 text-brand-orange text-xs font-score font-bold px-3 py-0.5 rounded-full">
            {label}
          </span>
        </div>
      )}

      {/* Sets history */}
      {score.sets && score.sets.length > 0 && (
        <div className="flex justify-center gap-4 mb-3">
          {score.sets.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-gray-500 text-xs mb-0.5">S{i+1}</div>
              <div className="font-score font-bold text-gray-300">
                {s.t1}-{s.t2}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Current set + game */}
      <div className="flex items-center justify-center gap-8">
        {/* Set score */}
        <div className="text-center">
          <div className="text-gray-500 text-xs mb-0.5">Set</div>
          <div className="text-3xl font-score font-black text-white">
            {score.current_set?.t1 ?? 0}-{score.current_set?.t2 ?? 0}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-10 bg-gray-700" />

        {/* Game score */}
        <div className="text-center">
          <div className="text-gray-500 text-xs mb-0.5">Juego</div>
          <div className="flex items-center gap-2">
            <span className={`text-3xl font-score font-black ${servingTeam === 1 ? 'text-white' : 'text-gray-400'}`}>
              {getGameDisplay(score, 1)}
            </span>
            <span className="text-gray-600">-</span>
            <span className={`text-3xl font-score font-black ${servingTeam === 2 ? 'text-white' : 'text-gray-400'}`}>
              {getGameDisplay(score, 2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
