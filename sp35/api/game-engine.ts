import type { GameObject } from '../shared/types.js'

interface Player {
  x: number
  y: number
  width: number
  height: number
  alive: boolean
  shootCooldown: number
}

interface Enemy {
  x: number
  y: number
  width: number
  height: number
  speed: number
  hp: number
  type: number
  id: string
}

interface Bullet {
  x: number
  y: number
  width: number
  height: number
  speed: number
  id: string
}

interface Star {
  x: number
  y: number
  size: number
  speed: number
  opacity: number
  id: string
}

interface Explosion {
  x: number
  y: number
  radius: number
  maxRadius: number
  opacity: number
  color: string
  id: string
}

interface InputState {
  left: boolean
  right: boolean
  shoot: boolean
  start: boolean
}

export class SpaceDefenderGame {
  private width: number
  private height: number
  private player: Player
  private enemies: Enemy[] = []
  private bullets: Bullet[] = []
  private stars: Star[] = []
  private explosions: Explosion[] = []
  private score = 0
  private gameOver = false
  private wave = 1
  private enemySpawnTimer = 0
  private enemySpawnInterval = 60
  private enemiesInWave = 0
  private enemiesPerWave = 8
  private input: InputState = { left: false, right: false, shoot: false, start: false }
  private mouseX: number | null = null
  private useMouseControl = false
  private idCounter = 0
  private tickCount = 0
  private playerSpeed = 6
  private bulletSpeed = 10
  private shootCooldownMax = 8
  private maxBullets = 10
  private difficultyMultiplier = 1
  private lastProcessedInputSeq = 0

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.player = {
      x: width / 2,
      y: height - 80,
      width: 40,
      height: 50,
      alive: true,
      shootCooldown: 0,
    }
    this.initStars()
  }

  resize(width: number, height: number) {
    const scaleX = width / this.width
    const scaleY = height / this.height

    this.width = width
    this.height = height

    this.player.x = Math.min(this.player.x * scaleX, width - this.player.width / 2)
    this.player.y = height - 80

    for (const star of this.stars) {
      star.x *= scaleX
      star.y *= scaleY
    }
    for (const enemy of this.enemies) {
      enemy.x *= scaleX
      enemy.y *= scaleY
    }
    for (const bullet of this.bullets) {
      bullet.x *= scaleX
      bullet.y *= scaleY
    }
    for (const explosion of this.explosions) {
      explosion.x *= scaleX
      explosion.y *= scaleY
      explosion.radius *= Math.min(scaleX, scaleY)
      explosion.maxRadius *= Math.min(scaleX, scaleY)
    }
  }

  private genId(): string {
    return `o${++this.idCounter}`
  }

  private initStars() {
    this.stars = []
    for (let i = 0; i < 80; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 2 + 1,
        speed: Math.random() * 1.5 + 0.3,
        opacity: Math.random() * 0.7 + 0.3,
        id: this.genId(),
      })
    }
  }

  setInput(key: string, value: boolean) {
    if (key === 'left') this.input.left = value
    if (key === 'right') this.input.right = value
    if (key === 'shoot') this.input.shoot = value
    if (key === 'start' && value) {
      if (this.gameOver) {
        this.restart()
      }
    }
  }

  setMouseX(x: number) {
    this.mouseX = x
    this.useMouseControl = true
  }

  setLastProcessedInput(seq: number) {
    this.lastProcessedInputSeq = seq
  }

  getLastProcessedInput(): number {
    return this.lastProcessedInputSeq
  }

  getPlayerState() {
    return {
      x: this.player.x,
      y: this.player.y,
      alive: this.player.alive,
    }
  }

  private restart() {
    this.player.x = this.width / 2
    this.player.y = this.height - 80
    this.player.alive = true
    this.player.shootCooldown = 0
    this.enemies = []
    this.bullets = []
    this.explosions = []
    this.score = 0
    this.gameOver = false
    this.wave = 1
    this.enemySpawnTimer = 0
    this.enemySpawnInterval = 60
    this.enemiesInWave = 0
    this.enemiesPerWave = 8
    this.difficultyMultiplier = 1
    this.mouseX = null
    this.useMouseControl = false
  }

  update() {
    this.tickCount++
    this.updateStars()
    this.updateExplosions()

    if (this.gameOver) return

    this.updatePlayer()
    this.updateBullets()
    this.updateEnemies()
    this.spawnEnemies()
    this.checkCollisions()

    if (this.input.start && this.gameOver) {
      this.restart()
    }
  }

  private updatePlayer() {
    if (!this.player.alive) return

    if (this.useMouseControl && this.mouseX !== null) {
      const targetX = this.mouseX
      const diff = targetX - this.player.x
      if (Math.abs(diff) > 2) {
        this.player.x += diff * 0.15
      }
    } else {
      if (this.input.left) this.player.x -= this.playerSpeed
      if (this.input.right) this.player.x += this.playerSpeed
    }

    this.player.x = Math.max(this.player.width / 2, Math.min(this.width - this.player.width / 2, this.player.x))

    if (this.player.shootCooldown > 0) {
      this.player.shootCooldown--
    }

    if (this.input.shoot && this.player.shootCooldown <= 0 && this.bullets.length < this.maxBullets) {
      this.bullets.push({
        x: this.player.x,
        y: this.player.y - this.player.height / 2,
        width: 4,
        height: 14,
        speed: this.bulletSpeed,
        id: this.genId(),
      })
      this.player.shootCooldown = this.shootCooldownMax
    }
  }

  private updateBullets() {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      this.bullets[i].y -= this.bullets[i].speed
      if (this.bullets[i].y + this.bullets[i].height < 0) {
        this.bullets.splice(i, 1)
      }
    }
  }

  private updateEnemies() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      enemy.y += enemy.speed

      if (enemy.type === 1) {
        enemy.x += Math.sin(this.tickCount * 0.05 + i) * 1.5
      } else if (enemy.type === 2) {
        enemy.x += Math.cos(this.tickCount * 0.03 + i * 0.7) * 2
      }

      if (enemy.y > this.height + 50) {
        this.enemies.splice(i, 1)
        this.score = Math.max(0, this.score - 5)
      }
    }
  }

  private spawnEnemies() {
    this.enemySpawnTimer++
    if (this.enemySpawnTimer >= this.enemySpawnInterval) {
      this.enemySpawnTimer = 0

      const count = Math.min(1 + Math.floor(this.wave / 3), 3)
      for (let i = 0; i < count; i++) {
        if (this.enemiesInWave >= this.enemiesPerWave) break

        const typeRoll = Math.random()
        let type = 0
        let hp = 1
        let speed = (1.5 + Math.random() * 1.5) * this.difficultyMultiplier
        let w = 36
        let h = 36

        if (typeRoll > 0.7 && this.wave >= 2) {
          type = 1
          hp = 2
          speed = (1.2 + Math.random()) * this.difficultyMultiplier
          w = 44
          h = 44
        } else if (typeRoll > 0.5 && this.wave >= 3) {
          type = 2
          hp = 3
          speed = (0.8 + Math.random() * 0.8) * this.difficultyMultiplier
          w = 52
          h = 52
        }

        this.enemies.push({
          x: 40 + Math.random() * (this.width - 80),
          y: -40 - Math.random() * 60,
          width: w,
          height: h,
          speed,
          hp,
          type,
          id: this.genId(),
        })
        this.enemiesInWave++
      }
    }

    if (this.enemiesInWave >= this.enemiesPerWave && this.enemies.length === 0) {
      this.wave++
      this.enemiesInWave = 0
      this.enemiesPerWave = 8 + this.wave * 3
      this.enemySpawnInterval = Math.max(20, 60 - this.wave * 4)
      this.difficultyMultiplier = 1 + (this.wave - 1) * 0.12
    }
  }

  private checkCollisions() {
    for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
      const bullet = this.bullets[bi]
      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const enemy = this.enemies[ei]
        if (this.rectsOverlap(
          bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height,
          enemy.x - enemy.width / 2, enemy.y - enemy.height / 2, enemy.width, enemy.height,
        )) {
          enemy.hp--
          this.bullets.splice(bi, 1)

          if (enemy.hp <= 0) {
            this.createExplosion(enemy.x, enemy.y, enemy.type === 2 ? '#ff6600' : enemy.type === 1 ? '#ffaa00' : '#ff3300')
            this.enemies.splice(ei, 1)
            const baseScore = enemy.type === 2 ? 30 : enemy.type === 1 ? 20 : 10
            this.score += baseScore * this.wave
          }
          break
        }
      }
    }

    if (this.player.alive) {
      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const enemy = this.enemies[ei]
        if (this.rectsOverlap(
          this.player.x - this.player.width / 2, this.player.y - this.player.height / 2, this.player.width, this.player.height,
          enemy.x - enemy.width / 2, enemy.y - enemy.height / 2, enemy.width, enemy.height,
        )) {
          this.player.alive = false
          this.gameOver = true
          this.createExplosion(this.player.x, this.player.y, '#00ff66')
          this.createExplosion(this.player.x - 15, this.player.y + 10, '#00ffcc')
          this.createExplosion(this.player.x + 15, this.player.y - 10, '#66ff00')
          break
        }
      }
    }
  }

  private rectsOverlap(x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number): boolean {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2
  }

  private createExplosion(x: number, y: number, color: string) {
    this.explosions.push({
      x,
      y,
      radius: 5,
      maxRadius: 35 + Math.random() * 15,
      opacity: 1,
      color,
      id: this.genId(),
    })
  }

  private updateExplosions() {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i]
      exp.radius += 2
      exp.opacity -= 0.04
      if (exp.opacity <= 0 || exp.radius >= exp.maxRadius) {
        this.explosions.splice(i, 1)
      }
    }
  }

  private updateStars() {
    for (const star of this.stars) {
      star.y += star.speed
      if (star.y > this.height) {
        star.y = 0
        star.x = Math.random() * this.width
      }
    }
  }

  getScore(): number {
    return this.score
  }

  getObjects(): GameObject[] {
    const objects: GameObject[] = []

    for (const star of this.stars) {
      objects.push({
        id: star.id,
        type: 'star',
        x: star.x,
        y: star.y,
        width: star.size,
        height: star.size,
        color: '#ffffff',
        opacity: star.opacity,
      })
    }

    if (this.player.alive) {
      const engineGlow = Math.sin(this.tickCount * 0.3) * 0.2 + 0.8
      objects.push({
        id: 'player-engine',
        type: 'explosion',
        x: this.player.x,
        y: this.player.y + this.player.height / 2 + 6,
        width: 16,
        height: 16,
        color: '#00aaff',
        opacity: engineGlow,
      })
      objects.push({
        id: 'player-engine-l',
        type: 'explosion',
        x: this.player.x - 8,
        y: this.player.y + this.player.height / 2 + 3,
        width: 8,
        height: 8,
        color: '#00ddff',
        opacity: engineGlow * 0.6,
      })
      objects.push({
        id: 'player-engine-r',
        type: 'explosion',
        x: this.player.x + 8,
        y: this.player.y + this.player.height / 2 + 3,
        width: 8,
        height: 8,
        color: '#00ddff',
        opacity: engineGlow * 0.6,
      })

      objects.push({
        id: 'player',
        type: 'player',
        x: this.player.x,
        y: this.player.y,
        width: this.player.width,
        height: this.player.height,
        color: '#00ff66',
        rotation: 0,
        lastProcessedInput: this.lastProcessedInputSeq,
      } as GameObject & { lastProcessedInput: number })
    }

    for (const bullet of this.bullets) {
      objects.push({
        id: bullet.id,
        type: 'bullet',
        x: bullet.x,
        y: bullet.y,
        width: bullet.width,
        height: bullet.height,
        color: '#ffff00',
      })
    }

    for (const enemy of this.enemies) {
      let color = '#ff3333'
      if (enemy.type === 1) color = '#ff8800'
      if (enemy.type === 2) color = '#cc00ff'

      objects.push({
        id: enemy.id,
        type: 'enemy',
        x: enemy.x,
        y: enemy.y,
        width: enemy.width,
        height: enemy.height,
        color,
        rotation: enemy.type === 1 ? Math.PI / 4 : 0,
      })

      if (enemy.hp > 1) {
        const hpBarWidth = enemy.width
        const hpRatio = enemy.hp / (enemy.type === 2 ? 3 : 2)
        objects.push({
          id: `${enemy.id}-hpbg`,
          type: 'text',
          x: enemy.x,
          y: enemy.y - enemy.height / 2 - 8,
          width: hpBarWidth,
          height: 4,
          color: '#333333',
        })
        objects.push({
          id: `${enemy.id}-hp`,
          type: 'text',
          x: enemy.x - hpBarWidth / 2 + (hpBarWidth * hpRatio) / 2,
          y: enemy.y - enemy.height / 2 - 8,
          width: hpBarWidth * hpRatio,
          height: 4,
          color: '#00ff00',
        })
      }
    }

    for (const exp of this.explosions) {
      objects.push({
        id: exp.id,
        type: 'explosion',
        x: exp.x,
        y: exp.y,
        width: exp.radius * 2,
        height: exp.radius * 2,
        color: exp.color,
        opacity: exp.opacity,
      })
    }

    objects.push({
      id: 'score-text',
      type: 'text',
      x: 20,
      y: 30,
      width: 200,
      height: 24,
      color: '#ffffff',
      text: `SCORE: ${this.score}`,
      fontSize: 22,
    })

    objects.push({
      id: 'wave-text',
      type: 'text',
      x: 20,
      y: 58,
      width: 150,
      height: 20,
      color: '#88ccff',
      text: `WAVE: ${this.wave}`,
      fontSize: 18,
    })

    if (this.gameOver) {
      objects.push({
        id: 'gameover-bg',
        type: 'text',
        x: this.width / 2,
        y: this.height / 2 - 40,
        width: 400,
        height: 60,
        color: 'rgba(0,0,0,0.6)',
        text: 'GAME OVER',
        fontSize: 52,
      })

      objects.push({
        id: 'gameover-text',
        type: 'text',
        x: this.width / 2,
        y: this.height / 2 - 40,
        width: 400,
        height: 60,
        color: '#ff3333',
        text: 'GAME OVER',
        fontSize: 52,
      })

      objects.push({
        id: 'final-score',
        type: 'text',
        x: this.width / 2,
        y: this.height / 2 + 20,
        width: 300,
        height: 30,
        color: '#ffffff',
        text: `FINAL SCORE: ${this.score}`,
        fontSize: 24,
      })

      const restartAlpha = Math.sin(this.tickCount * 0.08) * 0.3 + 0.7
      objects.push({
        id: 'restart-text',
        type: 'text',
        x: this.width / 2,
        y: this.height / 2 + 70,
        width: 300,
        height: 24,
        color: '#00ff66',
        text: 'PRESS ENTER OR TAP TO RESTART',
        fontSize: 18,
        opacity: restartAlpha,
      })
    }

    return objects
  }
}
