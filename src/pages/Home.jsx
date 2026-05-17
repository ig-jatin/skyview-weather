import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import SearchAutocomplete from '../components/SearchAutocomplete'
import WeatherBackground from '../components/WeatherBackground'
import WeatherMap from '../components/WeatherMap'
import WeatherChart from '../components/WeatherChart'

const ICONS = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '❄️', 77: '🌨️',
  80: '🌦️', 81: '🌧️', 82: '🌧️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
}

const NAV_ITEMS = [
  { key: 'today', icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z', label: 'Today' },
  { key: 'details', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Details' },
  { key: 'week', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', label: 'Week' },
  { key: 'ai', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', label: 'AI' },
  { key: 'map', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Map' },
]

function formatHour(time) {
  const d = new Date(time)
  const h = d.getHours()
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12} ${ampm}`
}

function formatDay(date) {
  const d = new Date(date)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en', { weekday: 'short' })
}

function Gauge({ value = 0, max = 100, unit = '', label, color = '#6c63ff', decimals = 0, displayValue }) {
  const pct = Math.min((value / max) * 100, 100)
  const shown = displayValue !== undefined ? displayValue : value.toFixed(decimals)
  return (
    <div className="gauge-wrapper">
      <div className="gauge-ring" style={{ background: `conic-gradient(${color} 0% ${pct}%, rgba(255,255,255,0.04) ${pct}% 100%)` }}>
        <div className="gauge-inner">
          <span className="gauge-value">{shown}{unit}</span>
        </div>
      </div>
      <span className="gauge-label">{label}</span>
    </div>
  )
}

export default function Home({ user, onLogout }) {
  const navigate = useNavigate()
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeNav, setActiveNav] = useState('today')
  const [coords, setCoords] = useState(null)
  const hourlyRef = useRef(null)

  useEffect(() => {
    if (user?.home_city) fetchWeather(user.home_city)
    else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          setCoords({ lat: latitude, lon: longitude })
          fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en&format=json`)
            .then(r => r.json())
            .then(d => { if (d.results?.[0]) fetchWeather(d.results[0].name, { lat: latitude, lon: longitude }) })
            .catch(() => {})
        },
        () => fetchWeather('New Delhi')
      )
    } else {
      fetchWeather('New Delhi')
    }
  }, [user?.home_city])

  async function fetchWeather(city, coordsOverride) {
    setLoading(true)
    setError('')
    setWeather(null)
    if (coordsOverride) setCoords(coordsOverride)
    try {
      let url = `/api/weather?city=${encodeURIComponent(city)}`
      if (coordsOverride) url += `&lat=${coordsOverride.lat}&lon=${coordsOverride.lon}`
      const res = await fetch(url)
      if (!res.ok) throw new Error((await res.json()).detail || 'City not found')
      const data = await res.json()
      setWeather(data)
      if (!coordsOverride && data.city) {
        const geo = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(data.city)}&count=1&format=json`)).json()
        if (geo.results?.length) setCoords({ lat: geo.results[0].latitude, lon: geo.results[0].longitude })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSelect(city, override) { fetchWeather(city, override) }

  const code = weather?.code ?? 0
  const hour = new Date().getHours()
  const today = weather?.daily_forecast?.[0]

  return (
    <>
      {weather ? (
        <WeatherBackground weatherCode={code} isDay={hour > 6 && hour < 19} />
      ) : (
        <div style={{ position:'fixed', inset:0, background:'#0b091a', zIndex:-2 }} />
      )}
      <div className="app">
        <header className="app-header">
          <h1>SkyView</h1>
          <div className="header-right">
            {user ? (
              <>
                <span className="header-user">{user.username}</span>
                <button className="header-btn" onClick={() => navigate('/profile')}>Profile</button>
                <button className="header-btn" onClick={onLogout}>Logout</button>
              </>
            ) : (
              <>
                <button className="header-btn" onClick={() => navigate('/login')}>Login</button>
                <button className="header-btn" onClick={() => navigate('/register')}>Register</button>
              </>
            )}
          </div>
        </header>

        {loading && <div className="loading"><div className="spinner" />Loading...</div>}
        {error && <div className="error">{error}</div>}

        <SearchAutocomplete onSelect={handleSelect} />

        {!weather && !loading && !error && (
          <div className="main-brand">
            <h2 className="main-title">SkyView</h2>
            <p className="main-subtitle">Weather Intelligence</p>
          </div>
        )}

        {weather && (
          <div className="dashboard">
            {/* Sidebar */}
            <nav className="sidebar">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.key}
                  className={`nav-btn ${activeNav === item.key ? 'active' : ''}`}
                  onClick={() => setActiveNav(item.key)}
                  title={item.label}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d={item.icon} />
                  </svg>
                  <span className="nav-label">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Main Content */}
            <main className="main-content">

              {activeNav === 'today' && (
                <>
                  {/* Hero Card */}
                  <div className="hero-card">
                    <div className="hero-bg-gradient" />
                    <div className="hero-top">
                      <div className="hero-location">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {weather.city}{weather.country ? `, ${weather.country}` : ''}
                      </div>
                      <div className="hero-temp-row">
                        <span className="hero-temp">{weather.temp}°</span>
                        <span className="hero-icon-circle">{ICONS[weather.code] || '🌡️'}</span>
                      </div>
                      <div className="hero-desc">{weather.description}</div>
                      <div className="hero-meta">
                        <span>Feels like {weather.feels_like}°</span>
                        {today && <span>H: {today.temp_max}° L: {today.temp_min}°</span>}
                      </div>
                    </div>
                    {weather.wind && (
                      <div className="hero-bottom">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>
                        {weather.wind} km/h
                      </div>
                    )}
                  </div>

                  {/* Metrics Gauges */}
                  <div className="metrics-grid">
                    <Gauge value={weather.humidity ?? 0} max={100} unit="%" label="Humidity" color="#48c6ef" />
                    <div className="gauge-wrapper">
                      <div className="wind-compass">
                        <div className="compass-ring" />
                        <div className="compass-arrow">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="#48c6ef"><path d="M12 2l3 7h-2v11h-2V9H9z"/></svg>
                        </div>
                        <div className="gauge-inner" style={{ position: 'absolute' }}>
                          <span className="gauge-value">{weather.wind ?? 0}<span className="gauge-unit">km/h</span></span>
                        </div>
                      </div>
                      <span className="gauge-label">Wind</span>
                    </div>
                    <Gauge value={weather.uv_index ?? 0} max={11} unit="" label="UV Index" color="#ff9800" decimals={1} />
                    <Gauge value={weather.pressure ? Math.min(Math.max((weather.pressure - 950) / (1050 - 950) * 100, 0), 100) : 0} max={100} unit="hPa" label="Pressure" color="#ab47bc" decimals={0} displayValue={weather.pressure ? Math.round(weather.pressure) : undefined} />
                  </div>

                  {/* Hourly Section */}
                  {weather.hourly_forecast?.length > 0 && (
                    <div className="card hourly-card">
                      <div className="card-header">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                        Hourly Forecast
                      </div>
                      <div className="hourly-strip" ref={hourlyRef}>
                        {weather.hourly_forecast.slice(0, 24).map((h, i) => (
                          <div key={i} className="hourly-item">
                            <div className="hourly-time">{i === 0 ? 'Now' : formatHour(h.time)}</div>
                            <div className="hourly-icon">{ICONS[h.code] || '🌡️'}</div>
                            <div className="hourly-temp">{h.temp}°</div>
                            {h.precipitation_prob > 0 && <div className="hourly-rain">{h.precipitation_prob}%</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chart */}
                  <div className="card chart-card">
                    <WeatherChart dailyForecast={weather.daily_forecast} hourlyHistory={weather.hourly_history} />
                  </div>
                </>
              )}

              {activeNav === 'details' && (
                <div className="card details-card">
                  <div className="card-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    Weather Details
                  </div>
                  <div className="details-grid">
                    <div className="detail-item"><span className="di-label">Humidity</span><span className="di-value">{weather.humidity}%</span></div>
                    <div className="detail-item"><span className="di-label">Wind</span><span className="di-value">{weather.wind} km/h</span></div>
                    {weather.wind_gusts > 0 && <div className="detail-item"><span className="di-label">Wind Gusts</span><span className="di-value">{weather.wind_gusts} km/h</span></div>}
                    <div className="detail-item"><span className="di-label">UV Index</span><span className="di-value">{weather.uv_index ?? '—'}</span></div>
                    <div className="detail-item"><span className="di-label">Pressure</span><span className="di-value">{weather.pressure ? `${Math.round(weather.pressure)} hPa` : '—'}</span></div>
                    <div className="detail-item"><span className="di-label">Dew Point</span><span className="di-value">{weather.dew_point != null ? `${weather.dew_point}°` : '—'}</span></div>
                    <div className="detail-item"><span className="di-label">Feels Like</span><span className="di-value">{weather.feels_like}°</span></div>
                  </div>
                </div>
              )}

              {activeNav === 'week' && (
                <div className="card week-card-full">
                  <div className="card-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    7-Day Forecast
                  </div>
                  <div className="week-list">
                    {weather.daily_forecast?.map((d, i) => (
                      <div key={i} className="week-item">
                        <div className="week-day">{formatDay(d.date)}</div>
                        <div className="week-icon">{ICONS[d.code] || '🌡️'}</div>
                        <div className="week-bar-wrap">
                          <span className="week-min">{d.temp_min ?? '—'}°</span>
                          <div className="week-bar-track"><div className="week-bar-fill" style={{ left: `${((d.temp_min ?? 10) - (-5)) / 50 * 100}%`, right: `${100 - ((d.temp_max ?? 35) - (-5)) / 50 * 100}%` }} /></div>
                          <span className="week-max">{d.temp_max ?? '—'}°</span>
                        </div>
                        <div className="week-extras">
                          {d.precipitation_prob > 0 && <span className="week-precip">{d.precipitation_prob}%</span>}
                          {d.uv_index_max != null && <span className="week-uv">UV {d.uv_index_max}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeNav === 'ai' && (
                <>
                  <div className="card ai-card">
                    <div className="card-header">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 1 4 4c0 2-2 3-2 5h-4c0-2-2-3-2-5a4 4 0 0 1 4-4z"/><path d="M12 22v-4"/><path d="M9 18h6"/></svg>
                      AI Weather Summary
                    </div>
                    <p className="ai-text">{weather.summary}</p>
                  </div>
                  {weather.recommendations && (
                    <div className="card ai-card">
                      <div className="card-header">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                        Recommendations
                      </div>
                      <div className="rec-verdict">{weather.recommendations.verdict}</div>
                      <div className="rec-chips">
                        {weather.recommendations.activities?.map((a, i) => <span key={i} className="chip">{a}</span>)}
                      </div>
                      <div className="rec-chips" style={{ marginTop: 8 }}>
                        {weather.recommendations.clothing?.map((c, i) => <span key={i} className="chip chip-outline">{c}</span>)}
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeNav === 'map' && (
                <div className="card map-card">
                  <WeatherMap city={weather.city} lat={coords?.lat} lon={coords?.lon} />
                </div>
              )}
            </main>

            {/* Right Panel */}
            <aside className="right-panel">
              {/* 7-Day Forecast */}
              <div className="card forecast-card">
                <div className="card-header-sm">7-Day Forecast</div>
                <div className="forecast-list">
                  {weather.daily_forecast?.slice(0, 7).map((d, i) => (
                    <div key={i} className="forecast-day">
                      <span className="fd-name">{formatDay(d.date)}</span>
                      <span className="fd-icon">{ICONS[d.code] || '🌡️'}</span>
                      <span className="fd-temps">
                        <span className="fd-high">{d.temp_max ?? '—'}°</span>
                        <span className="fd-sep">/</span>
                        <span className="fd-low">{d.temp_min ?? '—'}°</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AQI */}
              {weather.aqi != null && (
                <div className="card aqi-card-right">
                  <div className="card-header-sm">Air Quality</div>
                  <div className="aqi-gauge-wrap">
                    <div className="aqi-ring" style={{
                      background: `conic-gradient(${weather.aqi <= 50 ? '#4caf50' : weather.aqi <= 100 ? '#ffc107' : weather.aqi <= 150 ? '#ff5722' : '#f44336'} 0% ${Math.min(weather.aqi / 3, 100)}%, rgba(255,255,255,0.04) ${Math.min(weather.aqi / 3, 100)}% 100%)`
                    }}>
                      <div className="gauge-inner">
                        <span className="aqi-big">{weather.aqi}</span>
                      </div>
                    </div>
                    <span className={`aqi-label-right ${weather.aqi <= 50 ? 'aqi-good' : weather.aqi <= 100 ? 'aqi-moderate' : weather.aqi <= 150 ? 'aqi-bad' : 'aqi-hazardous'}`}>
                      {weather.aqi_label}
                    </span>
                  </div>
                  <p className="aqi-advice-text">{weather.aqi_advice}</p>
                  {weather.aqi_pm25 != null && (
                    <div className="aqi-particles">
                      <span>PM2.5: {weather.aqi_pm25} µg</span>
                      <span>PM10: {weather.aqi_pm10} µg</span>
                    </div>
                  )}
                </div>
              )}

              {/* AI Summary */}
              <div className="card summary-card-right">
                <div className="card-header-sm">AI Summary</div>
                <p className="summary-text">{weather.summary}</p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </>
  )
}
