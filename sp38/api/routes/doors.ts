import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const doors = db.prepare('SELECT * FROM doors').all() as {
      id: string; name: string; location: string; status: string
    }[]

    const result = doors.map((door) => {
      const keyCount = db.prepare('SELECT COUNT(*) as count FROM door_keys WHERE door_id = ?').get(door.id) as { count: number }
      const scheduleCount = db.prepare('SELECT COUNT(*) as count FROM door_schedules WHERE door_id = ? AND enabled = 1').get(door.id) as { count: number }
      return { ...door, keyCount: keyCount.count, scheduleCount: scheduleCount.count }
    })

    res.json({ success: true, doors: result })
  } catch (error) {
    console.error('get doors error:', error)
    res.status(500).json({ success: false, message: '获取门禁列表失败' })
  }
})

router.post('/', (req: Request, res: Response): void => {
  try {
    const { name, location } = req.body
    const id = `door-${uuidv4().substring(0, 8)}`
    db.prepare('INSERT INTO doors (id, name, location) VALUES (?, ?, ?)').run(id, name, location)
    res.json({ success: true, door: { id, name, location, status: 'online' } })
  } catch (error) {
    console.error('create door error:', error)
    res.status(500).json({ success: false, message: '创建门禁失败' })
  }
})

router.put('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { name, location, status } = req.body
    const sets: string[] = []
    const params: unknown[] = []
    if (name !== undefined) { sets.push('name = ?'); params.push(name) }
    if (location !== undefined) { sets.push('location = ?'); params.push(location) }
    if (status !== undefined) { sets.push('status = ?'); params.push(status) }
    if (sets.length === 0) {
      res.status(400).json({ success: false, message: '无更新字段' })
      return
    }
    params.push(id)
    db.prepare(`UPDATE doors SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    res.json({ success: true, message: '门禁已更新' })
  } catch (error) {
    console.error('update door error:', error)
    res.status(500).json({ success: false, message: '更新门禁失败' })
  }
})

router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const result = db.prepare('DELETE FROM doors WHERE id = ?').run(id)
    if (result.changes === 0) {
      res.status(404).json({ success: false, message: '门禁不存在' })
      return
    }
    res.json({ success: true, message: '门禁已删除' })
  } catch (error) {
    console.error('delete door error:', error)
    res.status(500).json({ success: false, message: '删除门禁失败' })
  }
})

router.get('/:id/keys', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const keys = db.prepare(
      `SELECT dk.*, k.key_name, k.credential_id, u.username, u.display_name, g.display_name as granted_by_name
       FROM door_keys dk
       JOIN keys k ON dk.key_id = k.id
       JOIN users u ON k.user_id = u.id
       JOIN users g ON dk.granted_by = g.id
       WHERE dk.door_id = ?`
    ).all(id)
    res.json({ success: true, keys })
  } catch (error) {
    console.error('get door keys error:', error)
    res.status(500).json({ success: false, message: '获取门禁密钥列表失败' })
  }
})

router.post('/:id/keys', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { keyId, grantedBy } = req.body

    const existing = db.prepare('SELECT * FROM door_keys WHERE door_id = ? AND key_id = ?').get(id, keyId)
    if (existing) {
      res.status(409).json({ success: false, message: '密钥已绑定该门禁' })
      return
    }

    db.prepare('INSERT INTO door_keys (door_id, key_id, granted_by) VALUES (?, ?, ?)').run(id, keyId, grantedBy)
    res.json({ success: true, message: '密钥绑定成功' })
  } catch (error) {
    console.error('bind key error:', error)
    res.status(500).json({ success: false, message: '密钥绑定失败' })
  }
})

router.delete('/:doorId/keys/:keyId', (req: Request, res: Response): void => {
  try {
    const { doorId, keyId } = req.params
    const result = db.prepare('DELETE FROM door_keys WHERE door_id = ? AND key_id = ?').run(doorId, keyId)
    if (result.changes === 0) {
      res.status(404).json({ success: false, message: '绑定不存在' })
      return
    }
    res.json({ success: true, message: '密钥解绑成功' })
  } catch (error) {
    console.error('unbind key error:', error)
    res.status(500).json({ success: false, message: '密钥解绑失败' })
  }
})

export default router
