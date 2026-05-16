import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

export default function WeatherChart({ dailyForecast, hourlyHistory }) {
  const chartData = dailyForecast?.length
    ? dailyForecast.map((d) => ({
        name: new Date(d.date).toLocaleDateString('en', { weekday: 'short' }),
        max: d.temp_max,
        min: d.temp_min,
      }))
    : hourlyHistory
        ?.filter((_, i) => i % 6 === 0)
        ?.slice(-24)
        ?.map((h) => ({
          name: new Date(h.time).toLocaleTimeString('en', { hour: '2-digit' }),
          temp: h.temp,
        }))

  if (!chartData?.length) return null

  return (
    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 16px', border: '1px solid rgba(255,255,255,0.08)' }}>
      <h4 style={{ margin: '0 0 16px', color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1 }}>
        {dailyForecast?.length ? '7-Day Forecast' : 'Hourly Trend'}
      </h4>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={12} />
          <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} />
          <Tooltip
            contentStyle={{
              background: 'rgba(20,20,40,0.9)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              color: '#fff',
            }}
          />
          {dailyForecast?.length ? (
            <>
              <Line type="monotone" dataKey="max" stroke="#ff6b6b" strokeWidth={2} dot={{ fill: '#ff6b6b', r: 3 }} name="Max" />
              <Line type="monotone" dataKey="min" stroke="#6dd5ed" strokeWidth={2} dot={{ fill: '#6dd5ed', r: 3 }} name="Min" />
            </>
          ) : (
            <Line type="monotone" dataKey="temp" stroke="#6c63ff" strokeWidth={2} dot={{ fill: '#6c63ff', r: 2 }} name="Temp °C" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
