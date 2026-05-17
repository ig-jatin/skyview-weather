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

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function Home({ user, onLogout }) {
  const navigate = useNavigate()
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeNav, setActiveNav] = useState('today')
  const [coords, setCoords] = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const searchRef = useRef(null)

  useEffect(() => {
    if (user?.home_city) fetchWeather(user.home_city)
    else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          setCoords({ lat: latitude, lon: longitude })
          fetchWeather('', { lat: latitude, lon: longitude })
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

  function handleSelect(city, override) { setShowSearch(false); fetchWeather(city, override) }

  const code = weather?.code ?? 0
  const hour = new Date().getHours()
  const today = weather?.daily_forecast?.[0]
  const severity = weather ? assessSeverity(weather) : null

  return (
    <>
      {weather ? (
        <WeatherBackground weatherCode={code} />
      ) : (
        <div className="app-bg" />
      )}
      <div className="app">
        {loading && <div className="loading"><div className="spinner" />Loading...</div>}
        {error && <div className="error">{error}</div>}

        {weather && (
          <div className="dashboard">
            {/* Left Sidebar */}
            <aside className="dash-sidebar">
              <div className="sidebar-avatar">
                {user ? user.username[0].toUpperCase() : '?'}
              </div>
              <nav className="sidebar-nav">
                {[
                  { key: 'today', path: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
                  { key: 'map', path: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z' },
                  { key: 'radar', path: 'M12 8V4m0 4a4 4 0 014 4m-4-4a4 4 0 00-4 4m8 0a8 8 0 01-8 8m8-8h4m-12 0H4m16 0a8 8 0 01-8 8m0 0v4' },
                  { key: 'analytics', path: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
                  { key: 'settings', path: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
                ].map(item => (
                  <button
                    key={item.key}
                    className={`nav-icon ${activeNav === item.key ? 'active' : ''}`}
                    onClick={() => setActiveNav(item.key)}
                    title={item.key}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d={item.path} />
                    </svg>
                  </button>
                ))}
              </nav>
              <div className="sidebar-footer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>
                <span className="sidebar-updated">Updated just now</span>
              </div>
            </aside>

            {/* Main Area */}
            <div className="main-area">
              {/* Top Header */}
              <header className="top-header">
                <div className="location-section">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <div>
                    <div className="location-name">{weather.city}{weather.country ? `, ${weather.country}` : ''}</div>
                    <div className="location-date">{formatDate(weather.daily_forecast?.[0]?.date) || ''}</div>
                  </div>
                </div>
                <div className="header-actions">
                  <div className="search-wrapper" ref={searchRef}>
                    <button className="icon-btn" onClick={() => setShowSearch(!showSearch)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    </button>
                    {showSearch && (
                      <div className="search-popup">
                        <SearchAutocomplete onSelect={handleSelect} />
                      </div>
                    )}
                  </div>
                  <button className="download-btn" onClick={() => window.open('https://github.com/ig-jatin/skyview-weather', '_blank')}>Download App</button>
                  {user ? (
                    <div className="header-user-menu">
                      <button className="icon-btn" onClick={onLogout}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      </button>
                      <span className="header-user-name">{user.username}</span>
                    </div>
                  ) : (
                    <div className="header-user-menu">
                      <button className="icon-btn" onClick={() => navigate('/login')}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                      </button>
                    </div>
                  )}
                </div>
              </header>

              {/* Content Grid */}
              {activeNav === 'today' && (
                <div className="content-grid">
                  {/* Left Column */}
                  <div className="col-left">
                    {/* Hero Card */}
                    <div className="glass-card hero-glow">
                      <div className="hero-storm-bg" />
                      <div className="hero-content">
                        <div className="hero-left">
                          <div className="hero-temp">{weather.temp}°</div>
                          <div className="hero-conditions">
                            <span className="hero-cond-main">{weather.description}</span>
                            <span className="hero-cond-sub">with {weather.feels_like != null && weather.feels_like < weather.temp ? 'cool' : 'warm'} conditions</span>
                          </div>
                          <div className="hero-highlow">
                            {today && <><span className="pill">H {today.temp_max}°</span><span className="pill">L {today.temp_min}°</span></>}
                          </div>
                        </div>
                        <div className="hero-info-box">
                          <p>Real-time weather data for {weather.city}. Updated every 15 minutes from local stations and satellite imagery.</p>
                        </div>
                      </div>
                    </div>

                    {/* Hourly Forecast */}
                    <div className="glass-card">
                      <div className="card-label">Hourly Forecast</div>
                      <div className="hourly-strip">
                        {weather.hourly_forecast?.slice(0, 12).map((h, i) => (
                          <div key={i} className={`hourly-cell ${i === 0 ? 'now' : ''}`}>
                            <div className="hc-time">{i === 0 ? 'Now' : formatHour(h.time)}</div>
                            <div className="hc-icon">{ICONS[h.code] || '🌡️'}</div>
                            {h.precipitation_prob > 0 && <div className="hc-rain">{h.precipitation_prob}%</div>}
                            <div className="hc-temp">{h.temp}°</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Weekly Forecast */}
                    <div className="glass-card">
                      <div className="card-label">7-Day Forecast</div>
                      <div className="weekly-strip">
                        {weather.daily_forecast?.map((d, i) => (
                          <div key={i} className={`weekly-cell ${i === 0 ? 'active' : ''}`}>
                            <div className="wc-day">{formatDay(d.date)}</div>
                            <div className="wc-icon">{ICONS[d.code] || '🌡️'}</div>
                            <div className="wc-high">{d.temp_max ?? '—'}°</div>
                            <div className="wc-low">{d.temp_min ?? '—'}°</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="col-right">
                    {/* Live Conditions Chart */}
                    <div className="glass-card">
                      <div className="live-header">
                        <span className="card-label">Live Conditions</span>
                        {severity && <span className="danger-badge">{severity}</span>}
                      </div>
                      <WeatherChart dailyForecast={weather.daily_forecast} hourlyHistory={weather.hourly_history} />
                      <div className="metrics-row">
                        <div className="metric-cell">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#48c6ef" strokeWidth="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
                          <span className="mc-label">Humidity</span>
                          <span className="mc-value">{weather.humidity}%</span>
                        </div>
                        <div className="metric-divider" />
                        <div className="metric-cell">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#48c6ef" strokeWidth="2"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>
                          <span className="mc-label">Wind</span>
                          <span className="mc-value">{weather.wind} km/h</span>
                        </div>
                        <div className="metric-divider" />
                        <div className="metric-cell">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#48c6ef" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/></svg>
                          <span className="mc-label">Pressure</span>
                          <span className="mc-value">{weather.pressure ? `${Math.round(weather.pressure)} hPa` : '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Recently Searched / Saved Locations */}
                    <div className="glass-card">
                      <div className="card-label">Recently Searched</div>
                      {user ? (
                        <div className="recent-list">
                          <div className="saved-item" onClick={() => fetchWeather(user.home_city || weather.city)}>
                            <span className="saved-icon">📍</span>
                            <div className="saved-info">
                              <span className="saved-city">{weather.city}</span>
                              <span className="saved-cond">{weather.description}</span>
                            </div>
                            <span className="saved-temp">{weather.temp}°</span>
                          </div>
                          <div className="saved-empty">Saved locations appear here</div>
                        </div>
                      ) : (
                        <div className="recent-list">
                          <div className="saved-item">
                            <span className="saved-icon">📍</span>
                            <div className="saved-info">
                              <span className="saved-city">{weather.city}</span>
                              <span className="saved-cond">{weather.description}</span>
                            </div>
                            <span className="saved-temp">{weather.temp}°</span>
                          </div>
                          <div className="saved-empty">
                            <button className="link-btn" onClick={() => navigate('/login')}>Log in</button> to save locations
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Wind Map */}
                    <div className="glass-card map-glass-card">
                      <div className="windmap-header">
                        <span className="card-label">Wind Map</span>
                        <div className="windmap-data">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>
                          <span>{weather.wind} km/h</span>
                        </div>
                      </div>
                      <WeatherMap city={weather.city} lat={coords?.lat} lon={coords?.lon} />
                    </div>
                  </div>
                </div>
              )}

              {activeNav === 'map' && (
                <div className="content-grid single-col">
                  <div className="glass-card map-glass-card" style={{ gridColumn: '1 / -1' }}>
                    <WeatherMap city={weather.city} lat={coords?.lat} lon={coords?.lon} />
                  </div>
                </div>
              )}

              {activeNav === 'radar' && (
                <div className="content-grid single-col">
                  <div className="glass-card">
                    <div className="card-label">Weather Radar</div>
                    <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
                      <WeatherMap city={weather.city} lat={coords?.lat} lon={coords?.lon} />
                    </div>
                  </div>
                </div>
              )}

              {activeNav === 'analytics' && (
                <div className="content-grid single-col">
                  <div className="glass-card">
                    <div className="card-label">Weather Analytics</div>
                    <WeatherChart dailyForecast={weather.daily_forecast} hourlyHistory={weather.hourly_history} />
                    <div className="analytics-grid">
                      <div className="analytics-item">
                        <span className="an-label">Average Temp</span>
                        <span className="an-value">{weather.temp}°C</span>
                      </div>
                      <div className="analytics-item">
                        <span className="an-label">Max UV</span>
                        <span className="an-value">{today?.uv_index_max ?? '—'}</span>
                      </div>
                      <div className="analytics-item">
                        <span className="an-label">Wind Gusts</span>
                        <span className="an-value">{weather.wind_gusts ?? '—'} km/h</span>
                      </div>
                      <div className="analytics-item">
                        <span className="an-label">Dew Point</span>
                        <span className="an-value">{weather.dew_point != null ? `${weather.dew_point}°` : '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeNav === 'settings' && (
                <div className="content-grid single-col">
                  <div className="glass-card">
                    <div className="card-label">Settings</div>
                    <div className="settings-list">
                      <div className="setting-item">
                        <span>Account</span>
                        {user ? (
                          <span className="setting-value">{user.email} <button className="link-btn" onClick={onLogout}>Logout</button></span>
                        ) : (
                          <button className="link-btn" onClick={() => navigate('/login')}>Login</button>
                        )}
                      </div>
                      {user && (
                        <div className="setting-item">
                          <span>Home Location</span>
                          <span className="setting-value">{user.home_city || 'Not set'} <button className="link-btn" onClick={() => navigate('/profile')}>Edit</button></span>
                        </div>
                      )}
                      <div className="setting-item">
                        <span>Version</span>
                        <span className="setting-value">1.0.0</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function assessSeverity(data) {
  if (data.code >= 95) return 'Storm Warning'
  if (data.code >= 80) return 'Heavy Rain'
  if (data.temp && data.temp > 40) return 'Heatwave'
  if (data.aqi && data.aqi > 200) return 'Hazardous AQI'
  if (data.wind && data.wind > 50) return 'High Wind'
  return null
}
