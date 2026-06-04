import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 10
    const offset = (page - 1) * pageSize

    const conditions: string[] = []
    const params: unknown[] = []

    if (req.query.startTime) {
      conditions.push('a.created_at >= ?')
      params.push(req.query.startTime)
    }
    if (req.query.endTime) {
      conditions.push('a.created_at <= ?')
      params.push(req.query.endTime)
    }
    if (req.query.keyId) {
      conditions.push('a.key_id = ?')
      params.push(req.query.keyId)
    }
    if (req.query.doorId) {
      conditions.push('a.door_id = ?')
      params.push(req.query.doorId)
    }
    if (req.query.method) {
      conditions.push('a.method = ?')
      params.push(req.query.method)
    }
    if (req.query.success !== undefined && req.query.success !== '') {
      conditions.push('a.success = ?')
      params.push(parseInt(req.query.success as string))
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const totalResult = db.prepare(
      `SELECT COUNT(*) as count FROM access_logs a ${whereClause}`
    ).get(...params) as { count: number }

    const logs = db.prepare(
      `SELECT a.*, u.display_name as user_name, k.key_name, d.name as door_name
       FROM access_logs a
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN keys k ON a.key_id = k.id
       LEFT JOIN doors d ON a.door_id = d.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset)

    res.json({
      success: true,
      logs,
      total: totalResult.count,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('get logs error:', error)
    res.status(500).json({ success: false, message: '获取日志列表失败' })
  }
})

export default router
