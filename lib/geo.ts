import type { Ride } from './rides'

export type City = { name: string; lat: number; lng: number; n: number }
export type Station = { city: number; lat: number; lng: number; name: string }
export type StationData = { cities: City[]; stations: Station[] }

export type Area = {
  name: string
  lat: number
  lng: number
  cityIndex: number // -1 = jízdy daleko od všech známých stanic
  rides: number
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const toRad = Math.PI / 180
  const dLat = (lat2 - lat1) * toRad
  const dLng = (lng2 - lng1) * toRad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

let stationsPromise: Promise<StationData> | null = null

export function loadStations(): Promise<StationData> {
  stationsPromise ??= fetch('/stations.json')
    .then((r) => r.json())
    .then((raw: { cities: City[]; stations: [number, number, number, string][] }) => ({
      cities: raw.cities,
      stations: raw.stations.map(([city, lat, lng, name]) => ({ city, lat, lng, name })),
    }))
  return stationsPromise
}

const MAX_CITY_KM = 30

// Každou jízdu přiřadí k nejbližšímu městu se stanicemi Nextbike (podle místa
// startu). Výsledek je pole měst seřazené podle počtu jízd a pole indexů pro jízdy.
export function detectAreas(rides: Ride[], cities: City[]): { areas: Area[]; rideArea: Int32Array } {
  // Hrubá mřížka po 0,5° zrychlí hledání nejbližšího města.
  const grid = new Map<string, number[]>()
  const key = (lat: number, lng: number) => `${Math.floor(lat * 2)}:${Math.floor(lng * 2)}`
  cities.forEach((c, i) => {
    const k = key(c.lat, c.lng)
    const list = grid.get(k)
    if (list) list.push(i)
    else grid.set(k, [i])
  })

  const cache = new Map<string, number>()
  const nearest = (lat: number, lng: number) => {
    const ck = `${lat.toFixed(3)}:${lng.toFixed(3)}`
    const hit = cache.get(ck)
    if (hit !== undefined) return hit
    const gy = Math.floor(lat * 2), gx = Math.floor(lng * 2)
    let best = -1, bestD = MAX_CITY_KM
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const i of grid.get(`${gy + dy}:${gx + dx}`) ?? []) {
          const d = haversineKm(lat, lng, cities[i].lat, cities[i].lng)
          if (d < bestD) { bestD = d; best = i }
        }
      }
    }
    cache.set(ck, best)
    return best
  }

  const rideArea = new Int32Array(rides.length)
  const counts = new Map<number, number>()
  rides.forEach((r, i) => {
    const c = nearest(r.sLat, r.sLng)
    rideArea[i] = c
    counts.set(c, (counts.get(c) ?? 0) + 1)
  })

  const areas: Area[] = [...counts.entries()]
    .map(([ci, n]) => {
      if (ci >= 0) return { name: cities[ci].name, lat: cities[ci].lat, lng: cities[ci].lng, cityIndex: ci, rides: n }
      const own = rides.filter((_, i) => rideArea[i] === -1)
      return {
        name: 'Mimo známé stanice',
        lat: own.reduce((s, r) => s + r.sLat, 0) / own.length,
        lng: own.reduce((s, r) => s + r.sLng, 0) / own.length,
        cityIndex: -1,
        rides: n,
      }
    })
    .sort((a, b) => b.rides - a.rides)

  return { areas, rideArea }
}
