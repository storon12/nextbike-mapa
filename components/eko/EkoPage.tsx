'use client'

import { useMemo, useState } from 'react'
import { useData } from '@/lib/store'
import { DAY_MS, dayKey, dayStart, formatDay, nf } from '@/lib/rides'
import { benefits, costFor, DEFAULT_CONFIG, DEFAULT_SHARES, rideKm, type CostModel, type Shares } from '@/lib/eko'
import { PickFiles } from '@/components/AppShell'
import EkoCharts from './EkoCharts'
import Methodology from './Methodology'

const kc = (v: number) => `${nf.format(Math.round(v))} Kč`
const km1 = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 })

const SHARE_FIELDS: { key: keyof Shares; label: string }[] = [
  { key: 'chuze', label: 'Místo chůze' },
  { key: 'auto', label: 'Místo auta' },
  { key: 'mhd', label: 'Místo MHD' },
  { key: 'kolo', label: 'Místo vlastního kola' },
  { key: 'nerealizovano', label: 'Cesta by nebyla' },
]

const COST_PRESETS: Record<CostModel['mode'], { label: string; value: CostModel }> = {
  project: { label: 'Varianta 1: 1 mil. Kč na 10 měsíců', value: { mode: 'project', total: 1_000_000, months: 10 } },
  bike: { label: 'Varianta 2: 2 000 Kč za kolo, 30 kol', value: { mode: 'bike', perBike: 2000, bikes: 30 } },
  ride: { label: 'Varianta 3: 17 Kč za výpůjčku', value: { mode: 'ride', perRide: 17 } },
}

const ALL = '__all__'

