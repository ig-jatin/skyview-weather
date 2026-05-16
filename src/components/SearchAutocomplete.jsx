import { useState, useEffect, useRef, useCallback } from 'react'

export default function SearchAutocomplete({ onSelect }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef(null)
  const debounceRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchSuggestions = useCallback(async (q) => {
    if (q.length < 2) {
      setSuggestions([])
      setIsOpen(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`
      )
      const data = await res.json()
      const results = (data.results || []).map((r) => ({
        city: r.name,
        country: r.country || '',
        admin: r.admin1 || '',
        latitude: r.latitude,
        longitude: r.longitude,
      }))
      setSuggestions(results)
      setIsOpen(results.length > 0)
      setActiveIndex(-1)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(e) {
    const value = e.target.value
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 250)
  }

  function selectItem(item) {
    setQuery(item.city)
    setIsOpen(false)
    setSuggestions([])
    onSelect(item.city, { lat: item.latitude, lon: item.longitude })
  }

  function handleKeyDown(e) {
    if (!isOpen || !suggestions.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      selectItem(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      selectItem(suggestions[activeIndex])
    } else {
      onSelect(trimmed)
    }
  }

  return (
    <div className="autocomplete-wrapper" ref={wrapperRef}>
      <form className="search-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search city..."
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length) setIsOpen(true) }}
          autoComplete="off"
        />
        <button type="submit">Search</button>
      </form>

      {isOpen && suggestions.length > 0 && (
        <ul className="suggestions-list">
          {suggestions.map((item, i) => (
            <li
              key={`${item.city}-${item.latitude}-${item.longitude}`}
              className={`suggestion-item ${i === activeIndex ? 'active' : ''}`}
              onClick={() => selectItem(item)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <div className="suggestion-main">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.4 }}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
                <div>
                  <span className="suggestion-city">{item.city}</span>
                  {item.admin && <span className="suggestion-admin">{item.admin}</span>}
                </div>
              </div>
              <span className="suggestion-country">{item.country}</span>
            </li>
          ))}
        </ul>
      )}

      {loading && (
        <div className="suggestions-loading">
          <div className="mini-spinner" />
          Searching...
        </div>
      )}
    </div>
  )
}
