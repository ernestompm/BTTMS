// ============================================================================
// Shared style helpers for streaming graphics
// ============================================================================
// All graphics are absolutely positioned on a 1920x1080 stage that is
// letterbox-scaled to fit the viewport while preserving aspect ratio so that
// fonts and proportions remain identical on TV and mobile. Backgrounds are
// transparent so the whole page can be fed to vMix as an alpha source.
// ============================================================================

export const STAGE_W = 1920
export const STAGE_H = 1080

export function hexAlpha(hex: string, alpha: number) {
  const clean = hex.replace('#','')
  return `#${clean}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`
}

/** Injects common keyframes used by all graphics, once per page. */
export const STREAM_KEYFRAMES = `
@keyframes sgFadeIn    { from{opacity:0} to{opacity:1} }
@keyframes sgFadeOut   { from{opacity:1} to{opacity:0} }
@keyframes sgSlideUp   { from{opacity:0;transform:translateY(40px);filter:blur(10px)} to{opacity:1;transform:none;filter:blur(0)} }
@keyframes sgSlideDown { from{opacity:1;transform:none;filter:blur(0)}               to{opacity:0;transform:translateY(40px);filter:blur(10px)} }
@keyframes sgSlideLeft { from{opacity:0;transform:translateX(80px);filter:blur(10px)} to{opacity:1;transform:none;filter:blur(0)} }
@keyframes sgSlideRight{ from{opacity:1;transform:none;filter:blur(0)}                to{opacity:0;transform:translateX(80px);filter:blur(10px)} }
@keyframes sgZoomIn    { from{opacity:0;transform:scale(.6) rotate(-2deg);filter:blur(12px)} to{opacity:1;transform:none;filter:blur(0)} }
@keyframes sgZoomOut   { from{opacity:1;transform:none;filter:blur(0)} to{opacity:0;transform:scale(.92);filter:blur(10px)} }
@keyframes sgBlink     { 0%,100%{opacity:1} 50%{opacity:.25} }
@keyframes sgPulse     { 0%,100%{box-shadow:0 0 0 0 rgba(239,106,76,.8)} 50%{box-shadow:0 0 0 22px rgba(239,106,76,0)} }
@keyframes sgSheen     { 0%{transform:translateX(-110%)} 60%,100%{transform:translateX(210%)} }
@keyframes sgTicker    { 0%{transform:translateY(0)} 100%{transform:translateY(-100%)} }
@keyframes sgCardIn    { from{opacity:0;transform:translateY(26px) scale(.985);filter:blur(10px)} to{opacity:1;transform:none;filter:blur(0)} }
`

/** Palette extraction with sensible defaults matching the existing venue-scoreboard look. */
export function palette(cfg: any) {
  return {
    accentA: cfg?.colors?.team1_accent ?? '#ef6a4c',
    accentB: cfg?.colors?.team2_accent ?? '#af005f',
    serve:   cfg?.colors?.serving_indicator ?? '#ef6a4c',
    text:    cfg?.colors?.text_primary ?? '#ffffff',
    text2:   cfg?.colors?.text_secondary ?? 'rgba(255,255,255,.65)',
    bgGrad:  'linear-gradient(135deg, rgba(20,30,55,.92) 0%, rgba(8,12,28,.96) 100%)',
    panelBg: 'linear-gradient(180deg, rgba(18,24,44,.92) 0%, rgba(8,10,22,.96) 100%)',
    glass:   'linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.02))',
  }
}

export function flagPath(nat: string | null | undefined) {
  const n = (nat ?? 'ESP').toUpperCase()
  return `/Flags/${n}.jpg`
}

export function fullName(p: any) {
  if (!p) return ''
  return `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
}

export function teamLabel(entry: any, isDoubles: boolean) {
  if (!entry) return '—'
  if (isDoubles) return `${entry.player1?.last_name ?? ''} / ${entry.player2?.last_name ?? ''}`
  return entry.player1?.last_name ?? ''
}

/** Uniform animated wrapper used by every graphic. */
export function animStyle(visible: boolean, enter: string, exit: string, ms = 650) {
  return {
    animation: `${visible ? enter : exit} ${ms}ms cubic-bezier(.22,.9,.25,1) both`,
  } as React.CSSProperties
}
