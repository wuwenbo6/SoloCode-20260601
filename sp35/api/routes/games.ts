import { Router, type Request, type Response } from 'express'
import type { GameInfo } from '../../shared/types.js'

const router = Router()

const games: GameInfo[] = [
  {
    id: 'space-defender',
    name: '星际守卫',
    description: '操控战舰抵御外星入侵，保卫星球家园',
    thumbnail: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=retro%20space%20shooter%20game%20cover%20art%2C%20pixel%20style%20spaceship%20fighting%20aliens%2C%20dark%20space%20background%20with%20stars%2C%20neon%20colors&image_size=landscape_16_9'
  },
  {
    id: 'neon-racer',
    name: '霓虹飞车',
    description: '在赛博朋克都市中极速狂飙，闪避障碍',
    thumbnail: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cyberpunk%20racing%20game%20cover%2C%20neon%20lights%20city%20street%20at%20night%2C%20futuristic%20car%2C%20synthwave%20style&image_size=landscape_16_9'
  },
  {
    id: 'pixel-adventure',
    name: '像素冒险',
    description: '探索神秘地下城，收集宝物，击败怪物',
    thumbnail: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=pixel%20art%20dungeon%20crawler%20game%20cover%2C%20retro%20RPG%20hero%20exploring%20cave%2C%20treasure%20chest%2C%20dark%20fantasy&image_size=landscape_16_9'
  }
]

router.get('/', (_req: Request, res: Response) => {
  res.json(games)
})

export default router
