'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export function NavProgress() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)
  const prev = useRef(pathname)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (pathname !== prev.current) {
      // Navigation completed — finish bar
      setWidth(100)
      const t = setTimeout(() => { setVisible(false); setWidth(0) }, 300)
      prev.current = pathname
      return () => clearTimeout(t)
    }
  }, [pathname])

  // Start bar on mount for initial loads
  useEffect(() => {
    setVisible(true)
    setWidth(70)
    let inner: ReturnType<typeof setTimeout>
    timer.current = setTimeout(() => {
      setWidth(100)
      inner = setTimeout(() => setVisible(false), 300)
    }, 400)
    return () => { clearTimeout(timer.current); clearTimeout(inner) }
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed top-0 left-0 z-[999] h-0.5 bg-brand-red transition-all duration-300 ease-out"
      style={{ width: `${width}%`, opacity: width === 100 ? 0 : 1 }}
    />
  )
}
