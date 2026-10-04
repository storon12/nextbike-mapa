export type DayWeather = { temp: number[]; code: number[] }

const cache = new Map<string, Promise<DayWeather | null>>()

async function fetchHourly(base: string, lat: number, lng: number, day: string): Promise<DayWeather | null> {
  const url = `${base}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&start_date=${day}&end_date=${day}&hourly=temperature_2m,weather_code&timezone=Europe%2FPrague`
  const res = await fetch(url)
  if (!res.ok) return null
  const json = await res.json()
  const temp: (number | null)[] = json?.hourly?.temperature_2m ?? []
  const code: (number | null)[] = json?.hourly?.weather_code ?? []
  if (temp.length < 24 || temp.every((t) => t == null)) return null
  return { temp: temp.map((t) => t ?? NaN), code: code.map((c) => c ?? -1) }
}

// Archiv Open-Meteo má zpoždění pár dní, pro čerstvá data se proto zkusí i předpověďové API.
export function getWeather(lat: number, lng: number, day: string): Promise<DayWeather | null> {
  const key = `${lat.toFixed(2)}:${lng.toFixed(2)}:${day}`
  let p = cache.get(key)
  if (!p) {
    p = fetchHourly('https://archive-api.open-meteo.com/v1/archive', lat, lng, day)
      .catch(() => null)
      .then((w) => w ?? fetchHourly('https://api.open-meteo.com/v1/forecast', lat, lng, day).catch(() => null))
    cache.set(key, p)
  }
  return p
}

export function describeWeather(code: number): string {
  if (code === 0) return 'Jasno'
  if (code === 1) return 'Skoro jasno'
  if (code === 2) return 'Polojasno'
  if (code === 3) return 'Zataženo'
  if (code === 45 || code === 48) return 'Mlha'
  if (code >= 51 && code <= 55) return 'Mrholení'
  if (code === 56 || code === 57) return 'Mrznoucí mrholení'
  if (code === 61) return 'Slabý déšť'
  if (code === 63) return 'Déšť'
  if (code === 65) return 'Silný déšť'
  if (code === 66 || code === 67) return 'Mrznoucí déšť'
  if (code === 71) return 'Slabé sněžení'
  if (code === 73) return 'Sněžení'
  if (code === 75) return 'Silné sněžení'
  if (code === 77) return 'Sněhová zrna'
  if (code >= 80 && code <= 82) return 'Přeháňky'
  if (code === 85 || code === 86) return 'Sněhové přeháňky'
  if (code === 95) return 'Bouřka'
  if (code === 96 || code === 99) return 'Bouřka s kroupami'
  return '–'
}
