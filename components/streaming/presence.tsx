'use client'
// ============================================================================
// Presence — keep child mounted during exit animation, then unmount.
// ============================================================================
// Usage:
//   <Presence show={visible} exitMs={700}>
//     {(vis) => <MyGraphic visible={vis} {...props} />}
//   </Presence>
// The child receives the current "visible" boolean so it can switch between
// its enter and exit animation keyframes (see animStyle helper).
// ============================================================================

import { useEffect, useState, ReactNode } from 'react'

interface Props {
  show: boolean
  exitMs?: number
  children: (visible: boolean) => ReactNode
}

export function Presence({ show, exitMs = 700, children }: Props) {
  const [mounted, setMounted] = useState(show)
  useEffect(() => {
    if (show) { setMounted(true); return }
    const t = setTimeout(() => setMounted(false), exitMs)
    return () => clearTimeout(t)
  }, [show, exitMs])
  if (!mounted) return null
  return <>{children(show)}</>
}
