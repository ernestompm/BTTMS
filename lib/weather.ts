import type { WeatherData } from '@/types'

const CACHE: Record<string, { data: WeatherData; expiresAt: number }> = {}
const CACHE_SECONDS = parseInt(process.env.WEATHER_CACHE_SECONDS || '300')

function getWindDirection(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO']
  return dirs[Math.round(deg / 22.5) % 16]
}

function getCondition(code: number): string {
  if (code === 0) return 'Despejado'
  if (code <= 3) return 'Parcialmente nublado'
  if (code <= 49) return 'Niebla'
  if (code <= 59) return 'Llovizna'
  if (code <= 69) return 'Lluvia'
  if (code <= 79) return 'Nieve'
  if (code <= 82) return 'Chubascos'
  if (code <= 99) return 'Tormenta'
  return 'Desconocido'
}

export async function getWeather(lat: number, lng: number, cacheKey: string): Promise<WeatherData | null> {
  const now = Date.now()
  if (CACHE[cacheKey] && CACHE[cacheKey].expiresAt > now) {
    return CACHE[cacheKey].data
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,cloud_cover&hourly=temperature_2m,precipitation_probability&forecast_days=1&timezone=auto`
    const res = await fetch(url, { next: { revalidate: CACHE_SECONDS } })
    if (!res.ok) return null
    const d = await res.json()
    const c = d.current
    const h = d.hourly
    const currentHourIndex = new Date().getHours()

    const forecast = [0, 1, 2].map((offset) => {
      const idx = Math.min(currentHourIndex + offset + 1, 23)
      return {
        hour: `${String(idx).padStart(2, '0')}:00`,
        temp_c: Math.round(h.temperature_2m[idx]),
        rain_pct: h.precipitation_probability[idx] || 0,
      }
    })

    const data: WeatherData = {
      location: `${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E`,
      temperature_c: Math.round(c.temperature_2m * 10) / 10,
      feels_like_c: Math.round(c.apparent_temperature * 10) / 10,
      humidity_pct: c.relative_humidity_2m,
      wind_speed_kmh: Math.round(c.wind_speed_10m),
      wind_direction: getWindDirection(c.wind_direction_10m),
      wind_gusts_kmh: Math.round(c.wind_gusts_10m),
      precipitation_mm_last_hour: c.precipitation,
      rain_probability_pct: h.precipitation_probability[currentHourIndex] || 0,
      uv_index: Math.round(c.uv_index),
      cloud_cover_pct: c.cloud_cover,
      condition: getCondition(c.weather_code),
      alerts: [],
      forecast_next_3h: forecast,
      updated_at: new Date().toISOString(),
    }

    CACHE[cacheKey] = { data, expiresAt: now + CACHE_SECONDS * 1000 }
    return data
  } catch {
    return null
  }
}
