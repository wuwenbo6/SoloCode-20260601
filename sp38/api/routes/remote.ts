import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { broadcastEvent } from '../websocket.js'

const router = Router()

router.post('/open', (req: Request, res: Response): void => {
  try {
    const { doorId, operatorName } = req.body

    const door = db.prepare('SELECT * FROM doors WHERE id = ?').get(doorId) as
      | { id: string; name: string }
      | undefined

    if (!door) {
      res.status(404).json({ success: false, message: '门禁不存在' })
      return
    }

    const logId = uuidv4()

    db.prepare(
      'INSERT INTO access_logs (id, door_id, method, success, operator_type, operator_name) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(logId, doorId, 'remote', 1, 'admin', operatorName)

    broadcastEvent({
      type: 'access_log',
      data: {
        id: logId,
        doorId,
        doorName: door.name,
        method: 'remote',
        success: 1,
        operatorType: 'admin',
        operatorName,
      },
    })

    res.json({
      success: true,
      message: '远程开门成功',
      logId,
    })
  } catch (error) {
    console.error('remote open error:', error)
    res.status(500).json({ success: false, message: '远程开门失败' })
  }
})

export default router
