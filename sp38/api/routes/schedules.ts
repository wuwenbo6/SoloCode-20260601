import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

router.get('/:doorId', (req: Request, res: Response): void => {
  try {
    const { doorId } = req.params
    const schedules = db.prepare(
      'SELECT * FROM door_schedules WHERE door_id = ? ORDER BY day_of_week, start_time'
    ).all(doorId) as { id: string; day_of_week: number; start_time: string; end_time: string; enabled: number }[]

    const result = schedules.map((s) => ({
      ...s,
      dayName: dayNames[s.day_of_week],
    }))

    res.json({ success: true, schedules: result })
  } catch (error) {
    console.error('get schedules error:', error)
    res.status(500).json({ success: false, message: '获取时间表失败' })
  }
})

router.post('/', (req: Request, res: Response): void => {
  try {
    const { doorId, dayOfWeek, startTime, endTime, grantedBy } = req.body

    const door = db.prepare('SELECT * FROM doors WHERE id = ?').get(doorId) as
      | { id: string }
      | undefined
    if (!door) {
      res.status(404).json({ success: false, message: '门禁不存在' })
      return
    }

    const id = uuidv4()
    db.prepare(
      'INSERT INTO door_schedules (id, door_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)'
    ).run(id, doorId, dayOfWeek, startTime, endTime)

    res.json({
      success: true,
      schedule: { id, doorId, dayOfWeek, dayName: dayNames[dayOfWeek], startTime, endTime, enabled: 1 },
    })
  } catch (error) {
    console.error('create schedule error:', error)
    res.status(500).json({ success: false, message: '创建时间表失败' })
  }
})

router.put('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { startTime, endTime, enabled } = req.body

    const sets: string[] = []
    const params: unknown[] = []

    if (startTime !== undefined) { sets.push('start_time = ?'); params.push(startTime) }
    if (endTime !== undefined) { sets.push('end_time = ?'); params.push(endTime) }
    if (enabled !== undefined) { sets.push('enabled = ?'); params.push(enabled ? 1 : 0) }

    if (sets.length === 0) {
      res.status(400).json({ success: false, message: '无更新字段' })
      return
    }

    params.push(id)
    db.prepare(`UPDATE door_schedules SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    res.json({ success: true, message: '时间表已更新' })
  } catch (error) {
    console.error('update schedule error:', error)
    res.status(500).json({ success: false, message: '更新时间表失败' })
  }
})

router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const result = db.prepare('DELETE FROM door_schedules WHERE id = ?').run(id)
    if (result.changes === 0) {
      res.status(404).json({ success: false, message: '时间表不存在' })
      return
    }
    res.json({ success: true, message: '时间表已删除' })
  } catch (error) {
    console.error('delete schedule error:', error)
    res.status(500).json({ success: false, message: '删除时间表失败' })
  }
})

export default router
