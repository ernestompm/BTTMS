import { createServiceSupabase } from '@/lib/supabase-server'
import { StreamingDashboard } from '@/components/streaming/StreamingDashboard'

export const dynamic = 'force-dynamic'

export default async function StreamingAdminPage() {
  const service = createServiceSupabase()

  const { data: tournaments } = await service.from('tournaments').select('id, name').order('start_date', { ascending: false })
  const tournamentId = tournaments?.[0]?.id

  const { data: matches } = await service.from('matches')
    .select(`id, status, scheduled_at, round, category, match_type, court:courts(name),
      entry1:draw_entries!entry1_id(player1:players!player1_id(last_name), player2:players!player2_id(last_name)),
      entry2:draw_entries!entry2_id(player1:players!player1_id(last_name), player2:players!player2_id(last_name))`)
    .eq('tournament_id', tournamentId ?? '00000000-0000-0000-0000-000000000000')
    .order('scheduled_at', { ascending: true })

  const { data: sessions } = await service.from('stream_sessions')
    .select('*').eq('tournament_id', tournamentId ?? '00000000-0000-0000-0000-000000000000')

  return (
    <StreamingDashboard
      tournamentId={tournamentId!}
      matches={(matches as any) ?? []}
      initialSessions={(sessions as any) ?? []}
    />
  )
}
