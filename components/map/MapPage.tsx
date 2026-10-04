'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '@/lib/store'
import { dayKey, dayStart, formatClock, formatDay, nf } from '@/lib/rides'
import { buildTrips, ridesOverlappingDay, startHistogram, type LngLat } from '@/lib/trips'
import { describeWeather, getWeather, type DayWeather } from '@/lib/weather'
import { useDarkMode } from '@/lib/useDarkMode'
import { PickFiles } from '@/components/AppShell'
import Timeline from './Timeline'
import type { MapCanvasHandle } from './MapCanvas'

const MapCanvas = dynamic(() => import('./MapCanvas'), { ssr: false })

const SPEEDS = [30, 60, 120, 300, 600, 1200]
const START_TIME = 6 * 3600

export default function MapPage() {
  const { ready, rides, areas, rideArea, stations } = useData()
  const dark = useDarkMode()
  const handle = useRef<MapCanvasHandle | null>(null)

  const [areaName, setAreaName] = useState<string | null>(null)
  const area = areas.find((a) => a.name === areaName) ?? areas[0] ?? null
  const cityIndex = area?.cityIndex ?? null

  const areaRides = useMemo(
    () => (cityIndex === null ? [] : rides.filter((_, i) => rideArea[i] === cityIndex)),
    [rides, rideArea, cityIndex],
  )

  const days = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of areaRides) {
      const k = dayKey(r.t0)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => a.key.localeCompare(b.key))
  }, [areaRides])

  const busiest = useMemo(() => days.reduce<{ key: string; count: number } | null>((m, d) => (!m || d.count > m.count ? d : m), null), [days])
  const [dayChoice, setDayChoice] = useState<string | null>(null)
  const day = days.some((d) => d.key === dayChoice) ? dayChoice! : busiest?.key ?? null
  const dayIndex = days.findIndex((d) => d.key === day)

  const trips = useMemo(() => {
    if (!day) return []
    const start = dayStart(day)
    return buildTrips(ridesOverlappingDay(areaRides, start), start)
  }, [areaRides, day])

  const histogram = useMemo(() => startHistogram(trips), [trips])
  const starts = useMemo(() => trips.map((t) => t.a).filter((a) => a >= 0 && a < 86_400), [trips])

  const areaStations = useMemo(
    () => (stations && cityIndex !== null && cityIndex >= 0 ? stations.stations.filter((s) => s.city === cityIndex) : []),
    [stations, cityIndex],
  )

  // --- Přehrávání ---
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(300)
  const [clock, setClock] = useState(START_TIME)
  const [active, setActive] = useState(0)
  const timeRef = useRef(START_TIME)
  const playingRef = useRef(playing)
  const speedRef = useRef(speed)
  const dirty = useRef(true)
  useEffect(() => {
    playingRef.current = playing
    speedRef.current = speed
    dirty.current = true
  }, [playing, speed])

  useEffect(() => { dirty.current = true }, [trips, areaStations, dark])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastUi = 0
    const tick = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000)
      last = now
      if (playingRef.current) {
        timeRef.current += dt * speedRef.current
        if (timeRef.current >= 86_399) {
          timeRef.current = 86_399
          setPlaying(false)
        }
        dirty.current = true
      }
      if (dirty.current && handle.current) {
        dirty.current = false
        const n = handle.current.draw(timeRef.current, speedRef.current)
        if (now - lastUi > 100 || !playingRef.current) {
          lastUi = now
          setClock(timeRef.current)
          setActive(n)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const seek = (t: number) => {
    timeRef.current = Math.max(0, Math.min(86_399, t))
    dirty.current = true
  }

  const togglePlay = () => {
    if (!playing && timeRef.current >= 86_399) seek(0)
    setPlaying((p) => !p)
  }

  // Po změně města přiblížit mapu na oblast, kde se jezdí.
  useEffect(() => {
    if (!area) return
    const lats = areaRides.map((r) => r.sLat).sort((a, b) => a - b)
    const lngs = areaRides.map((r) => r.sLng).sort((a, b) => a - b)
    const q = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))]
    const bounds: [LngLat, LngLat] | null = lats.length > 5 ? [[q(lngs, 0.05), q(lats, 0.05)], [q(lngs, 0.95), q(lats, 0.95)]] : null
    const id = setTimeout(() => handle.current?.fitTo(bounds, [area.lng, area.lat]), 50)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityIndex, areaRides.length])

  // Klávesy: mezerník = přehrát/zastavit, šipky = ±5 min.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, select, textarea, button, [role="slider"]')) return
      if (e.code === 'Space') { e.preventDefault(); togglePlay() }
      if (e.key === 'ArrowRight') seek(timeRef.current + 300)
      if (e.key === 'ArrowLeft') seek(timeRef.current - 300)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // --- Počasí ---
  const [weather, setWeather] = useState<{ key: string; data: DayWeather | null } | null>(null)
  const weatherKey = area && day ? `${area.name}|${day}` : null
  useEffect(() => {
    if (!area || !day || !weatherKey) return
    let alive = true
    getWeather(area.lat, area.lng, day).then((data) => { if (alive) setWeather({ key: weatherKey, data }) })
    return () => { alive = false }
  }, [area, day, weatherKey])
  const hour = Math.min(23, Math.floor(clock / 3600))
  const w = weather?.key === weatherKey ? weather.data : undefined

  const startedSoFar = useMemo(() => {
    let lo = 0, hi = starts.length
    while (lo < hi) { const mid = (lo + hi) >> 1; if (starts[mid] <= clock) lo = mid + 1; else hi = mid }
    return lo
  }, [starts, clock])

  const hasData = ready && rides.length > 0

  return (
    <div className="map-page">
      <MapCanvas handleRef={handle} trips={trips} stations={areaStations} dark={dark} />

      {ready && !hasData && <EmptyState />}

      {hasData && area && day && (
        <>
          <section className="panel stats-panel" aria-label="Přehled">
            <div className="field">
              <label className="label" htmlFor="area">Město</label>
              <select id="area" value={area.name} onChange={(e) => { setAreaName(e.target.value); setDayChoice(null) }}>
                {areas.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name} ({nf.format(a.rides)} jízd)
                  </option>
                ))}
              </select>
            </div>
            <div className="stats">
              <div className="stat">
                <span className="label">Na cestě</span>
                <span className="stat-value num">{nf.format(active)}</span>
                <span className="stat-unit">{active === 1 ? 'kolo' : active >= 2 && active <= 4 ? 'kola' : 'kol'}</span>
              </div>
              <div className="stat">
                <span className="label">Půjčeno</span>
                <span className="stat-value num">{nf.format(startedSoFar)}</span>
                <span className="stat-unit num">z {nf.format(starts.length)} za den</span>
              </div>
              <div className="stat">
                <span className="label">Počasí {String(hour).padStart(2, '0')}:00</span>
                {w === undefined ? (
                  <span className="stat-value muted">…</span>
                ) : w && Number.isFinite(w.temp[hour]) ? (
                  <>
                    <span className="stat-value num">{w.temp[hour].toFixed(0)}&nbsp;°C</span>
                    <span className="stat-unit">{describeWeather(w.code[hour])}</span>
                  </>
                ) : (
                  <span className="stat-unit">nedostupné</span>
                )}
              </div>
            </div>
          </section>

          <section className="panel player" aria-label="Přehrávání">
            <div className="player-row">
              <button className="play" onClick={togglePlay} aria-label={playing ? 'Zastavit' : 'Přehrát'}>
                {playing ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" /></svg>
                )}
              </button>
              <div className="clock mono" aria-live="off">{formatClock(clock)}</div>
              <div className="day-nav">
                <button className="btn btn-ghost icon" disabled={dayIndex <= 0} onClick={() => setDayChoice(days[dayIndex - 1].key)} aria-label="Předchozí den">‹</button>
                <select aria-label="Den" value={day} onChange={(e) => setDayChoice(e.target.value)}>
                  {days.map((d) => (
                    <option key={d.key} value={d.key}>
                      {formatDay(d.key)} · {nf.format(d.count)} jízd{d.key === busiest?.key ? ' (nejvíc)' : ''}
                    </option>
                  ))}
                </select>
                <button className="btn btn-ghost icon" disabled={dayIndex >= days.length - 1} onClick={() => setDayChoice(days[dayIndex + 1].key)} aria-label="Další den">›</button>
              </div>
              <div className="speeds" role="radiogroup" aria-label="Rychlost přehrávání">
                {SPEEDS.map((s) => (
                  <button key={s} role="radio" aria-checked={speed === s} className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>
                    {s}×
                  </button>
                ))}
              </div>
            </div>
            <Timeline bins={histogram} time={clock} onSeek={seek} />
          </section>
        </>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="empty-wrap">
      <div className="empty">
        <h1>Přehrání výpůjček na mapě</h1>
        <p>
          Nahraj export výpůjček z Nextbike („Rentals – All Rentals… Raw Data“). Aplikace sama pozná město a ukáže, jak se kola během dne
          pohybovala.
        </p>
        <PickFiles className="dropzone">
          <strong>Vyber soubor CSV nebo ho sem přetáhni</strong>
          <span className="muted">Můžeš nahrát i víc souborů najednou, třeba více měst nebo měsíců.</span>
        </PickFiles>
        <p className="privacy">
          Soubor se zpracuje jen v tomto prohlížeči a nikam se neodesílá. Jména, e-maily a telefony zákazníků se při načtení zahodí.
        </p>
      </div>
    </div>
  )
}
