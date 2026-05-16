import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const WEATHER_CODES = {
  0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Depositing Rime Fog',
  51: 'Light Drizzle', 53: 'Moderate Drizzle', 55: 'Dense Drizzle',
  61: 'Light Rain', 63: 'Moderate Rain', 65: 'Heavy Rain',
  71: 'Light Snow', 73: 'Moderate Snow', 75: 'Heavy Snow', 77: 'Snow Grains',
  80: 'Slight Rain Showers', 81: 'Moderate Rain Showers', 82: 'Violent Rain Showers',
  85: 'Slight Snow Showers', 86: 'Heavy Snow Showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with Slight Hail', 99: 'Thunderstorm with Heavy Hail',
}

export default function Profile({ user, onLogout }) {
  const navigate = useNavigate()
  const [locations, setLocations] = useState([])
  const [weatherData, setWeatherData] = useState({})

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    loadLocations()
  }, [user])

  async function loadLocations() {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/locations', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const locs = await res.json()
      setLocations(locs)
      locs.forEach((loc) => fetchWeatherForLoc(loc))
    }
    if (user.home_city) {
      fetchWeatherForLoc({ id: 'home', city: user.home_city, latitude: user.home_lat, longitude: user.home_lon })
    }
  }

  async function fetchWeatherForLoc(loc) {
    if (!loc.latitude || !loc.longitude) return
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(loc.city)}`)
      if (res.ok) {
        const data = await res.json()
        setWeatherData((prev) => ({ ...prev, [loc.id || 'home']: data }))
      }
    } catch {}
  }

  async function removeLocation(id) {
    const token = localStorage.getItem('token')
    await fetch(`/api/locations/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    loadLocations()
  }

  if (!user) return null

  return (
    <div className="app">
      <div className="top-bar">
        <h1>Profile</h1>
        <div className="top-bar-links">
          <button className="link-btn" onClick={() => navigate('/')}>Home</button>
          <span className="user-greeting">{user.username}</span>
          <button className="link-btn" onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div className="profile-section">
        <div className="profile-card">
          <h3>Account</h3>
          <p><strong>Username:</strong> {user.username}</p>
          <p><strong>Email:</strong> {user.email}</p>
          {user.home_city && <p><strong>Home:</strong> {user.home_city}</p>}
        </div>

        <h3 style={{ marginTop: 32, color: '#fff' }}>Saved Locations</h3>

        {user.home_city && (
          <div className="location-card">
            <div className="loc-info">
              <strong>🏠 {user.home_city}</strong> (Home)
              {weatherData['home'] && (
                <span className="loc-weather">
                  {weatherData['home'].temp}° {weatherData['home'].description}
                </span>
              )}
            </div>
          </div>
        )}

        {locations.map((loc) => (
          <div key={loc.id} className="location-card">
            <div className="loc-info">
              <strong>{loc.city}{loc.country ? `, ${loc.country}` : ''}</strong>
              {weatherData[loc.id] && (
                <span className="loc-weather">
                  {weatherData[loc.id].temp}° {weatherData[loc.id].description}
                </span>
              )}
            </div>
            <button className="small-btn danger" onClick={() => removeLocation(loc.id)}>✕</button>
          </div>
        ))}

        {!locations.length && !user.home_city && (
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>No saved locations yet. Search a city and click + to save it.</p>
        )}
      </div>
    </div>
  )
}
