import type { GameInfo } from '../../shared/types'
import { Play } from 'lucide-react'

interface GameCardProps {
  game: GameInfo
  onLaunch: (id: string) => void
}

export default function GameCard({ game, onLaunch }: GameCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-[var(--bg-card)] transition-all duration-300 hover:border-[var(--cyan)]/60 hover:shadow-[0_0_20px_rgba(0,240,255,0.15)]">
      <div className="aspect-video w-full overflow-hidden">
        <img
          src={game.thumbnail}
          alt={game.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="p-4">
        <h3 className="font-heading text-lg font-bold text-white">{game.name}</h3>
        <p className="mt-1 text-sm text-gray-400 line-clamp-2">{game.description}</p>
        <button
          onClick={() => onLaunch(game.id)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--cyan)]/20 py-2.5 font-heading text-sm font-semibold text-[var(--cyan)] transition-all hover:bg-[var(--cyan)]/30 hover:shadow-[0_0_15px_rgba(0,240,255,0.3)]"
        >
          <Play size={16} />
          启动
        </button>
      </div>
    </div>
  )
}
