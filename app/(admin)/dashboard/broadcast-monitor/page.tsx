import { createServiceSupabase } from '@/lib/supabase-server'
import { BroadcastMonitor } from '@/components/broadcast/broadcast-monitor'

export const dynamic = 'force-dynamic'

export default async function BroadcastMonitorPage() {
  const service = createServiceSupabase()

  const { data: tournaments } = await service
    .from('tournaments')
    .select('id, name, broadcast_endpoint, broadcast_method')
    .order('start_date', { ascending: false })

  const tournament = tournaments?.[0]
  const tournamentId = tournament?.id

  // Initial match list (in_progress + scheduled)
  const { data: matches } = await service.from('matches')
    .select(`id, status, scheduled_at, round, category, match_type, broadcast_active,
      court:courts(name),
      entry1:draw_entries!entry1_id(player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name)),
      entry2:draw_entries!entry2_id(player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name))`)
    .eq('tournament_id', tournamentId ?? '00000000-0000-0000-0000-000000000000')
    .in('status', ['in_progress', 'scheduled', 'warmup', 'judge_on_court', 'players_on_court'])
    .order('scheduled_at', { ascending: true })

  // Recent logs (last 100, current tournament)
  const { data: logs } = await service.from('broadcast_logs')
    .select('*')
    .eq('tournament_id', tournamentId ?? '00000000-0000-0000-0000-000000000000')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <BroadcastMonitor
      tournament={tournament ?? null}
      initialMatches={(matches as any) ?? []}
      initialLogs={(logs as any) ?? []}
    />
  )
}
