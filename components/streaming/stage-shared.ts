// ============================================================================
// Shared style helpers for streaming graphics
// ============================================================================

export const STAGE_W = 1920
export const STAGE_H = 1080

export function hexAlpha(hex: string, alpha: number) {
  const clean = hex.replace('#','')
  return `#${clean}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`
}

export function flagPath(nat: string | null | undefined) {
  const n = (nat ?? 'ESP').toUpperCase()
  return `/Flags/${n}.jpg`
}

export function fullName(p: any) {
  if (!p) return ''
  return `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
}

// ─── Keyframes — explicit direction naming ──────────────────────────────────
// Enter  keyframes: sgIn<Dir>   (from hidden → visible)
// Exit   keyframes: sgOut<Dir>  (from visible → hidden)
// Dirs: L/R/U/D (slide from that side), Z (zoom), F (fade), Scale (subtle)
export const STREAM_KEYFRAMES = `
@keyframes sgInF    { from{opacity:0}                                                 to{opacity:1} }
@keyframes sgOutF   { from{opacity:1}                                                 to{opacity:0} }
@keyframes sgInU    { from{opacity:0;transform:translateY(40px)}                      to{opacity:1;transform:none} }
@keyframes sgOutU   { from{opacity:1;transform:none}                                  to{opacity:0;transform:translateY(40px)} }
@keyframes sgInD    { from{opacity:0;transform:translateY(-40px)}                     to{opacity:1;transform:none} }
@keyframes sgOutD   { from{opacity:1;transform:none}                                  to{opacity:0;transform:translateY(-40px)} }
@keyframes sgInR    { from{opacity:0;transform:translateX(-60px)}                     to{opacity:1;transform:none} } /* enter from left */
@keyframes sgOutR   { from{opacity:1;transform:none}                                  to{opacity:0;transform:translateX(-60px)} }
@keyframes sgInL    { from{opacity:0;transform:translateX(60px)}                      to{opacity:1;transform:none} } /* enter from right */
@keyframes sgOutL   { from{opacity:1;transform:none}                                  to{opacity:0;transform:translateX(60px)} }
@keyframes sgInZ    { from{opacity:0;transform:scale(.86)}                            to{opacity:1;transform:scale(1)} }
@keyframes sgOutZ   { from{opacity:1;transform:scale(1)}                              to{opacity:0;transform:scale(.94)} }
@keyframes sgInClip { from{clip-path:inset(0 100% 0 0);opacity:0}                     to{clip-path:inset(0 0 0 0);opacity:1} }
@keyframes sgOutClip{ from{clip-path:inset(0 0 0 0);opacity:1}                        to{clip-path:inset(0 0 0 100%);opacity:0} }
@keyframes sgSrvPulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,106,76,.7)} 50%{box-shadow:0 0 0 12px rgba(239,106,76,0)} }
@keyframes sgSheen    { 0%{transform:translateX(-110%)} 60%,100%{transform:translateX(210%)} }
`

/** Build an animation style using explicit enter/exit keyframes. */
export function animStyle(visible: boolean, enter: string, exit: string, ms = 650): React.CSSProperties {
  return {
    animation: `${visible ? enter : exit} ${ms}ms cubic-bezier(.22,.9,.25,1) both`,
    willChange: 'transform, opacity',
  }
}

/** Palette extracted from scoreboard_config with fallbacks. */
export function palette(cfg: any) {
  return {
    accentA: cfg?.colors?.team1_accent ?? '#ef6a4c',
    accentB: cfg?.colors?.team2_accent ?? '#af005f',
    serve:   cfg?.colors?.serving_indicator ?? '#ef6a4c',
    text:    cfg?.colors?.text_primary ?? '#ffffff',
    text2:   cfg?.colors?.text_secondary ?? 'rgba(255,255,255,.65)',
    panelBg: 'linear-gradient(180deg, rgba(12,18,36,.97) 0%, rgba(5,8,20,.99) 100%)',
    glass:   'linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.015))',
  }
}

/** Unified card style — same across every graphic for visual consistency. */
export const CARD: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(12,18,36,.97) 0%, rgba(5,8,20,.99) 100%)',
  border: '1px solid rgba(255,255,255,.08)',
  borderRadius: 18,
  boxShadow: '0 24px 60px rgba(0,0,0,.55)',
  overflow: 'hidden',
}

/** Small header label used across cards (top-left kicker). */
export const KICKER: React.CSSProperties = {
  fontSize: 18,
  letterSpacing: '.3em',
  textTransform: 'uppercase',
  fontWeight: 800,
  opacity: .55,
}
