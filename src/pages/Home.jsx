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

export default function Home({ user, onLogout }) {
  const navigate = useNavigate()
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('today')
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
            .then(d => {
              if (d.results?.[0]) fetchWeather(d.results[0].name, { lat: latitude, lon: longitude })
            })
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
      <WeatherBackground weatherCode={code} isDay={hour > 6 && hour < 19} />
      <div className="app">
        <header className="app-header">
          <div className="header-left">
            <h1>SkyView</h1>
          </div>
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

        <SearchAutocomplete onSelect={handleSelect} />

        {loading && (
          <div className="loading"><div className="spinner" />Loading...</div>
        )}
        {error && <div className="error">{error}</div>}

        {weather && (
          <>
            {/* Hero Section */}
            <div className="hero-card">
              <div className="hero-location">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {weather.city}, {weather.country}
              </div>
              <div className="hero-main">
                <span className="hero-temp">{weather.temp}°</span>
                <span className="hero-icon">{ICONS[weather.code] || '🌡️'}</span>
              </div>
              <div className="hero-desc">{weather.description}</div>
              <div className="hero-feels">Feels like {weather.feels_like}°</div>
              {today && (
                <div className="hero-highlow">
                  H: {today.temp_max}° &nbsp; L: {today.temp_min}°
                </div>
              )}
              {weather.wind && (
                <div className="hero-wind">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>
                  {weather.wind} km/h
                </div>
              )}
            </div>

            {/* Tab Navigation */}
            <div className="main-tabs">
              <button className={`main-tab ${activeTab === 'today' ? 'active' : ''}`} onClick={() => setActiveTab('today')}>Today</button>
              <button className={`main-tab ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>Details</button>
              <button className={`main-tab ${activeTab === 'week' ? 'active' : ''}`} onClick={() => setActiveTab('week')}>7 Days</button>
              <button className={`main-tab ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>AI Insights</button>
              <button className={`main-tab ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>Map</button>
            </div>

            {/* Today Tab */}
            {activeTab === 'today' && (
              <div className="tab-content animate-in">
                {/* Hourly Strip */}
                {weather.hourly_forecast?.length > 0 && (
                  <div className="hourly-section">
                    <div className="section-label">Hourly Forecast</div>
                    <div className="hourly-strip" ref={hourlyRef}>
                      {weather.hourly_forecast.slice(0, 24).map((h, i) => (
                        <div key={i} className="hourly-item">
                          <div className="hourly-time">{i === 0 ? 'Now' : formatHour(h.time)}</div>
                          <div className="hourly-icon">{ICONS[h.code] || '🌡️'}</div>
                          <div className="hourly-temp">{h.temp}°</div>
                          {h.precipitation_prob > 0 && (
                            <div className="hourly-rain">{h.precipitation_prob}%</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Stats */}
                <div className="quick-stats">
                  <div className="qs-item">
                    <div className="qs-label">Humidity</div>
                    <div className="qs-value">{weather.humidity}%</div>
                  </div>
                  <div className="qs-item">
                    <div className="qs-label">Wind</div>
                    <div className="qs-value">{weather.wind} km/h</div>
                  </div>
                  <div className="qs-item">
                    <div className="qs-label">UV Index</div>
                    <div className="qs-value">{weather.uv_index ?? '—'}</div>
                  </div>
                  <div className="qs-item">
                    <div className="qs-label">Pressure</div>
                    <div className="qs-value">{weather.pressure ? `${Math.round(weather.pressure)} hPa` : '—'}</div>
                  </div>
                  <div className="qs-item">
                    <div className="qs-label">Dew Point</div>
                    <div className="qs-value">{weather.dew_point != null ? `${weather.dew_point}°` : '—'}</div>
                  </div>
                  <div className="qs-item">
                    <div className="qs-label">Feels Like</div>
                    <div className="qs-value">{weather.feels_like}°</div>
                  </div>
                </div>

                {/* Air Quality */}
                {weather.aqi != null && (
                  <div className="aqi-card">
                    <div className="aqi-card-header">
                      <span>Air Quality Index</span>
                      <span className={`aqi-badge-sm ${weather.aqi <= 50 ? 'aqi-good' : weather.aqi <= 100 ? 'aqi-moderate' : weather.aqi <= 150 ? 'aqi-bad' : 'aqi-hazardous'}`}>
                        {weather.aqi_label}
                      </span>
                    </div>
                    <div className="aqi-bar">
                      <div className="aqi-bar-fill" style={{ width: `${Math.min(weather.aqi / 3, 100)}%`, background: weather.aqi <= 50 ? '#4caf50' : weather.aqi <= 100 ? '#ffc107' : weather.aqi <= 150 ? '#ff5722' : '#f44336' }} />
                    </div>
                    <div className="aqi-value">{weather.aqi} / 300</div>
                    {weather.aqi_pm25 != null && (
                      <div className="aqi-particles">
                        <span>PM2.5: {weather.aqi_pm25} µg</span>
                        <span>PM10: {weather.aqi_pm10} µg</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Details Tab */}
            {activeTab === 'details' && (
              <div className="tab-content animate-in">
                <div className="details-grid">
                  <div className="detail-card">
                    <div className="dc-icon">💧</div>
                    <div className="dc-label">Humidity</div>
                    <div className="dc-value">{weather.humidity}%</div>
                  </div>
                  <div className="detail-card">
                    <div className="dc-icon">🌬️</div>
                    <div className="dc-label">Wind</div>
                    <div className="dc-value">{weather.wind} km/h</div>
                    {weather.wind_gusts > 0 && <div className="dc-sub">Gusts: {weather.wind_gusts} km/h</div>}
                  </div>
                  <div className="detail-card">
                    <div className="dc-icon">☀️</div>
                    <div className="dc-label">UV Index</div>
                    <div className="dc-value">{weather.uv_index ?? '—'}</div>
                  </div>
                  <div className="detail-card">
                    <div className="dc-icon">📊</div>
                    <div className="dc-label">Pressure</div>
                    <div className="dc-value">{weather.pressure ? `${Math.round(weather.pressure)} hPa` : '—'}</div>
                  </div>
                  <div className="detail-card">
                    <div className="dc-icon">🌡️</div>
                    <div className="dc-label">Dew Point</div>
                    <div className="dc-value">{weather.dew_point != null ? `${weather.dew_point}°` : '—'}</div>
                  </div>
                  <div className="detail-card">
                    <div className="dc-icon">🌡️</div>
                    <div className="dc-label">Feels Like</div>
                    <div className="dc-value">{weather.feels_like}°</div>
                  </div>
                </div>

                {weather.aqi != null && (
                  <div className="aqi-detail">
                    <div className="section-label">Air Quality</div>
                    <div className="aqi-detail-card">
                      <div className="aqi-detail-main">
                        <span className={`aqi-badge-lg ${weather.aqi <= 50 ? 'aqi-good' : weather.aqi <= 100 ? 'aqi-moderate' : weather.aqi <= 150 ? 'aqi-bad' : 'aqi-hazardous'}`}>
                          AQI {weather.aqi} — {weather.aqi_label}
                        </span>
                      </div>
                      <p className="health-advice">{weather.aqi_advice}</p>
                      <div className="aqi-particles">
                        <span>PM2.5: {weather.aqi_pm25} µg/m³</span>
                        <span>PM10: {weather.aqi_pm10} µg/m³</span>
                      </div>
                    </div>
                  </div>
                )}

                <WeatherChart dailyForecast={weather.daily_forecast} hourlyHistory={weather.hourly_history} />
              </div>
            )}

            {/* Week Tab */}
            {activeTab === 'week' && (
              <div className="tab-content animate-in">
                <div className="section-label">7-Day Forecast</div>
                <div className="week-list">
                  {weather.daily_forecast?.map((d, i) => (
                    <div key={i} className="week-item">
                      <div className="week-day">{formatDay(d.date)}</div>
                      <div className="week-icon">{ICONS[d.code] || '🌡️'}</div>
                      <div className="week-prob">
                        {d.precipitation_prob > 0 && <span className="rain-chance">{d.precipitation_prob}%</span>}
                      </div>
                      <div className="week-bar">
                        <span className="week-min">{d.temp_min ?? '—'}°</span>
                        <div className="week-bar-track">
                          <div className="week-bar-fill" style={{
                            left: d.temp_min != null && d.temp_max != null ? `${((d.temp_min - (-5)) / 50) * 100}%` : '0%',
                            right: d.temp_min != null && d.temp_max != null ? `${100 - ((d.temp_max - (-5)) / 50) * 100}%` : '50%',
                          }} />
                        </div>
                        <span className="week-max">{d.temp_max ?? '—'}°</span>
                      </div>
                      <div className="week-extra">
                        {d.precipitation_sum > 0 && <span>{d.precipitation_sum} mm</span>}
                        {d.uv_index_max != null && <span>UV {d.uv_index_max}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Insights Tab */}
            {activeTab === 'ai' && (
              <div className="tab-content animate-in">
                <div className="ai-summary-card">
                  <div className="ai-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a4 4 0 0 1 4 4c0 2-2 3-2 5h-4c0-2-2-3-2-5a4 4 0 0 1 4-4z"/><path d="M12 22v-4"/><path d="M9 18h6"/>
                    </svg>
                    AI Weather Summary
                  </div>
                  <p className="ai-summary-text">{weather.summary}</p>
                </div>

                {weather.recommendations && (
                  <div className="ai-recs">
                    <div className="ai-header">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                      </svg>
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
              </div>
            )}

            {/* Map Tab */}
            {activeTab === 'map' && (
              <div className="tab-content animate-in" style={{ padding: 0 }}>
                <WeatherMap city={weather.city} lat={coords?.lat} lon={coords?.lon} />
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
