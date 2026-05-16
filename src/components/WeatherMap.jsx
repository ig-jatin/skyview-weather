import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

export default function WeatherMap({ city, lat, lon }) {
  if (!lat || !lon) return null

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
      <MapContainer
        center={[lat, lon]}
        zoom={8}
        scrollWheelZoom={false}
        style={{ height: 280, width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lon]}>
          <Popup>{city}</Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}
