import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import { JudgeClient } from '@/components/judge/judge-client'

export const dynamic = 'force-dynamic'

export default async function JudgeMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceSupabase()
  const { data: appUser } = await service.from('app_users').select('*').eq('id', user.id).single()
  if (!appUser) redirect('/login')

  const { data: match } = await service.from('matches')
    .select(`*, court:courts(*), entry1:draw_entries!entry1_id(*, player1:players!player1_id(*), player2:players!player2_id(*)), entry2:draw_entries!entry2_id(*, player1:players!player1_id(*), player2:players!player2_id(*))`)
    .eq('id', matchId)
    .single()

  if (!match) notFound()

  if (appUser.role === 'judge' && match.judge_id !== user.id) {
    redirect('/judge')
  }

  const { data: tournament } = await service.from('tournaments')
    .select('warmup_duration_seconds, side_change_duration_seconds, set_break_duration_seconds, advanced_stats_enabled')
    .eq('id', match.tournament_id)
    .single()

  const timerConfig = {
    warmup: tournament?.warmup_duration_seconds ?? 300,
    sideChange: tournament?.side_change_duration_seconds ?? 60,
    setBreak: tournament?.set_break_duration_seconds ?? 90,
  }

  return (
    <JudgeClient
      initialMatch={match as any}
      userId={user.id}
      judgeName={appUser.full_name ?? appUser.email ?? 'Juez'}
      timerConfig={timerConfig}
      advancedStats={tournament?.advanced_stats_enabled ?? true}
    />
  )
}
