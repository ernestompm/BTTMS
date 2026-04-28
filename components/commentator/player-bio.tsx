'use client'
// Bio del jugador para el comentarista — toda la info legible de un vistazo

import type { Player } from '@/types'

function ageFrom(iso: string) {
  const d = new Date(iso); const now = new Date(); let a = now.getFullYear()-d.getFullYear()
  const m = now.getMonth()-d.getMonth()
  if (m<0 || (m===0 && now.getDate()<d.getDate())) a--
  return a
}
function lateralidad(l: string|null|undefined): string {
  if (l === 'left') return 'Zurdo'
  if (l === 'ambidextrous') return 'Ambidiestro'
  return 'Diestro'
}

export function CommentatorPlayerBio({ player, accent }: { player: Player, accent: 'cyan'|'coral' }) {
  const accentColor = accent === 'cyan' ? '#00e0c6' : '#ff7b61'
  const facts: Array<[string, string]> = []
  if (player.birth_date) facts.push(['Edad', `${ageFrom(player.birth_date)} años`])
  else if (player.age_manual) facts.push(['Edad', `${player.age_manual} años`])
  if (player.birth_city) facts.push(['Nacimiento', player.birth_city])
  if (player.height_cm) facts.push(['Altura', `${player.height_cm} cm`])
  if (player.laterality) facts.push(['Mano', lateralidad(player.laterality)])
  if (player.nationality) facts.push(['Nacionalidad', player.nationality])
  if (player.club) facts.push(['Club', player.club])
  if (player.federacion_autonomica) facts.push(['Federación', player.federacion_autonomica])
  if (player.ranking_rfet) facts.push(['Ranking RFET', `#${player.ranking_rfet}`])
  if (player.ranking_itf) facts.push(['Ranking ITF', `#${player.ranking_itf}`])

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="flex items-stretch">
        {/* Photo */}
        <div className="flex-none w-28 h-28 bg-gray-800 overflow-hidden">
          {player.photo_url ? (
            <img src={player.photo_url} alt="" className="w-full h-full object-cover"/>
          ) : (
            <div className="w-full h-full grid place-items-center text-gray-700 text-xs">Sin foto</div>
          )}
        </div>
        {/* Name */}
        <div className="flex-1 p-3 min-w-0" style={{ borderLeft: `3px solid ${accentColor}` }}>
          <div className="text-xs text-gray-500 uppercase tracking-widest truncate">{player.first_name}</div>
          <div className="text-2xl font-black uppercase text-white leading-tight tracking-tight truncate">{player.last_name}</div>
          {(player.ranking_rfet || player.ranking_itf) && (
            <div className="mt-1 text-xs text-gray-400 tabular-nums">
              {player.ranking_rfet && <span>RFET <span className="text-white font-bold">#{player.ranking_rfet}</span></span>}
              {player.ranking_rfet && player.ranking_itf && <span className="mx-2 text-gray-600">·</span>}
              {player.ranking_itf && <span>ITF <span className="text-white font-bold">#{player.ranking_itf}</span></span>}
            </div>
          )}
        </div>
      </div>

      {/* Facts grid */}
      {facts.length > 0 && (
        <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs border-t border-gray-800">
          {facts.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-2 py-1 border-b border-gray-800/60">
              <span className="text-gray-500 uppercase tracking-wider text-[10px]">{k}</span>
              <span className="text-white font-medium truncate text-right">{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Palmarés */}
      {(player.titles?.length ?? 0) > 0 && (
        <div className="p-3 border-t border-gray-800">
          <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">PALMARÉS</div>
          <div className="space-y-1">
            {player.titles!.slice(0, 5).map((t: any, i: number) => (
              <div key={i} className="text-xs flex gap-3">
                <span className="font-bold tabular-nums" style={{ color: accentColor }}>{t.year}</span>
                <span className="text-gray-300">{t.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bio */}
      {player.bio && (
        <div className="p-3 border-t border-gray-800">
          <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">BIO</div>
          <p className="text-xs text-gray-300 leading-relaxed">{player.bio}</p>
        </div>
      )}
    </div>
  )
}
