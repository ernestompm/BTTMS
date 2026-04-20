import { createServiceSupabase } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import type { Player } from '@/types'

export default async function PublicPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const service = createServiceSupabase()

  const { data: player } = await service.from('players').select('*').eq('id', id).single()
  if (!player) notFound()
  const p = player as Player

  // Get recent matches
  const { data: matches } = await service.from('matches')
    .select('id, category, round, status, score, tournament:tournaments(name), entry1:draw_entries!entry1_id(player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name)), entry2:draw_entries!entry2_id(player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name))')
    .or(`entry1.player1_id.eq.${id},entry1.player2_id.eq.${id},entry2.player1_id.eq.${id},entry2.player2_id.eq.${id}`)
    .eq('status', 'finished')
    .order('finished_at', { ascending: false })
    .limit(10)

  const age = p.birth_date ? Math.floor((Date.now() - new Date(p.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000)) : null

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Player card */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          {/* Header with gradient */}
          <div className="h-24 bg-gradient-to-br from-brand-red/30 to-brand-pink/20" />
          <div className="px-6 pb-6 -mt-12">
            <div className="flex items-end gap-4 mb-4">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gray-800 border-4 border-gray-900 flex-shrink-0">
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.first_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">👤</div>
                )}
              </div>
              <div className="pb-2">
                <h1 className="text-2xl font-bold text-white font-score">
                  {p.first_name} <span className="text-brand-red">{p.last_name}</span>
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  {p.nationality && (
                    <img src={`https://flagcdn.com/20x15/${p.nationality.toLowerCase()}.png`}
                      alt={p.nationality} className="w-5 h-3.5 rounded-sm" />
                  )}
                  {age && <span className="text-gray-400 text-sm">{age} años</span>}
                  {p.birth_city && <span className="text-gray-500 text-sm">· {p.birth_city}</span>}
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Ranking RFET', value: p.ranking_rfet ? `#${p.ranking_rfet}` : '—' },
                { label: 'Ranking ITF', value: p.ranking_itf ? `#${p.ranking_itf}` : '—' },
                { label: 'Altura', value: p.height_cm ? `${p.height_cm}cm` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-white font-score font-bold text-lg">{value}</p>
                  <p className="text-gray-500 text-xs">{label}</p>
                </div>
              ))}
            </div>

            {/* Bio */}
            {p.bio && <p className="text-gray-300 text-sm leading-relaxed mb-4">{p.bio}</p>}

            {/* Titles */}
            {p.titles && p.titles.length > 0 && (
              <div className="mb-4">
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">Títulos</p>
                <div className="flex flex-wrap gap-2">
                  {p.titles.map((t, i) => (
                    <span key={i} className="bg-yellow-900/30 border border-yellow-800 text-yellow-300 text-xs px-2 py-1 rounded-lg">
                      🏆 {t.name} {t.year}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Social */}
            {p.social_instagram && (
              <a href={`https://instagram.com/${p.social_instagram}`} target="_blank" rel="noopener"
                className="inline-flex items-center gap-1.5 text-pink-400 hover:text-pink-300 text-sm transition-colors">
                📸 @{p.social_instagram}
              </a>
            )}
          </div>
        </div>

        {/* Recent matches */}
        {matches && matches.length > 0 && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
            <h2 className="text-white font-semibold mb-3">Últimos partidos</h2>
            <div className="space-y-2">
              {(matches as any[]).map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-xl text-sm">
                  <div>
                    <p className="text-gray-400 text-xs mb-0.5">{m.tournament?.name} · {m.round}</p>
                    <p className="text-white">vs. {m.entry1?.player1?.last_name ?? '?'}/{m.entry2?.player1?.last_name ?? '?'}</p>
                  </div>
                  {m.score && (
                    <div className="text-right font-score font-bold">
                      <span className="text-brand-red">{m.score.sets_won?.t1 ?? 0}</span>
                      <span className="text-gray-600">-</span>
                      <span className="text-brand-pink">{m.score.sets_won?.t2 ?? 0}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