export default function EkoPage() {
  const { ready, rides, areas, rideArea } = useData()

  const [areaName, setAreaName] = useState<string | null>(null)
  const area = areaName === ALL ? null : areas.find((a) => a.name === areaName) ?? areas[0] ?? null

  const areaRides = useMemo(
    () => (area ? rides.filter((_, i) => rideArea[i] === area.cityIndex) : rides),
    [rides, rideArea, area],
  )

  const bounds = useMemo(() => {
    if (!areaRides.length) return null
    return { min: dayKey(areaRides[0].t0), max: dayKey(areaRides[areaRides.length - 1].t0) }
  }, [areaRides])

  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const from = range && bounds && range.from >= bounds.min && range.from <= bounds.max ? range.from : bounds?.min ?? ''
  const to = range && bounds && range.to >= from && range.to <= bounds.max ? range.to : bounds?.max ?? ''

  const [cost, setCost] = useState<CostModel>(COST_PRESETS.project.value)
  const [shares, setShares] = useState<Shares>(DEFAULT_SHARES)
  const [timePct, setTimePct] = useState(100)
  const config = useMemo(() => ({ ...DEFAULT_CONFIG, hodnota_casu_hod: 320 * (timePct / 100) }), [timePct])
  const shareSum = Object.values(shares).reduce((s, v) => s + v, 0)

  const calc = useMemo(() => {
    if (!from || !to) return null
    const start = dayStart(from)
    const end = dayStart(to) + DAY_MS
    const days = Math.round((end - start) / DAY_MS)
    const perDay = new Map<string, { n: number; km: number }>()
    const perHour = Array.from({ length: 24 }, () => ({ n: 0, km: 0 }))
    let n = 0, km = 0, noEnd = 0, capped = 0
    for (const r of areaRides) {
      if (r.t0 < start || r.t0 >= end) continue
      const d = rideKm(r)
      if (!Number.isFinite(r.eLat)) noEnd++
      else if (d >= 5) capped++
      n++
      km += d
      const k = dayKey(r.t0)
      const pd = perDay.get(k) ?? { n: 0, km: 0 }
      pd.n++
      pd.km += d
      perDay.set(k, pd)
      const h = new Date(r.t0).getUTCHours()
      perHour[h].n++
      perHour[h].km += d
    }
    const b = benefits(n, km, config, shares)
    const c = costFor(cost, n, days)

    let cumB = 0, cumC = 0
    const timeline = Array.from({ length: days }, (_, i) => {
      const k = dayKey(start + i * DAY_MS)
      const pd = perDay.get(k) ?? { n: 0, km: 0 }
      cumB += benefits(pd.n, pd.km, config, shares).total
      cumC += costFor(cost, pd.n, 1)
      return { day: formatDay(k, { day: 'numeric', month: 'numeric' }), cost: Math.round(cumC), benefit: Math.round(cumB) }
    })
    const hourly = perHour.map((p, h) => ({ hour: `${h}`, value: Math.round(benefits(p.n, p.km, config, shares).total) }))
    return { n, km, days, noEnd, capped, b, c, net: b.total - c, timeline, hourly }
  }, [areaRides, from, to, config, shares, cost])

  if (ready && !rides.length) {
    return (
      <div className="eko-empty">
        <div className="empty">
          <h1>Eko analýza</h1>
          <p>Spočítá socioekonomické přínosy sdílených kol pro město z exportu výpůjček a porovná je s tím, kolik město za systém platí.</p>
          <PickFiles className="dropzone">
            <strong>Vyber soubor CSV nebo ho sem přetáhni</strong>
            <span className="muted">Stejná data pak uvidíš i na mapě jízd.</span>
          </PickFiles>
          <p className="privacy">Soubor se zpracuje jen v tomto prohlížeči a nikam se neodesílá.</p>
        </div>
      </div>
    )
  }
  if (!calc || !bounds) return null

  const { b } = calc
  const positive = calc.net >= 0
  const period = from === to ? formatDay(from, { day: 'numeric', month: 'numeric', year: 'numeric' }) : `${formatDay(from, { day: 'numeric', month: 'numeric', year: 'numeric' })} – ${formatDay(to, { day: 'numeric', month: 'numeric', year: 'numeric' })}`

  return (
    <div className="eko">
      <aside className="eko-settings" aria-label="Nastavení modelu">
        <fieldset>
          <legend>Data</legend>
          <div className="field">
            <label className="label" htmlFor="eko-area">Město</label>
            <select id="eko-area" value={area?.name ?? ALL} onChange={(e) => { setAreaName(e.target.value); setRange(null) }}>
              {areas.map((a) => (
                <option key={a.name} value={a.name}>{a.name} ({nf.format(a.rides)} jízd)</option>
              ))}
              {areas.length > 1 && <option value={ALL}>Všechna města ({nf.format(rides.length)} jízd)</option>}
            </select>
          </div>
          <div className="row2">
            <div className="field">
              <label className="label" htmlFor="eko-from">Od</label>
              <input id="eko-from" type="date" min={bounds.min} max={bounds.max} value={from} onChange={(e) => e.target.value && setRange({ from: e.target.value, to: e.target.value > to ? e.target.value : to })} />
            </div>
            <div className="field">
              <label className="label" htmlFor="eko-to">Do</label>
              <input id="eko-to" type="date" min={from} max={bounds.max} value={to} onChange={(e) => e.target.value && setRange({ from, to: e.target.value })} />
            </div>
          </div>
          {(from !== bounds.min || to !== bounds.max) && (
            <button className="btn btn-ghost link" onClick={() => setRange(null)}>Celé období v datech</button>
          )}
        </fieldset>

        <fieldset>
          <legend>Platby města</legend>
          <div className="segmented" role="radiogroup" aria-label="Způsob platby">
            {([['project', 'Paušál za projekt'], ['bike', 'Za kolo a měsíc'], ['ride', 'Za výpůjčku']] as const).map(([mode, label]) => (
              <button key={mode} role="radio" aria-checked={cost.mode === mode} className={cost.mode === mode ? 'on' : ''} onClick={() => cost.mode !== mode && setCost(COST_PRESETS[mode].value)}>
                {label}
              </button>
            ))}
          </div>
          {cost.mode === 'project' && (
            <div className="row2">
              <NumField id="c-total" label="Celková částka (Kč)" value={cost.total} step={10000} onChange={(v) => setCost({ ...cost, total: v })} />
              <NumField id="c-months" label="Délka projektu (měs.)" value={cost.months} step={1} onChange={(v) => setCost({ ...cost, months: v })} />
            </div>
          )}
          {cost.mode === 'bike' && (
            <div className="row2">
              <NumField id="c-perbike" label="Kč za kolo a měsíc" value={cost.perBike} step={100} onChange={(v) => setCost({ ...cost, perBike: v })} />
              <NumField id="c-bikes" label="Počet kol" value={cost.bikes} step={1} onChange={(v) => setCost({ ...cost, bikes: v })} />
            </div>
          )}
          {cost.mode === 'ride' && (
            <NumField id="c-perride" label="Dotace za výpůjčku (Kč)" value={cost.perRide} step={1} onChange={(v) => setCost({ ...cost, perRide: v })} />
          )}
          <button className="btn btn-ghost link" onClick={() => setCost(COST_PRESETS[cost.mode].value)}>{COST_PRESETS[cost.mode].label}</button>
          {cost.mode !== 'ride' && <p className="hint">Paušál se rozpočítá na dny (měsíc = 30 dní), aby šlo porovnat s přínosy za zvolené období.</p>}
        </fieldset>

        <fieldset>
          <legend>Čím kolo nahradilo cestu</legend>
          {SHARE_FIELDS.map((f) => (
            <div className="slider" key={f.key}>
              <label htmlFor={`sh-${f.key}`}>{f.label}</label>
              <output className="num" htmlFor={`sh-${f.key}`}>{shares[f.key]} %</output>
              <input id={`sh-${f.key}`} type="range" min={0} max={100} value={shares[f.key]} onChange={(e) => setShares({ ...shares, [f.key]: Number(e.target.value) })} />
            </div>
          ))}
          <div className={`sum ${shareSum === 100 ? 'ok' : 'bad'}`}>
            <span className="num">Součet {shareSum} %</span>
            {shareSum !== 100 && (
              <button className="btn btn-ghost link" onClick={() => setShares(normalize(shares))}>Upravit na 100 %</button>
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend>Hodnota času</legend>
          <div className="slider">
            <label htmlFor="time-pct">Cena času občanů</label>
            <output className="num" htmlFor="time-pct">{timePct} % = {nf.format(Math.round(config.hodnota_casu_hod))} Kč/h</output>
            <input id="time-pct" type="range" min={0} max={200} step={5} value={timePct} onChange={(e) => setTimePct(Number(e.target.value))} />
          </div>
        </fieldset>
      </aside>

      <div className="eko-results">
        <header className="eko-head">
          <div>
            <h1>{area ? area.name : 'Všechna města'}</h1>
            <p className="muted num">
              {period} · {nf.format(calc.days)} {calc.days === 1 ? 'den' : calc.days < 5 ? 'dny' : 'dní'} · {nf.format(calc.n)} výpůjček · {km1.format(calc.km)} km
            </p>
          </div>
        </header>

        {shareSum !== 100 && (
          <p className="warn">Podíly náhrady dávají dohromady {shareSum} % místo 100 %, výsledek proto není přesný.</p>
        )}

        <section className={`balance ${positive ? 'pos' : 'neg'}`}>
          <div className="label">Čistá společenská bilance pro město</div>
          <div className="balance-value num">{positive && calc.net > 0 ? '+' : ''}{kc(calc.net)}</div>
          <div className="balance-split">
            <div>
              <span className="label">Přínosy</span>
              <span className="num">{kc(b.total)}</span>
            </div>
            <div className="minus" aria-hidden="true">−</div>
            <div>
              <span className="label">Platby města</span>
              <span className="num">{kc(calc.c)}</span>
            </div>
          </div>
        </section>

        <section className="cats" aria-label="Rozpad přínosů">
          <Category title="Zdraví" value={b.health}>
            <p>Ujeté km × {DEFAULT_CONFIG.benefit_zdravi_km.toLocaleString('cs-CZ')} Kč.</p>
            <p className="hint">Odvrácené případy onemocnění podle koeficientů studie EY (2025):</p>
            <ul className="num">
              <li>Kardiovaskulární: {(calc.km * 256 / 1_060_000).toFixed(4)}</li>
              <li>Diabetes 2. typu: {(calc.km * 608 / 1_060_000).toFixed(4)}</li>
              <li>Rakovina prsu a střeva: {(calc.km * 74 / 1_060_000).toFixed(4)}</li>
              <li>Demence: {(calc.km * 30 / 1_060_000).toFixed(4)}</li>
            </ul>
          </Category>
          <Category title="Čas a flexibilita" value={b.time + b.flexibility}>
            <p>Ušetřený čas: <b className="num">{kc(b.time)}</b></p>
            <p>Hodnota zálohy (option value): <b className="num">{kc(b.flexibility)}</b></p>
            <p className="hint">Cena času {nf.format(Math.round(config.hodnota_casu_hod))} Kč/h.</p>
          </Category>
          <Category title="Ovzduší a bezpečí" value={b.eco + b.safety}>
            <p>Emise a prach: <b className="num">{kc(b.eco)}</b></p>
            <p>Bezpečnost ulic: <b className="num">{kc(b.safety)}</b></p>
            <p className="hint">EY 2025; Fishman & Schepers, 2018.</p>
          </Category>
          <Category title="Lokální ekonomika" value={b.jobs + b.ptBoost + b.retail}>
            <p>Mzdy technika: <b className="num">{kc(b.jobs)}</b></p>
            <p>Maloobchod: <b className="num">{kc(b.retail)}</b></p>
            <p>Bonus pro MHD: <b className="num">{kc(b.ptBoost)}</b></p>
          </Category>
          <Category title="Úspory občanů" value={b.savingsCar + b.savingsBike}>
            <p>Za auto: <b className="num">{kc(b.savingsCar)}</b></p>
            <p>Za vlastní kolo: <b className="num">{kc(b.savingsBike)}</b></p>
          </Category>
        </section>

        <EkoCharts shares={shares} hourly={calc.hourly} timeline={calc.timeline} />

        <p className="hint">
          Vzdálenost jízdy = vzdušná čára × 1,3, nejvýš 5 km ({nf.format(calc.capped)} jízd oříznuto).
          {calc.noEnd > 0 && <> U {nf.format(calc.noEnd)} jízd chybí cílová poloha; počítají se jako výpůjčka, ale bez ujetých km.</>}
        </p>

        <Methodology />
      </div>
    </div>
  )
}

function Category({ title, value, children }: { title: string; value: number; children: React.ReactNode }) {
  return (
    <details className="cat">
      <summary>
        <span className="label">{title}</span>
        <span className="cat-value num">{kc(value)}</span>
        <span className="cat-more">Detail</span>
      </summary>
      <div className="cat-body">{children}</div>
    </details>
  )
}

function NumField({ id, label, value, step, onChange }: { id: string; label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} type="number" min={0} step={step} value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} />
    </div>
  )
}

function normalize(sh: Shares): Shares {
  const total = Object.values(sh).reduce((s, v) => s + v, 0)
  if (!total) return DEFAULT_SHARES
  const out = Object.fromEntries(Object.entries(sh).map(([k, v]) => [k, Math.round((v * 100) / total)])) as Shares
  out.chuze += 100 - Object.values(out).reduce((s, v) => s + v, 0)
  return out
}
