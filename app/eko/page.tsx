import type { Metadata } from 'next'
import EkoPage from '@/components/eko/EkoPage'

export const metadata: Metadata = {
  title: 'Nextbike – eko analýza',
}

export default function Eko() {
  return <EkoPage />
}
