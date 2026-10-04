import Papa from 'papaparse'

// Jedna výpůjčka. Časy jsou "nástěnné" (Date.UTC z místního času v exportu),
// takže výpočty nezávisí na časovém pásmu prohlížeče.
export type Ride = {
  id: number
  t0: number
  t1: number
  sLat: number
  sLng: number
  eLat: number // NaN, když export cílovou polohu nemá
  eLng: number
  bike: number
  from: string
  to: string
}

export type FileReport = {
  file: string
  rows: number
  kept: number
  invalid: number
  duplicates: number
  noStart: number
  noEnd: number
}

const REQUIRED = ['uid', 'start_time', 'end_time', 'start_lat', 'start_lng', 'end_lat', 'end_lng']

function num(v: unknown): number {
  if (v == null) return NaN
  const s = String(v).trim().replace(',', '.')
  return s ? Number(s) : NaN
}

export function wallClock(v: unknown): number {
  const s = String(v ?? '').trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s)
  if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3], +iso[4], +iso[5], +(iso[6] ?? 0))
  const cz = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s)
  if (cz) return Date.UTC(+cz[3], +cz[2] - 1, +cz[1], +cz[4], +cz[5], +(cz[6] ?? 0))
  return NaN
}

export const validCoord = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180

// Z exportu se berou jen sloupce potřebné pro mapu a výpočty. Jména, e-maily,
// telefony a ID zákazníků se do paměti aplikace vůbec neuloží.
export function parseRentalsFile(file: File): Promise<{ rides: Ride[]; report: FileReport }> {
  return new Promise((resolve, reject) => {
    if (file.size === 0) {
      reject(new Error(`Soubor ${file.name} je prázdný.`))
      return
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const fields = res.meta.fields ?? []
        const missing = REQUIRED.filter((c) => !fields.includes(c))
        if (missing.length) {
          reject(new Error(`Soubor ${file.name} nevypadá jako export výpůjček z Nextbike (chybí sloupce: ${missing.join(', ')}).`))
          return
        }
        const report: FileReport = { file: file.name, rows: res.data.length, kept: 0, invalid: 0, duplicates: 0, noStart: 0, noEnd: 0 }
        const seen = new Set<number>()
        const rides: Ride[] = []
        for (const row of res.data) {
          const id = Number(row.uid)
          if (!Number.isFinite(id)) continue
          if (seen.has(id)) { report.duplicates++; continue }
          seen.add(id)
          if (row.invalid === '1') { report.invalid++; continue }
          const t0 = wallClock(row.start_time)
          const t1 = wallClock(row.end_time)
          const sLat = num(row.start_lat), sLng = num(row.start_lng)
          if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 < t0 || !validCoord(sLat, sLng)) { report.noStart++; continue }
          let eLat = num(row.end_lat), eLng = num(row.end_lng)
          if (!validCoord(eLat, eLng)) { eLat = NaN; eLng = NaN; report.noEnd++ }
          rides.push({
            id, t0, t1, sLat, sLng, eLat, eLng,
            bike: Number(row.bike_id) || 0,
            from: (row.start_place_id ?? '').trim(),
            to: (row.end_place_id ?? '').trim(),
          })
        }
        report.kept = rides.length
        rides.sort((a, b) => a.t0 - b.t0)
        resolve({ rides, report })
      },
      error: (err) => reject(new Error(`Soubor ${file.name} se nepodařilo přečíst: ${err.message}`)),
    })
  })
}

export const DAY_MS = 86_400_000

export function dayKey(t: number): string {
  return new Date(t).toISOString().slice(0, 10)
}

export function dayStart(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function formatDay(key: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' }) {
  return new Intl.DateTimeFormat('cs-CZ', { ...opts, timeZone: 'UTC' }).format(dayStart(key))
}

export function formatClock(sec: number, withSeconds = false) {
  const s = Math.max(0, Math.min(86399, Math.floor(sec)))
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  return withSeconds ? `${hh}:${mm}:${String(s % 60).padStart(2, '0')}` : `${hh}:${mm}`
}

export const nf = new Intl.NumberFormat('cs-CZ')
