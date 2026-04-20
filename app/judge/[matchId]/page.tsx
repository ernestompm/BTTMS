import { createServerSupabase } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import { JudgeClient } from '@/components/judge/judge-client'

export default async function JudgeMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appUser } = await supabase.from('app_users').select('*').eq('id', user.id).single()
  if (!appUser) redirect('/login')

  const { data: match } = await supabase.from('matches')
    .select(`*, court:courts(*), entry1:draw_entries!entry1_id(*, player1:players!player1_id(*), player2:players!player2_id(*)), entry2:draw_entries!entry2_id(*, player1:players!player1_id(*), player2:players!player2_id(*))`)
    .eq('id', matchId)
    .single()

  if (!match) notFound()

  // Judges can only access their assigned match
  if (appUser.role === 'judge' && match.judge_id !== user.id) {
    redirect('/judge')
  }

  return <JudgeClient initialMatch={match as any} userId={user.id} />
}
