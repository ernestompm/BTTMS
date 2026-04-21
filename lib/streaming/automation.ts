// ============================================================================
// Automation engine — runs client-side in the operator panel.
// ============================================================================
// Subscribes to the match + points tables, detects events (game_end, set_end,
// match_end, match_status change, toss_set), matches them to the tournament's
// stream_automation_rules, and executes the ordered action list respecting
// delay_ms. Manual operator actions cancel any pending chain for the same
// graphic to avoid conflicts.
// ============================================================================

import { createClient } from '@/lib/supabase'
import type { AutomationAction, AutomationRule, TriggerType } from '@/types/streaming'
import { showGraphic, hideGraphic, logEvent } from './commands'

type Timer = ReturnType<typeof setTimeout>

export class AutomationRunner {
  private rules: AutomationRule[] = []
  private pending: Map<string, Timer[]> = new Map()   // graphic -> pending timers
  private subs: Array<{ unsubscribe(): void }> = []
  private sb = createClient()
  private lastMatchSnapshot: any = null
  private enabled = false

  constructor(
    private sessionId: string,
    private matchId: string,
    private tournamentId: string,
  ) {}

  async start() {
    this.enabled = true
    await this.loadRules()
    const { data: m } = await this.sb.from('matches').select('*').eq('id', this.matchId).single()
    this.lastMatchSnapshot = m

    const ch = this.sb.channel(`auto-${this.sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${this.matchId}` },
        (p) => this.onMatchChange(p.new as any))
      .subscribe()
    this.subs.push({ unsubscribe: () => this.sb.removeChannel(ch) })
  }

  setEnabled(v: boolean) {
    this.enabled = v
    if (!v) this.cancelAll()
  }

  stop() {
    this.enabled = false
    this.cancelAll()
    for (const s of this.subs) s.unsubscribe()
    this.subs = []
  }

  private async loadRules() {
    const { data } = await this.sb.from('stream_automation_rules')
      .select('*').eq('tournament_id', this.tournamentId).eq('enabled', true)
    this.rules = (data ?? []) as AutomationRule[]
  }

  /** Expose for manual re-fire from operator panel */
  async fire(trigger: TriggerType, context: Record<string, any> = {}) {
    if (!this.enabled) return
    const matched = this.rules.filter(r => r.trigger_type === trigger)
    for (const r of matched) {
      logEvent(this.sessionId, 'auto_trigger', null, { rule: r.name, trigger, context })
      this.run(r.actions, context)
    }
  }

  private cancelAll() {
    for (const timers of this.pending.values()) timers.forEach(clearTimeout)
    this.pending.clear()
  }

  private cancelGraphic(key: string) {
    const list = this.pending.get(key); if (!list) return
    list.forEach(clearTimeout); this.pending.delete(key)
  }

  private run(actions: AutomationAction[], context: Record<string, any>) {
    for (const action of actions) {
      const delay = action.delay_ms ?? 0
      this.cancelGraphic(action.graphic)
      const t = setTimeout(async () => {
        try {
          const mergedData = { ...(action.data ?? {}), ...(context.data_override ?? {}) }
          if (action.type === 'show') await showGraphic(this.sessionId, action.graphic, { data: mergedData })
          else if (action.type === 'hide') await hideGraphic(this.sessionId, action.graphic)
          await logEvent(this.sessionId, 'auto_action', action.graphic, { action, context })
        } catch (e: any) {
          await logEvent(this.sessionId, 'error', action.graphic, { message: String(e?.message ?? e) })
        }
      }, delay)
      const arr = this.pending.get(action.graphic) ?? []
      arr.push(t); this.pending.set(action.graphic, arr)
    }
  }

  /** Derive semantic events by diffing snapshots. */
  private onMatchChange(next: any) {
    if (!this.enabled) { this.lastMatchSnapshot = next; return }
    const prev = this.lastMatchSnapshot ?? {}
    this.lastMatchSnapshot = next

    // match_status changed
    if (prev.status !== next.status) {
      this.fire(`match_status:${next.status}` as TriggerType, { from: prev.status })
    }

    // toss recorded (was null, now has value)
    if (!prev.toss_winner && next.toss_winner) {
      this.fire('toss_set', { winner_team: next.toss_winner, choice: next.toss_choice })
    }

    // Derive score events
    const ps = prev.score, ns = next.score
    if (ps && ns) {
      // match_end
      if (ps.match_status !== 'finished' && ns.match_status === 'finished') {
        this.fire('match_end', { winner_team: ns.winner_team })
      }
      // set_end: sets.length increased OR sets_won total increased
      const prevSets = (ps.sets?.length ?? 0)
      const nextSets = (ns.sets?.length ?? 0)
      if (nextSets > prevSets) {
        const setIndex = nextSets // 1-based for the set that just ended
        this.fire('set_end', { set_index: setIndex })
      } else {
        // game_end: current_set sum increased but no set added
        const prevGames = (ps.current_set?.t1 ?? 0) + (ps.current_set?.t2 ?? 0)
        const nextGames = (ns.current_set?.t1 ?? 0) + (ns.current_set?.t2 ?? 0)
        if (nextGames > prevGames && ns.match_status !== 'finished') {
          this.fire('game_end', { games_t1: ns.current_set?.t1, games_t2: ns.current_set?.t2 })
        }
      }
    }
  }
}
