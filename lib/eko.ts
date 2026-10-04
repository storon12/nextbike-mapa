import { haversineKm } from './geo'
import type { Ride } from './rides'

// Výchozí hodnoty z ekonomika_config.csv původního EKO modelu.
export const DEFAULT_CONFIG = {
  benefit_zdravi_km: 0.94,
  benefit_emise_km: 0.24,
  benefit_zamestnanost_jizda: 2.9,
  hodnota_casu_hod: 320,
  hodnota_flexibility_jizda: 0.5,
  uspora_vlastni_kolo_km: 1.5,
  uspora_auto_km: 6.5,
  benefit_multimodalita_jizda: 1,
  benefit_maloobchod_jizda: 1.5,
  benefit_bezpecnost_jizda: 1.5,
}
export type EkoConfig = typeof DEFAULT_CONFIG

export type Shares = { chuze: number; auto: number; mhd: number; kolo: number; nerealizovano: number }
export const DEFAULT_SHARES: Shares = { chuze: 50, auto: 10, mhd: 10, kolo: 10, nerealizovano: 20 }

export type CostModel =
  | { mode: 'project'; total: number; months: number }
  | { mode: 'bike'; perBike: number; bikes: number }
  | { mode: 'ride'; perRide: number }

export const MAX_RIDE_KM = 5
const DETOUR = 1.3

// Vzdušná vzdálenost × 1,3 (zakřivení trasy), oříznutá na 5 km. Jízdy bez
// cílové polohy mají vzdálenost 0 (původní model jim omylem počítal 5 km).
export function rideKm(r: Ride): number {
  if (!Number.isFinite(r.eLat)) return 0
  return Math.min(haversineKm(r.sLat, r.sLng, r.eLat, r.eLng) * DETOUR, MAX_RIDE_KM)
}

export type Benefits = {
  health: number
  eco: number
  jobs: number
  time: number
  flexibility: number
  savingsCar: number
  savingsBike: number
  ptBoost: number
  retail: number
  safety: number
  total: number
}

export function benefits(count: number, km: number, c: EkoConfig, sh: Shares): Benefits {
  const ecoShare = (sh.auto + sh.mhd) / 100
  const health = km * c.benefit_zdravi_km
  const eco = km * ecoShare * c.benefit_emise_km
  const jobs = count * c.benefit_zamestnanost_jizda
  const time = ((km * sh.chuze) / 100 / 6) * c.hodnota_casu_hod
  const flexibility = count * c.hodnota_flexibility_jizda
  const savingsBike = ((km * sh.kolo) / 100) * c.uspora_vlastni_kolo_km
  const savingsCar = ((km * sh.auto) / 100) * c.uspora_auto_km
  const ptBoost = ((count * sh.auto) / 100) * c.benefit_multimodalita_jizda
  const retail = count * ecoShare * c.benefit_maloobchod_jizda
  const safety = count * c.benefit_bezpecnost_jizda
  const total = health + eco + jobs + time + flexibility + savingsBike + savingsCar + ptBoost + retail + safety
  return { health, eco, jobs, time, flexibility, savingsCar, savingsBike, ptBoost, retail, safety, total }
}

export function dailyFixedCost(cost: CostModel): number {
  if (cost.mode === 'project') return cost.months > 0 ? cost.total / (cost.months * 30) : 0
  if (cost.mode === 'bike') return (cost.perBike * cost.bikes) / 30
  return 0
}

export function costFor(cost: CostModel, rides: number, days: number): number {
  return cost.mode === 'ride' ? rides * cost.perRide : dailyFixedCost(cost) * days
}
