import { createServiceSupabase } from '@/lib/supabase-server'
import Link from 'next/link'
import type { Player } from '@/types'
import Image from 'next/image'
import { FlagImg } from '@/components/admin/flag-img'

export default async function PlayersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const supabase = createServiceSupabase()

  let query = supabase.from('players').select('*').order('last_name')
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)

  const { data: players } = await query.limit(100)

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-score">Jugadores</h1>
          <p className="text-gray-400 text-sm">{players?.length ?? 0} jugadores registrados</p>
        </div>
        <Link href="/dashboard/players/new"
          className="bg-brand-red hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          + Nuevo jugador
        </Link>
      </div>

      {/* Search */}
      <form className="relative">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar jugador..."
          className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 pl-10 text-white placeholder-gray-500 focus:outline-none focus:border-brand-red"
        />
        <span className="absolute left-3 top-3.5 text-gray-500">🔍</span>
        <button type="submit" className="sr-only">Buscar</button>
      </form>

      {/* Players grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(players as Player[] || []).map((p) => (
          <Link key={p.id} href={`/dashboard/players/${p.id}`}
            className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl p-4 flex items-center gap-4 transition-colors group">
            <div className="w-12 h-12 rounded-full bg-gray-800 flex-shrink-0 overflow-hidden">
              {p.photo_url ? (
                <Image src={p.photo_url} alt={p.first_name} width={48} height={48} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600 text-xl">👤</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate group-hover:text-brand-red transition-colors">
                {p.first_name} {p.last_name}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                {p.nationality && <FlagImg nationality={p.nationality} />}
                {p.ranking_rfet && <span>RFET #{p.ranking_rfet}</span>}
                {p.ranking_itf && <span>ITF #{p.ranking_itf}</span>}
              </div>
            </div>
          </Link>
        ))}

        {(!players || players.length === 0) && (
          <div className="col-span-3 bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center">
            <p className="text-gray-500">No se encontraron jugadores</p>
            <Link href="/dashboard/players/new" className="text-brand-red text-sm mt-2 inline-block">
              Crear el primer jugador →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
