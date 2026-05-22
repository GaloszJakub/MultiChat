import React from 'react'

interface BrandMarkProps {
  size?: number
}

export function BrandMark({ size = 30 }: BrandMarkProps) {
  const outerRadius = Math.max(4, Math.round(size * 8 / 30))
  const inset1 = Math.round(size * 6 / 30)
  const inset1Radius = Math.max(2, Math.round(size * 4 / 30))
  const inset2 = Math.round(size * 11 / 30)
  const inset2Radius = Math.max(1, Math.round(size * 2 / 30))

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: outerRadius,
        background: 'conic-gradient(from 200deg at 50% 50%, #10A37F 0deg, #4285F4 90deg, #D97757 180deg, #E7E7E7 270deg, #10A37F 360deg)',
        position: 'relative',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: inset1,
          borderRadius: inset1Radius,
          background: 'var(--bg, #0E0E11)',
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: inset2,
          borderRadius: inset2Radius,
          background: 'linear-gradient(135deg, #fff, #aaa)',
          zIndex: 1,
        }}
      />
    </div>
  )
}
