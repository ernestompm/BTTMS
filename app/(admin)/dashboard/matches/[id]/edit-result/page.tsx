import { createServiceSupabase } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import { MatchResultEditor } from '@/components/admin/match-result-editor'

export const dynamic = 'force-dynamic'

export default async function EditMatchResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceSupabase()
  const { data: match } = await supabase.from('matches')
    .select(`*, court:courts(name),
      entry1:draw_entries!entry1_id(*, player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name)),
      entry2:draw_entries!entry2_id(*, player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name))`)
    .eq('id', id).single()
  if (!match) notFound()
  return <MatchResultEditor match={match as any}/>
}
