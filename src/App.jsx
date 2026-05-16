import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'
import './App.css'

export default function App() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.ok ? r.json() : null)
        .then((u) => { if (u) setUser(u) })
        .catch(() => localStorage.removeItem('token'))
    }
  }, [])

  function handleLogin(userData) {
    setUser(userData)
  }

  function handleLogout() {
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home user={user} onLogout={handleLogout} />} />
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} />
        <Route path="/register" element={user ? <Navigate to="/" /> : <Register onLogin={handleLogin} />} />
        <Route path="/profile" element={<Profile user={user} onLogout={handleLogout} />} />
      </Routes>
    </BrowserRouter>
  )
}
