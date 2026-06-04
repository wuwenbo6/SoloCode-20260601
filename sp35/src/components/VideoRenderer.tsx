import { useEffect, useRef } from 'react'
import type { GameObject } from '../../shared/types'

interface VideoRendererProps {
  objects: GameObject[]
  width: number
  height: number
}

function drawStar(ctx: CanvasRenderingContext2D, obj: GameObject) {
  ctx.save()
  ctx.globalAlpha = obj.opacity ?? 0.5
  ctx.shadowBlur = 6
  ctx.shadowColor = '#ffffff'
  ctx.fillStyle = '#ffffff'
  const r = (obj.width || 2) / 2
  ctx.beginPath()
  ctx.arc(obj.x, obj.y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawPlayer(ctx: CanvasRenderingContext2D, obj: GameObject) {
  ctx.save()
  ctx.shadowBlur = 15
  ctx.shadowColor = '#00ff88'
  ctx.fillStyle = '#00ff88'
  ctx.strokeStyle = '#00ffaa'
  ctx.lineWidth = 2
  const w = obj.width || 30
  const h = obj.height || 40
  ctx.beginPath()
  ctx.moveTo(obj.x, obj.y - h / 2)
  ctx.lineTo(obj.x - w / 2, obj.y + h / 2)
  ctx.lineTo(obj.x, obj.y + h / 3)
  ctx.lineTo(obj.x + w / 2, obj.y + h / 2)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawEnemy(ctx: CanvasRenderingContext2D, obj: GameObject) {
  ctx.save()
  const rotation = obj.rotation || 0
  ctx.translate(obj.x, obj.y)
  ctx.rotate(rotation)
  ctx.shadowBlur = 12
  ctx.shadowColor = '#ff4444'
  const w = obj.width || 28
  const h = obj.height || 28
  const gradient = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2)
  gradient.addColorStop(0, '#ff3333')
  gradient.addColorStop(1, '#ff8800')
  ctx.fillStyle = gradient
  ctx.strokeStyle = '#ff6644'
  ctx.lineWidth = 1.5
  ctx.fillRect(-w / 2, -h / 2, w, h)
  ctx.strokeRect(-w / 2, -h / 2, w, h)
  ctx.restore()
}

function drawBullet(ctx: CanvasRenderingContext2D, obj: GameObject) {
  ctx.save()
  ctx.shadowBlur = 10
  ctx.shadowColor = '#ffff00'
  ctx.fillStyle = '#ffff44'
  const w = obj.width || 4
  const h = obj.height || 12
  ctx.fillRect(obj.x - w / 2, obj.y - h / 2, w, h)
  ctx.restore()
}

function drawExplosion(ctx: CanvasRenderingContext2D, obj: GameObject) {
  ctx.save()
  const opacity = obj.opacity ?? 1
  const size = obj.width || obj.height || 40
  const radius = size / 2
  ctx.globalAlpha = opacity
  ctx.shadowBlur = 25
  ctx.shadowColor = '#ff8800'
  const gradient = ctx.createRadialGradient(obj.x, obj.y, 0, obj.x, obj.y, radius)
  gradient.addColorStop(0, '#ffcc00')
  gradient.addColorStop(0.5, '#ff6600')
  gradient.addColorStop(1, 'transparent')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(obj.x, obj.y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawScore(ctx: CanvasRenderingContext2D, obj: GameObject) {
  ctx.save()
  ctx.shadowBlur = 6
  ctx.shadowColor = '#00f0ff'
  ctx.fillStyle = '#ffffff'
  ctx.font = '18px Orbitron, monospace'
  ctx.textAlign = 'left'
  ctx.fillText(obj.text || '', obj.x, obj.y)
  ctx.restore()
}

function drawGameOver(ctx: CanvasRenderingContext2D, obj: GameObject) {
  ctx.save()
  ctx.shadowBlur = 20
  ctx.shadowColor = '#ff3366'
  ctx.fillStyle = '#ff3366'
  ctx.font = 'bold 48px Orbitron, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(obj.text || 'GAME OVER', obj.x, obj.y)
  ctx.restore()
}

function drawText(ctx: CanvasRenderingContext2D, obj: GameObject) {
  ctx.save()
  if (obj.text) {
    ctx.globalAlpha = obj.opacity ?? 1
    ctx.shadowBlur = 8
    ctx.shadowColor = obj.color || '#ffffff'
    ctx.fillStyle = obj.color || '#ffffff'
    ctx.font = `bold ${obj.fontSize || 16}px Orbitron, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(obj.text, obj.x, obj.y)
  } else {
    ctx.fillStyle = obj.color || '#ffffff'
    ctx.globalAlpha = obj.opacity ?? 1
    const w = obj.width || 0
    const h = obj.height || 0
    ctx.fillRect(obj.x - w / 2, obj.y - h / 2, w, h)
  }
  ctx.restore()
}

export default function VideoRenderer({ objects, width, height }: VideoRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const objectsRef = useRef<GameObject[]>(objects)

  useEffect(() => {
    objectsRef.current = objects
  }, [objects])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number

    function render() {
      if (!ctx) return
      ctx.fillStyle = '#0a0e17'
      ctx.fillRect(0, 0, width, height)

      const objs = objectsRef.current
      for (const obj of objs) {
        switch (obj.type) {
          case 'star':
            drawStar(ctx, obj)
            break
          case 'player':
            drawPlayer(ctx, obj)
            break
          case 'enemy':
            drawEnemy(ctx, obj)
            break
          case 'bullet':
            drawBullet(ctx, obj)
            break
          case 'explosion':
            drawExplosion(ctx, obj)
            break
          case 'score':
            drawScore(ctx, obj)
            break
          case 'gameover':
            drawGameOver(ctx, obj)
            break
          case 'text':
            drawText(ctx, obj)
            break
        }
      }
      animationId = requestAnimationFrame(render)
    }

    animationId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animationId)
  }, [width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="block w-full h-full"
    />
  )
}
