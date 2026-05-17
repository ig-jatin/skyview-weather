import { useEffect, useRef } from 'react'

const GRADIENTS = {
  day: 'linear-gradient(135deg, #0f0c29, #1a1a3e, #12122a)',
  night: 'linear-gradient(135deg, #0a0817, #0f0c29, #1a1230)',
  cloudy: 'linear-gradient(135deg, #0f0f1a, #1a1a2e, #121220)',
  rainy: 'linear-gradient(135deg, #0a0f18, #121a24, #0e141e)',
  snowy: 'linear-gradient(135deg, #12121a, #1e1e2e, #16162a)',
  stormy: 'linear-gradient(135deg, #08080f, #0f0f1a, #0a0a14)',
  foggy: 'linear-gradient(135deg, #12121a, #1a1a24, #14141e)',
}

export default function WeatherBackground({ weatherCode, isDay }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)

  const isNight = !isDay
  const isRainy = weatherCode >= 51 && weatherCode <= 67
  const isSnowy = weatherCode >= 71 && weatherCode <= 77
  const isStormy = weatherCode >= 95
  const isFoggy = weatherCode === 45 || weatherCode === 48
  const isCloudy = weatherCode === 2 || weatherCode === 3

  let gradient
  if (isStormy) gradient = GRADIENTS.stormy
  else if (isRainy) gradient = GRADIENTS.rainy
  else if (isSnowy) gradient = GRADIENTS.snowy
  else if (isFoggy || isCloudy) gradient = GRADIENTS.cloudy
  else if (isNight) gradient = GRADIENTS.night
  else gradient = GRADIENTS.day

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || (!isRainy && !isSnowy && !isStormy)) return

    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const count = isStormy ? 200 : isRainy ? 150 : 100
    const isSnow = isSnowy
    const drops = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      speed: 2 + Math.random() * 4,
      length: isSnow ? 3 + Math.random() * 5 : 10 + Math.random() * 15,
      opacity: 0.3 + Math.random() * 0.5,
    }))

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (isSnow) {
        drops.forEach((d) => {
          ctx.beginPath()
          ctx.arc(d.x, d.y, d.length, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255, 255, 255, ${d.opacity})`
          ctx.fill()
          d.y += d.speed
          d.x += Math.sin(d.y * 0.01) * 0.5
          if (d.y > canvas.height) {
            d.y = -10
            d.x = Math.random() * canvas.width
          }
        })
      } else {
        drops.forEach((d) => {
          ctx.beginPath()
          ctx.moveTo(d.x, d.y)
          ctx.lineTo(d.x - 2, d.y + d.length)
          ctx.strokeStyle = `rgba(174, 194, 224, ${d.opacity})`
          ctx.lineWidth = 1.5
          ctx.stroke()
          d.y += d.speed
          d.x -= 0.5
          if (d.y > canvas.height) {
            d.y = -d.length
            d.x = Math.random() * canvas.width
          }
        })
      }

      animRef.current = requestAnimationFrame(draw)
    }

    draw()

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', handleResize)
    }
  }, [isRainy, isSnowy, isStormy])

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: gradient,
          zIndex: -2,
          transition: 'background 1.5s ease',
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          pointerEvents: 'none',
        }}
      />
    </>
  )
}
