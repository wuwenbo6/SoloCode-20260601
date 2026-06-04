import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const keys = db.prepare(
      'SELECT k.*, u.username FROM keys k JOIN users u ON k.user_id = u.id'
    ).all()
    res.json({ success: true, keys })
  } catch (error) {
    console.error('get keys error:', error)
    res.status(500).json({ success: false, message: '获取密钥列表失败' })
  }
})

router.delete('/:keyId', (req: Request, res: Response): void => {
  try {
    const { keyId } = req.params
    const result = db.prepare('DELETE FROM keys WHERE id = ?').run(keyId)
    if (result.changes === 0) {
      res.status(404).json({ success: false, message: '密钥不存在' })
      return
    }
    res.json({ success: true, message: '密钥已删除' })
  } catch (error) {
    console.error('delete key error:', error)
    res.status(500).json({ success: false, message: '删除密钥失败' })
  }
})

export default router
