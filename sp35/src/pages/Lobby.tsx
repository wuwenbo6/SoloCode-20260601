import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GameInfo } from '../../shared/types'
import GameCard from '@/components/GameCard'
import ConnectionStatus from '@/components/ConnectionStatus'
import { Gamepad2 } from 'lucide-react'

export default function Lobby() {
  const [games, setGames] = useState<GameInfo[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/games')
      .then((res) => res.json())
      .then((data) => setGames(data))
      .catch(() => {
        setGames([
          { id: 'space-shooter', name: '星际突击', description: '经典太空射击游戏，操控战机消灭入侵的外星舰队', thumbnail: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=space%20shooter%20game%20spaceship%20neon%20cyberpunk%20digital%20art&image_size=landscape_16_9' },
          { id: 'racing', name: '极速飞驰', description: '未来都市赛车，在霓虹灯下穿越高速赛道', thumbnail: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=futuristic%20racing%20game%20neon%20city%20cyberpunk%20digital%20art&image_size=landscape_16_9' },
          { id: 'puzzle', name: '量子迷阵', description: '烧脑解谜游戏，在量子世界中发现隐藏的路径', thumbnail: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=quantum%20puzzle%20game%20abstract%20neon%20digital%20art&image_size=landscape_16_9' },
          { id: 'tower-defense', name: '赛博防线', description: '塔防战略游戏，建造防线抵御赛博敌人的入侵', thumbnail: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cyberpunk%20tower%20defense%20game%20neon%20digital%20art&image_size=landscape_16_9' },
          { id: 'rpg', name: '暗影传说', description: '动作RPG，在黑暗奇幻世界中展开史诗冒险', thumbnail: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=dark%20fantasy%20RPG%20game%20neon%20digital%20art&image_size=landscape_16_9' },
          { id: 'platformer', name: '像素跑酷', description: '快节奏平台跳跃，在像素世界中冲刺冒险', thumbnail: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=pixel%20platformer%20game%20neon%20retro%20digital%20art&image_size=landscape_16_9' },
        ])
      })
  }, [])

  const handleLaunch = (id: string) => {
    navigate(`/play/${id}`)
  }

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] bg-grid-pattern">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-3">
          <Gamepad2 size={28} className="text-[var(--cyan)]" />
          <h1 className="font-heading text-2xl font-bold text-white glow-cyan sm:text-3xl">
            云游戏平台
          </h1>
        </div>
        <ConnectionStatus />
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <GameCard key={game.id} game={game} onLaunch={handleLaunch} />
          ))}
        </div>
      </main>

      <footer className="py-8 text-center text-sm text-gray-600">
        CloudPlay 云游戏平台 · 低延迟串流体验
      </footer>
    </div>
  )
}
