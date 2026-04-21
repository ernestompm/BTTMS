import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import { JudgeClient } from '@/components/judge/judge-client'
import { JudgeNameSetup } from '@/components/judge/judge-name-setup'

export const dynamic = 'force-dynamic'

function isValidFullName(name?: string | null): boolean {
  if (!name) return false
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.length >= 2 && parts.every(p => p.length >= 2)
}

export default async function JudgeMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceSupabase()
  const { data: appUser } = await service.from('app_users').select('*').eq('id', user.id).single()
  if (!appUser) redirect('/login')

  // Block judges without full name from arbitrating
  if (appUser.role === 'judge' && !isValidFullName(appUser.full_name)) {
    return <JudgeNameSetup userId={user.id} currentName={appUser.full_name}/>
  }

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
