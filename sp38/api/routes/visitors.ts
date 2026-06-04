import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import QRCode from 'qrcode'
import db from '../db.js'
import { broadcastEvent } from '../websocket.js'

const router = Router()

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, visitorName, doorId, expiresInMinutes, createdBy } = req.body

    const door = db.prepare('SELECT * FROM doors WHERE id = ?').get(doorId) as
      | { id: string; name: string }
      | undefined

    if (!door) {
      res.status(404).json({ success: false, message: '门禁不存在' })
      return
    }

    const code = generateCode()
    const id = uuidv4()
    const minutes = expiresInMinutes || 60
    const expiresAt = new Date(Date.now() + minutes * 60000).toISOString()

    db.prepare(
      'INSERT INTO visitor_keys (id, code, phone, visitor_name, door_id, created_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, code, phone, visitorName || '', doorId, createdBy, expiresAt)

    const qrData = JSON.stringify({ code, doorId, doorName: door.name, expiresAt })
    const qrImage = await QRCode.toDataURL(qrData, { width: 256, margin: 2 })

    res.json({
      success: true,
      visitorKey: {
        id,
        code,
        phone,
        visitorName: visitorName || '',
        doorId,
        doorName: door.name,
        expiresAt,
        qrImage,
      },
    })
  } catch (error) {
    console.error('generate visitor key error:', error)
    res.status(500).json({ success: false, message: '生成访客密钥失败' })
  }
})

router.get('/', (req: Request, res: Response): void => {
  try {
    const status = req.query.status as string | undefined
    let query = `
      SELECT vk.*, d.name as door_name, u.display_name as creator_name
      FROM visitor_keys vk
      JOIN doors d ON vk.door_id = d.id
      JOIN users u ON vk.created_by = u.id
    `
    const params: unknown[] = []
    if (status) {
      query += ' WHERE vk.status = ?'
      params.push(status)
    }
    query += ' ORDER BY vk.created_at DESC'

    const visitorKeys = db.prepare(query).all(...params)
    res.json({ success: true, visitorKeys })
  } catch (error) {
    console.error('get visitor keys error:', error)
    res.status(500).json({ success: false, message: '获取访客密钥列表失败' })
  }
})

router.post('/verify', (req: Request, res: Response): Promise<void> => {
  try {
    const { code, doorId, gps } = req.body

    const vk = db.prepare('SELECT * FROM visitor_keys WHERE code = ? AND door_id = ?').get(code, doorId) as
      | { id: string; code: string; phone: string; visitor_name: string; door_id: string; expires_at: string; used_at: string | null; status: string }
      | undefined

    if (!vk) {
      res.json({ success: false, message: '访客码无效或门禁点不匹配' })
      return
    }

    if (vk.status !== 'active') {
      const statusMsg = vk.status === 'used' ? '访客码已使用' : vk.status === 'expired' ? '访客码已过期' : '访客码已撤销'
      res.json({ success: false, message: statusMsg })
      return
    }

    const now = new Date()
    const expiresAt = new Date(vk.expires_at)
    if (now > expiresAt) {
      db.prepare('UPDATE visitor_keys SET status = ? WHERE id = ?').run('expired', vk.id)
      res.json({ success: false, message: '访客码已过期' })
      return
    }

    const scheduleCheck = checkDoorSchedule(vk.door_id)
    if (!scheduleCheck.allowed) {
      res.json({ success: false, message: `不在允许时段内：${scheduleCheck.reason}` })
      return
    }

    db.prepare('UPDATE visitor_keys SET status = ?, used_at = datetime(\'now\') WHERE id = ?').run('used', vk.id)

    const logId = uuidv4()
    const latitude = gps?.latitude ?? null
    const longitude = gps?.longitude ?? null

    db.prepare(
      'INSERT INTO access_logs (id, door_id, method, latitude, longitude, success, operator_type, operator_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(logId, doorId, 'visitor', latitude, longitude, 1, 'visitor', `访客:${vk.visitor_name || vk.phone}`)

    const door = db.prepare('SELECT * FROM doors WHERE id = ?').get(doorId) as { name: string } | undefined

    broadcastEvent({
      type: 'access_log',
      data: {
        id: logId,
        doorId,
        doorName: door?.name,
        method: 'visitor',
        success: 1,
        operatorType: 'visitor',
        operatorName: `访客:${vk.visitor_name || vk.phone}`,
        latitude,
        longitude,
      },
    })

    res.json({
      success: true,
      message: '访客认证成功',
      logId,
      visitorName: vk.visitor_name,
      phone: vk.phone,
    })
  } catch (error) {
    console.error('verify visitor key error:', error)
    res.status(500).json({ success: false, message: '访客认证失败' })
  }
  return undefined as any
})

router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const result = db.prepare('UPDATE visitor_keys SET status = ? WHERE id = ? AND status = ?').run('revoked', id, 'active')
    if (result.changes === 0) {
      res.status(404).json({ success: false, message: '访客密钥不存在或已失效' })
      return
    }
    res.json({ success: true, message: '访客密钥已撤销' })
  } catch (error) {
    console.error('revoke visitor key error:', error)
    res.status(500).json({ success: false, message: '撤销访客密钥失败' })
  }
})

function checkDoorSchedule(doorId: string): { allowed: boolean; reason?: string } {
  const schedules = db.prepare(
    'SELECT * FROM door_schedules WHERE door_id = ? AND enabled = 1'
  ).all(doorId) as { day_of_week: number; start_time: string; end_time: string }[]

  if (schedules.length === 0) {
    return { allowed: true }
  }

  const now = new Date()
  const dayOfWeek = now.getDay()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const todaySchedule = schedules.find((s) => s.day_of_week === dayOfWeek)
  if (!todaySchedule) {
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return { allowed: false, reason: `${dayNames[dayOfWeek]}不允许通行` }
  }

  if (currentTime < todaySchedule.start_time || currentTime > todaySchedule.end_time) {
    return { allowed: false, reason: `允许时段 ${todaySchedule.start_time}-${todaySchedule.end_time}` }
  }

  return { allowed: true }
}

export { checkDoorSchedule }
export default router
