'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { parseRentalsFile, type FileReport, type Ride } from './rides'
import { detectAreas, loadStations, type Area, type StationData } from './geo'

type SavedFile = { report: FileReport; rides: Ride[] }
type Saved = { files: SavedFile[] }

// Nahraná data zůstávají jen v IndexedDB tohoto prohlížeče, aby se po návratu
// na stránku nemusela nahrávat znovu. Na server se nic neposílá.
const DB_NAME = 'nextbike-mapa'
const STORE = 'data'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  try {
    const db = await openDb()
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result as T)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return undefined
  }
}

type DataState = {
  ready: boolean
  busy: boolean
  error: string | null
  rides: Ride[]
  reports: FileReport[]
  areas: Area[]
  rideArea: Int32Array
  stations: StationData | null
  addFiles: (files: File[]) => Promise<void>
  removeFile: (name: string) => void
  dismissError: () => void
}

const DataContext = createContext<DataState | null>(null)

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<Saved>({ files: [] })
  const [stations, setStations] = useState<StationData | null>(null)

  useEffect(() => {
    if (window.location.pathname === '/login') return
    loadStations().then(setStations).catch(() => setError('Seznam stanic se nepodařilo načíst. Zkus stránku obnovit.'))
    idb<Saved>('readonly', (s) => s.get('saved')).then((v) => {
      if (v?.files?.length) setSaved(v)
      setReady(true)
    })
  }, [])

  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return
    setBusy(true)
    setError(null)
    try {
      const results = await Promise.allSettled(files.map(parseRentalsFile))
      const errors = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map((r) => String(r.reason?.message ?? r.reason))
      const ok = results.filter((r): r is PromiseFulfilledResult<{ rides: Ride[]; report: FileReport }> => r.status === 'fulfilled').map((r) => r.value)
      if (errors.length) setError(errors.join(' '))
      if (!ok.length) return
      setSaved((prev) => {
        // Soubor se stejným názvem nahradí předchozí verzi, ostatní zůstanou.
        const names = new Set(ok.map((o) => o.report.file))
        const next = { files: [...prev.files.filter((f) => !names.has(f.report.file)), ...ok] }
        void idb('readwrite', (s) => s.put(next, 'saved'))
        return next
      })
    } finally {
      setBusy(false)
    }
  }, [])

  const removeFile = useCallback((name: string) => {
    setSaved((prev) => {
      const next = { files: prev.files.filter((f) => f.report.file !== name) }
      void idb('readwrite', (s) => (next.files.length ? s.put(next, 'saved') : s.delete('saved')))
      return next
    })
  }, [])

  // Stejná výpůjčka ve více souborech se započítá jen jednou.
  const rides = useMemo(() => {
    if (saved.files.length === 1) return saved.files[0].rides
    const byId = new Map<number, Ride>()
    for (const f of saved.files) for (const r of f.rides) byId.set(r.id, r)
    return [...byId.values()].sort((a, b) => a.t0 - b.t0)
  }, [saved])

  const { areas, rideArea } = useMemo(
    () => (stations && rides.length ? detectAreas(rides, stations.cities) : { areas: [], rideArea: new Int32Array(0) }),
    [rides, stations],
  )

  const value: DataState = {
    ready, busy, error, stations, areas, rideArea,
    rides, reports: saved.files.map((f) => f.report),
    addFiles, removeFile, dismissError: () => setError(null),
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}
