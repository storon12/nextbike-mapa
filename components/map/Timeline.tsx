'use client'

import { useRef } from 'react'
import { formatClock } from '@/lib/rides'

// Histogram výpůjček po 15 minutách; kliknutím nebo tažením se přeskočí na daný čas.
export default function Timeline({ bins, time, onSeek }: { bins: number[]; time: number; onSeek: (t: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const max = Math.max(1, ...bins)
  const W = bins.length * 10
  const H = 44
  const x = (time / 86_400) * W

  const seekFromPointer = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect()
    onSeek(((clientX - rect.left) / rect.width) * 86_400)
  }

  return (
    <div className="timeline">
      <div
        ref={ref}
        className="timeline-track"
        role="slider"
        tabIndex={0}
        aria-label="Čas"
        aria-valuemin={0}
        aria-valuemax={86_399}
        aria-valuenow={Math.round(time)}
        aria-valuetext={formatClock(time)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          seekFromPointer(e.clientX)
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) seekFromPointer(e.clientX)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); onSeek(time + 300) }
          if (e.key === 'ArrowLeft') { e.preventDefault(); onSeek(time - 300) }
          if (e.key === 'PageUp') { e.preventDefault(); onSeek(time + 3600) }
          if (e.key === 'PageDown') { e.preventDefault(); onSeek(time - 3600) }
          if (e.key === 'Home') { e.preventDefault(); onSeek(0) }
          if (e.key === 'End') { e.preventDefault(); onSeek(86_399) }
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          {[6, 12, 18].map((h) => (
            <line key={h} x1={(h / 24) * W} x2={(h / 24) * W} y1={0} y2={H} className="tl-grid" />
          ))}
          {bins.map((n, i) => {
            const h = n ? Math.max(2, (n / max) * (H - 4)) : 0
            return <rect key={i} x={i * 10 + 1} y={H - h} width={8} height={h} className={i * 10 + 5 < x ? 'tl-bar past' : 'tl-bar'} />
          })}
          <line x1={x} x2={x} y1={0} y2={H} className="tl-cursor" />
          <rect x={x - 5} y={0} width={10} height={3} className="tl-head" />
        </svg>
      </div>
      <div className="timeline-axis mono" aria-hidden="true">
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
    </div>
  )
}
