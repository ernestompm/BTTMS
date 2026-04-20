import { createServiceSupabase } from '@/lib/supabase-server'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { CATEGORY_LABELS } from '@/types'

const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

const statusBadge: Record<string, any> = {
  draft: 'outline', seeded: 'warning', in_progress: 'info', finished: 'success',
}

export default async function DrawsPage() {
  const supabase = createServiceSupabase()
  const { data: draws } = await supabase.from('draws')
    .select('*').eq('tournament_id', TOURNAMENT_ID).order('created_at')

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-score">Cuadros y Grupos</h1>
          <p className="text-gray-400 text-sm">{draws?.length ?? 0} cuadros creados</p>
        </div>
        <Link href="/dashboard/draws/new" className="bg-brand-red hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          + Nuevo cuadro
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(draws ?? []).map((d: any) => (
          <Link key={d.id} href={`/dashboard/draws/${d.category}`}
            className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl p-5 transition-colors group">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-white font-semibold group-hover:text-brand-red transition-colors">
                  {(CATEGORY_LABELS as Record<string, string>)[d.category] ?? d.category}
                </p>
                <p className="text-gray-500 text-xs mt-0.5">{d.draw_type.replace(/_/g, ' ')} · {d.size} plazas</p>
              </div>
              <Badge variant={statusBadge[d.status] ?? 'default'}>{d.status}</Badge>
            </div>
            {d.consolation && <p className="text-xs text-gray-600">+ Cuadro de consolación</p>}
          </Link>
        ))}

        {(!draws || draws.length === 0) && (
          <div className="col-span-2 bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center">
            <p className="text-gray-500">No hay cuadros creados</p>
            <Link href="/dashboard/draws/new" className="text-brand-red text-sm mt-2 inline-block">
              Crear el primer cuadro →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
