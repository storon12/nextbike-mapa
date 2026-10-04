'use client'

import { useEffect, useImperativeHandle, useRef, type RefObject } from 'react'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { ScatterplotLayer } from '@deck.gl/layers'
import { TripsLayer } from '@deck.gl/geo-layers'
import type { PickingInfo } from '@deck.gl/core'
import type { Station } from '@/lib/geo'
import { positionAt, type LngLat, type Trip } from '@/lib/trips'
import { formatClock } from '@/lib/rides'

export type MapCanvasHandle = {
  draw: (t: number, speed: number) => number
  fitTo: (bounds: [LngLat, LngLat] | null, center: LngLat, zoom?: number) => void
}

type Props = {
  handleRef: RefObject<MapCanvasHandle | null>
  trips: Trip[]
  stations: Station[]
  dark: boolean
}

type Head = { trip: Trip; pos: LngLat }
type Pulse = { pos: LngLat; age: number; kind: 'start' | 'end' }

const STYLE = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}

type RGB = [number, number, number]
const PALETTE: Record<'light' | 'dark', { bike: RGB; station: RGB; start: RGB; end: RGB; halo: RGB }> = {
  light: { bike: [228, 0, 124], station: [0, 95, 149], start: [228, 0, 124], end: [0, 95, 149], halo: [255, 255, 255] },
  dark: { bike: [255, 61, 159], station: [79, 176, 230], start: [255, 61, 159], end: [79, 176, 230], halo: [10, 15, 31] },
}

// Délky efektů v reálných sekundách; přepočítávají se podle rychlosti přehrávání,
// aby stopa a záblesky vypadaly stejně při 30× i 1200×.
const TRAIL_REAL_S = 1.5
const PULSE_REAL_S = 1.4

function tooltip(info: PickingInfo) {
  const head = info.object as Head | undefined
  if (!head?.trip) return null
  const t = head.trip
  const dur = Math.round((t.b - t.a) / 60)
  return {
    html: `<div style="font-weight:600">${escapeHtml(t.from || '?')} → ${escapeHtml(t.loop ? 'zpět na stejné místo' : t.to || '?')}</div>
      <div>${formatClock(((t.a % 86400) + 86400) % 86400)}–${formatClock(((t.b % 86400) + 86400) % 86400)} · ${dur} min · kolo ${t.bike || '?'}</div>`,
    style: {
      background: 'var(--surface)',
      color: 'var(--ink)',
      border: '1px solid var(--line)',
      borderRadius: '8px',
      padding: '8px 10px',
      fontFamily: 'var(--font-sans)',
      fontSize: '13px',
      boxShadow: 'var(--shadow)',
    },
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export default function MapCanvas({ handleRef, trips, stations, dark }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const props = useRef({ trips, stations, dark })
  useEffect(() => {
    props.current = { trips, stations, dark }
  }, [trips, stations, dark])

  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current!,
      style: dark ? STYLE.dark : STYLE.light,
      center: [15.5, 49.8],
      zoom: 6.5,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    const overlay = new MapboxOverlay({ interleaved: false, layers: [], getTooltip: tooltip })
    map.addControl(overlay)
    mapRef.current = map
    overlayRef.current = overlay
    return () => {
      map.remove()
      mapRef.current = null
      overlayRef.current = null
    }
    // Mapa se vytváří jen jednou; změnu motivu řeší efekt níže.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const styledDark = useRef(dark)
  useEffect(() => {
    if (styledDark.current === dark) return
    styledDark.current = dark
    mapRef.current?.setStyle(dark ? STYLE.dark : STYLE.light)
  }, [dark])

  useImperativeHandle(handleRef, () => ({
    fitTo(bounds, center, zoom = 13) {
      const map = mapRef.current
      if (!map) return
      if (bounds) map.fitBounds(bounds, { padding: { top: 120, bottom: 200, left: 60, right: 60 }, maxZoom: 15, duration: 600 })
      else map.jumpTo({ center, zoom })
    },
    draw(t, speed) {
      const overlay = overlayRef.current
      if (!overlay) return 0
      const { trips, stations, dark } = props.current
      const c = PALETTE[dark ? 'dark' : 'light']
      const pulseLen = PULSE_REAL_S * speed

      const heads: Head[] = []
      const pulses: Pulse[] = []
      for (const trip of trips) {
        if (trip.a > t) break // jízdy jsou seřazené podle začátku
        if (t <= trip.b) heads.push({ trip, pos: positionAt(trip, t) })
        const sinceStart = t - trip.a
        if (sinceStart <= pulseLen) pulses.push({ pos: trip.path[0], age: sinceStart / pulseLen, kind: 'start' })
        const sinceEnd = t - trip.b
        if (sinceEnd >= 0 && sinceEnd <= pulseLen) pulses.push({ pos: trip.path[trip.path.length - 1], age: sinceEnd / pulseLen, kind: 'end' })
      }

      overlay.setProps({
        layers: [
          new ScatterplotLayer<Station>({
            id: 'stations',
            data: stations,
            getPosition: (s) => [s.lng, s.lat],
            getRadius: 4,
            radiusUnits: 'pixels',
            getFillColor: [...c.station, 150],
            stroked: true,
            getLineColor: [...c.halo, 200],
            lineWidthUnits: 'pixels',
            getLineWidth: 1,
          }),
          new TripsLayer<Trip>({
            id: 'trails',
            data: trips,
            getPath: (d) => d.path,
            getTimestamps: (d) => d.ts,
            getColor: c.bike,
            opacity: 0.55,
            widthUnits: 'pixels',
            getWidth: 3,
            capRounded: true,
            jointRounded: true,
            fadeTrail: true,
            trailLength: Math.max(90, TRAIL_REAL_S * speed),
            currentTime: t,
          }),
          new ScatterplotLayer<Pulse>({
            id: 'pulses',
            data: pulses,
            getPosition: (p) => p.pos,
            getRadius: (p) => 6 + p.age * 18,
            radiusUnits: 'pixels',
            filled: false,
            stroked: true,
            lineWidthUnits: 'pixels',
            getLineWidth: 2,
            getLineColor: (p) => [...(p.kind === 'start' ? c.start : c.end), Math.round(220 * (1 - p.age))],
          }),
          new ScatterplotLayer<Head>({
            id: 'bikes',
            data: heads,
            pickable: true,
            getPosition: (h) => h.pos,
            getRadius: 6,
            radiusUnits: 'pixels',
            getFillColor: c.bike,
            stroked: true,
            getLineColor: c.halo,
            lineWidthUnits: 'pixels',
            getLineWidth: 2,
          }),
        ],
      })
      return heads.length
    },
  }))

  return <div ref={container} className="map-canvas" />
}
