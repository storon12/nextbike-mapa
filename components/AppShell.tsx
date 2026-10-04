'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useData } from '@/lib/store'
import { nf } from '@/lib/rides'

export function PickFiles({ className, children, id }: { className?: string; children: React.ReactNode; id?: string }) {
  const { addFiles, busy } = useData()
  const input = useRef<HTMLInputElement>(null)
  return (
    <label
      className={className}
      role="button"
      tabIndex={0}
      aria-disabled={busy}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click() }
      }}
    >
      <input
        ref={input}
        id={id}
        type="file"
        accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
        multiple
        hidden
        onChange={(e) => {
          void addFiles([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
      {children}
    </label>
  )
}

const NAV = [
  { href: '/', label: 'Mapa jízd' },
  { href: '/eko', label: 'Eko analýza' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { rides, reports, busy, error, dismissError, addFiles, removeFile } = useData()
  const [showFiles, setShowFiles] = useState(false)
  const [dragging, setDragging] = useState(false)
  const popRef = useRef<HTMLDivElement>(null)

  // Soubory jde přetáhnout kamkoliv na stránku.
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files')
    const enter = (e: DragEvent) => { if (hasFiles(e)) { depth++; setDragging(true) } }
    const leave = (e: DragEvent) => { if (hasFiles(e) && --depth <= 0) { depth = 0; setDragging(false) } }
    const over = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault() }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      void addFiles([...(e.dataTransfer?.files ?? [])])
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [addFiles])

  useEffect(() => {
    if (!showFiles) return
    const close = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node)) setShowFiles(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [showFiles])

  const excluded = reports.reduce((s, r) => s + r.invalid + r.noStart, 0)
  const noEnd = reports.reduce((s, r) => s + r.noEnd, 0)

  return (
    <div className="app">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Nextbike – mapa jízd">
          <span className="logo" aria-hidden="true" />
          <span>Nextbike</span>
        </Link>
        <nav className="nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={pathname === n.href ? 'page' : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="spacer" />
        {rides.length > 0 && (
          <div className="data-chip" ref={popRef}>
            <button className="btn btn-ghost" onClick={() => setShowFiles((v) => !v)} aria-expanded={showFiles}>
              <span className="fileinfo">
                {reports.length === 1 ? reports[0].file : `${reports.length} soubory`} ·{' '}
              </span>
              <b className="num">{nf.format(rides.length)}</b>&nbsp;jízd
            </button>
            {showFiles && (
              <div className="files-pop">
                <div className="label">Nahrané soubory</div>
                <ul>
                  {reports.map((r) => (
                    <li key={r.file}>
                      <span className="fname" title={r.file}>{r.file}</span>
                      <button className="btn btn-ghost" onClick={() => removeFile(r.file)}>Odebrat</button>
                      <span className="fmeta num">
                        {nf.format(r.kept)} jízd z {nf.format(r.rows)} řádků
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="note">
                  Vyřazeno {nf.format(excluded)} neplatných nebo nespuštěných výpůjček a duplicit.{' '}
                  {noEnd > 0 && <>U {nf.format(noEnd)} jízd chybí cílová poloha, na mapě se nezobrazí a do ujetých km se nepočítají. </>}
                  Data jsou uložená jen v tomto prohlížeči.
                </p>
                <PickFiles className="btn">Přidat další soubor</PickFiles>
              </div>
            )}
          </div>
        )}
        <PickFiles className={`btn ${rides.length ? '' : 'btn-primary'}`}>{busy ? 'Načítám…' : 'Nahrát data'}</PickFiles>
      </header>
      {error && (
        <div className="banner" role="alert">
          <p>{error}</p>
          <button className="btn btn-ghost" onClick={dismissError}>Zavřít</button>
        </div>
      )}
      <main className="main">{children}</main>
      {dragging && <div className="drop-overlay">Pusť soubor s výpůjčkami</div>}
    </div>
  )
}
