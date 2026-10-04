'use client'

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { nf } from '@/lib/rides'
import type { Shares } from '@/lib/eko'

const axis = { fill: 'var(--muted)', fontSize: 12 }
const compact = new Intl.NumberFormat('cs-CZ', { notation: 'compact', maximumFractionDigits: 1 })
const tooltipStyle = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--ink)', fontSize: 13 },
  labelStyle: { color: 'var(--muted)' },
  cursor: { fill: 'var(--surface-2)' },
}

export default function EkoCharts({
  shares,
  hourly,
  timeline,
}: {
  shares: Shares
  hourly: { hour: string; value: number }[]
  timeline: { day: string; cost: number; benefit: number }[]
}) {
  const split = [
    { mode: 'Chůze', value: shares.chuze },
    { mode: 'Auto', value: shares.auto },
    { mode: 'MHD', value: shares.mhd },
    { mode: 'Vlastní kolo', value: shares.kolo },
    { mode: 'Nová cesta', value: shares.nerealizovano },
  ]
  const crossing = timeline.find((d) => d.benefit >= d.cost && d.cost > 0)

  return (
    <section className="charts">
      <figure className="chart">
        <figcaption>
          <b>Bod zlomu</b>
          <span className="muted">
            Kumulované přínosy a platby města.{' '}
            {crossing ? <>Přínosy dohnaly platby {crossing.day}</> : timeline.at(-1) && timeline.at(-1)!.benefit < timeline.at(-1)!.cost ? 'V tomto období přínosy platby nedohnaly.' : ''}
          </span>
        </figcaption>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={timeline} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="day" tick={axis} tickLine={false} axisLine={{ stroke: 'var(--line)' }} minTickGap={24} />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => compact.format(v)} />
            <Tooltip {...tooltipStyle} cursor={{ stroke: 'var(--line)' }} formatter={(v) => `${nf.format(Number(v))} Kč`} />
            <Legend wrapperStyle={{ fontSize: 13, color: 'var(--muted)' }} />
            <Line isAnimationActive={false} type="monotone" dataKey="benefit" name="Přínosy" stroke="var(--good)" strokeWidth={2.5} dot={false} />
            <Line isAnimationActive={false} type="monotone" dataKey="cost" name="Platby města" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </figure>

      <figure className="chart">
        <figcaption>
          <b>Přínos podle hodiny</b>
          <span className="muted">Podle začátku jízdy, za celé zvolené období.</span>
        </figcaption>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={hourly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="hour" tick={axis} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval={2} />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => compact.format(v)} />
            <Tooltip {...tooltipStyle} labelFormatter={(h) => `${h}:00–${h}:59`} formatter={(v) => [`${nf.format(Number(v))} Kč`, 'Přínos']} />
            <Bar isAnimationActive={false} dataKey="value" fill="var(--brand)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </figure>

      <figure className="chart">
        <figcaption>
          <b>Čím kolo nahradilo cestu</b>
          <span className="muted">Co by lidé zvolili, kdyby sdílená kola nebyla.</span>
        </figcaption>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={split} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
            <XAxis type="number" hide domain={[0, 100]} />
            <YAxis type="category" dataKey="mode" tick={axis} tickLine={false} axisLine={false} width={92} />
            <Tooltip {...tooltipStyle} formatter={(v) => [`${v} %`, 'Podíl']} />
            <Bar isAnimationActive={false} dataKey="value" fill="var(--accent)" radius={[0, 3, 3, 0]} label={{ position: 'right', fill: 'var(--muted)', fontSize: 12, formatter: (v: unknown) => `${v} %` }} />
          </BarChart>
        </ResponsiveContainer>
      </figure>
    </section>
  )
}
