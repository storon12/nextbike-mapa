import type { Metadata } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import 'maplibre-gl/dist/maplibre-gl.css'
import './globals.css'
import { DataProvider } from '@/lib/store'
import AppShell from '@/components/AppShell'

const plexSans = IBM_Plex_Sans({
  variable: '--font-plex-sans',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
})

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'Nextbike – mapa jízd',
  description: 'Přehrávání výpůjček sdílených kol na mapě a socioekonomická analýza.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="cs" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <DataProvider>
          <AppShell>{children}</AppShell>
        </DataProvider>
      </body>
    </html>
  )
}
