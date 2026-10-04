import { haversineKm } from './geo'
import { DAY_MS, type Ride } from './rides'

export type LngLat = [number, number]

// Jízda připravená pro animaci jednoho dne. Časy a/b jsou sekundy od půlnoci
// zvoleného dne (mohou být záporné nebo přes 86 400 u jízd přes půlnoc).
export type Trip = {
  id: number
  bike: number
  from: string
  to: string
  a: number
  b: number
  path: LngLat[]
  ts: number[]
  loop: boolean
}

const LOOP_POINTS = 16
const SAME_PLACE_KM = 0.06

function hash(n: number) {
  let x = n | 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

export function ridesOverlappingDay(rides: Ride[], dayStartMs: number): Ride[] {
  const end = dayStartMs + DAY_MS
  return rides.filter((r) => r.t0 < end && r.t1 > dayStartMs && Number.isFinite(r.eLat))
}

export function buildTrips(rides: Ride[], dayStartMs: number): Trip[] {
  return rides.map((r) => {
    const a = (r.t0 - dayStartMs) / 1000
    const b = Math.max(a + 1, (r.t1 - dayStartMs) / 1000)
    const start: LngLat = [r.sLng, r.sLat]
    const end: LngLat = [r.eLng, r.eLat]
    const base = { id: r.id, bike: r.bike, from: r.from, to: r.to, a, b }

    if (haversineKm(r.sLat, r.sLng, r.eLat, r.eLng) > SAME_PLACE_KM) {
      return { ...base, path: [start, end], ts: [a, b], loop: false }
    }

    // Vrácení na stejné místo: kruhová smyčka procházející startem. Poloměr
    // odpovídá délce jízdy při ~12 km/h, omezený na 120–700 m.
    const radiusM = Math.min(700, Math.max(120, ((b - a) * 3.3) / (2 * Math.PI)))
    const dLat = radiusM / 111_320
    const dLng = radiusM / (111_320 * Math.cos((r.sLat * Math.PI) / 180))
    const theta = hash(r.id) * 2 * Math.PI
    const cLng = r.sLng + Math.cos(theta) * dLng
    const cLat = r.sLat + Math.sin(theta) * dLat
    const path: LngLat[] = []
    const ts: number[] = []
    for (let k = 0; k <= LOOP_POINTS; k++) {
      const ang = theta + Math.PI + (2 * Math.PI * k) / LOOP_POINTS
      path.push(k === 0 || k === LOOP_POINTS ? start : [cLng + Math.cos(ang) * dLng, cLat + Math.sin(ang) * dLat])
      ts.push(a + ((b - a) * k) / LOOP_POINTS)
    }
    return { ...base, path, ts, loop: true }
  })
}

export function positionAt(trip: Trip, t: number): LngLat {
  const { path, ts } = trip
  if (t <= ts[0]) return path[0]
  const last = ts.length - 1
  if (t >= ts[last]) return path[last]
  let i = 1
  while (ts[i] < t) i++
  const f = (t - ts[i - 1]) / (ts[i] - ts[i - 1])
  return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f]
}

// Počet výpůjček začínajících v každém 15minutovém úseku dne.
export function startHistogram(trips: Trip[], bins = 96): number[] {
  const out = new Array(bins).fill(0)
  const size = 86_400 / bins
  for (const t of trips) {
    if (t.a >= 0 && t.a < 86_400) out[Math.floor(t.a / size)]++
  }
  return out
}
