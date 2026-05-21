import { useEffect, useRef, MutableRefObject } from 'react'
import { api } from '../lib/ipc'
import type { ServiceId } from '../../../main/services/types'

export interface PaneRef {
  id: ServiceId
  ref: MutableRefObject<HTMLDivElement | null>
}

export function useBoundsReporter(panes: PaneRef[]) {
  const lastBoundsRef = useRef<string>('')
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const report = () => {
      const dpr = window.devicePixelRatio ?? 1
      const bounds = panes
        .map(({ id, ref }) => {
          const el = ref.current
          if (!el) return null
          const r = el.getBoundingClientRect()
          if (r.width <= 0 || r.height <= 0) return null
          return {
            id,
            x: Math.round(r.left * dpr),
            y: Math.round(r.top * dpr),
            width: Math.round(r.width * dpr),
            height: Math.round(r.height * dpr),
          }
        })
        .filter(Boolean) as { id: ServiceId; x: number; y: number; width: number; height: number }[]

      if (bounds.length === 0) return
      const key = JSON.stringify(bounds)
      if (key === lastBoundsRef.current) return
      lastBoundsRef.current = key
      api.setViewBounds(bounds)
    }

    const throttled = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(report)
    }

    // Initial report after paint
    const initId = requestAnimationFrame(() => requestAnimationFrame(report))

    const ro = new ResizeObserver(throttled)
    panes.forEach(({ ref }) => { if (ref.current) ro.observe(ref.current) })

    window.addEventListener('resize', throttled)

    return () => {
      cancelAnimationFrame(rafRef.current)
      cancelAnimationFrame(initId)
      ro.disconnect()
      window.removeEventListener('resize', throttled)
    }
  }, []) // empty deps — refs are stable
}
