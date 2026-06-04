import { Router, type Request, type Response } from 'express'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { broadcastEvent } from '../websocket.js'
import { checkDoorSchedule } from './visitors.js'

const router = Router()

const challenges = new Map<string, string>()
const seenNfcTokens = new Map<string, number>()

function cleanOldNfcTokens() {
  const now = Date.now()
  for (const [token, ts] of seenNfcTokens.entries()) {
    if (now - ts > 5000) {
      seenNfcTokens.delete(token)
    }
  }
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (const byte of bytes) {
    str += String.fromCharCode(byte)
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

router.post('/registration-start', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, keyName } = req.body

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
      | { id: string; username: string; display_name: string; role: string }
      | undefined

    if (!user) {
      res.status(404).json({ success: false, message: '用户不存在' })
      return
    }

    const existingKeys = db.prepare('SELECT * FROM keys WHERE user_id = ?').all(user.id) as {
      id: string
      credential_id: string
      transports: string | null
    }[]

    const excludeCredentials = existingKeys.map((key) => ({
      id: base64urlToBuffer(key.credential_id),
      type: 'public-key' as const,
      transports: key.transports ? (JSON.parse(key.transports) as AuthenticatorTransport[]) : undefined,
    }))

    const options = await generateRegistrationOptions({
      rpID: 'localhost',
      rpName: '智能门禁系统',
      userID: user.id,
      userName: user.username,
      userDisplayName: user.display_name,
      excludeCredentials,
      supportedAlgorithmIDs: [-7, -257],
    })

    challenges.set(username, options.challenge)

    res.json({ success: true, options })
  } catch (error) {
    console.error('registration-start error:', error)
    res.status(500).json({ success: false, message: '注册启动失败' })
  }
})

router.post('/registration-finish', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, keyName, credential } = req.body

    const expectedChallenge = challenges.get(username)
    if (!expectedChallenge) {
      res.status(400).json({ success: false, message: '未找到对应的注册挑战' })
      return
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: 'http://localhost:5173',
      expectedRPID: 'localhost',
    })

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ success: false, message: '注册验证失败' })
      return
    }

    const { registrationInfo } = verification
    const keyId = uuidv4()
    const credentialId = bufferToBase64url(registrationInfo.credentialID)
    const publicKey = bufferToBase64url(registrationInfo.credentialPublicKey)

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
      | { id: string }
      | undefined

    db.prepare(
      'INSERT INTO keys (id, user_id, key_name, credential_id, public_key, counter, transports) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      keyId,
      user!.id,
      keyName || '默认密钥',
      credentialId,
      publicKey,
      registrationInfo.credentialDeviceType === 'multiDevice' ? 0 : registrationInfo.counter,
      credential.response.transports ? JSON.stringify(credential.response.transports) : null
    )

    challenges.delete(username)

    res.json({ success: true, keyId, message: '注册成功' })
  } catch (error) {
    console.error('registration-finish error:', error)
    res.status(500).json({ success: false, message: '注册完成失败' })
  }
})

router.post('/authentication-start', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.body

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
      | { id: string }
      | undefined

    if (!user) {
      res.status(404).json({ success: false, message: '用户不存在' })
      return
    }

    const userKeys = db.prepare('SELECT * FROM keys WHERE user_id = ?').all(user.id) as {
      id: string
      credential_id: string
      transports: string | null
    }[]

    if (userKeys.length === 0) {
      res.status(400).json({ success: false, message: '该用户尚未注册密钥' })
      return
    }

    const allowCredentials = userKeys.map((key) => ({
      id: base64urlToBuffer(key.credential_id),
      type: 'public-key' as const,
      transports: key.transports ? (JSON.parse(key.transports) as AuthenticatorTransport[]) : undefined,
    }))

    const options = await generateAuthenticationOptions({
      rpID: 'localhost',
      allowCredentials,
    })

    challenges.set(username, options.challenge)

    res.json({ success: true, options })
  } catch (error) {
    console.error('authentication-start error:', error)
    res.status(500).json({ success: false, message: '认证启动失败' })
  }
})

router.post('/authentication-verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, credential, gps, method, doorId } = req.body

    const expectedChallenge = challenges.get(username)
    if (!expectedChallenge) {
      res.status(400).json({ success: false, message: '未找到对应的认证挑战' })
      return
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
      | { id: string; display_name: string; role: string }
      | undefined

    if (!user) {
      res.status(404).json({ success: false, message: '用户不存在' })
      return
    }

    const credentialIdBase64 = bufferToBase64url(
      base64urlToBuffer(credential.id)
    )

    const key = db.prepare('SELECT * FROM keys WHERE credential_id = ?').get(credentialIdBase64) as
      | { id: string; user_id: string; credential_id: string; public_key: string; counter: number }
      | undefined

    if (!key) {
      res.status(400).json({ success: false, message: '未找到对应密钥' })
      return
    }

    if (doorId) {
      const scheduleCheck = checkDoorSchedule(doorId)
      if (!scheduleCheck.allowed) {
        const logId = uuidv4()
        db.prepare(
          'INSERT INTO access_logs (id, user_id, key_id, door_id, method, success, operator_type, operator_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(logId, user.id, key.id, doorId, method, 0, user.role, user.display_name)
        res.json({ success: false, message: `不在允许时段：${scheduleCheck.reason}`, logId })
        return
      }

      const doorKey = db.prepare('SELECT * FROM door_keys WHERE door_id = ? AND key_id = ?').get(doorId, key.id)
      if (!doorKey) {
        const logId = uuidv4()
        db.prepare(
          'INSERT INTO access_logs (id, user_id, key_id, door_id, method, success, operator_type, operator_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(logId, user.id, key.id, doorId, method, 0, user.role, user.display_name)
        res.json({ success: false, message: '该密钥无权通行此门禁', logId })
        return
      }
    }

    let verified = false
    let newCounter = key.counter

    try {
      const authenticationInfo = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: 'http://localhost:5173',
        expectedRPID: 'localhost',
        authenticator: {
          credentialID: new Uint8Array(base64urlToBuffer(key.credential_id)),
          credentialPublicKey: new Uint8Array(base64urlToBuffer(key.public_key)),
          counter: key.counter,
        },
      })

      verified = authenticationInfo.verified
      newCounter = authenticationInfo.authenticationInfo.newCounter
    } catch (e) {
      verified = false
    }

    const logId = uuidv4()
    const latitude = gps?.latitude ?? null
    const longitude = gps?.longitude ?? null

    if (verified) {
      db.prepare(
        'INSERT INTO access_logs (id, user_id, key_id, door_id, method, latitude, longitude, success, operator_type, operator_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(logId, user.id, key.id, doorId, method, latitude, longitude, 1, user.role, user.display_name)

      db.prepare('UPDATE keys SET counter = ?, last_used_at = datetime(\'now\') WHERE id = ?').run(newCounter, key.id)
    } else {
      db.prepare(
        'INSERT INTO access_logs (id, user_id, key_id, door_id, method, latitude, longitude, success, operator_type, operator_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(logId, user.id, key.id, doorId, method, latitude, longitude, 0, user.role, user.display_name)
    }

    challenges.delete(username)

    const door = db.prepare('SELECT * FROM doors WHERE id = ?').get(doorId) as
      | { name: string }
      | undefined

    broadcastEvent({
      type: 'access_log',
      data: {
        id: logId,
        userId: user.id,
        keyId: key.id,
        doorId,
        doorName: door?.name,
        method,
        success: verified ? 1 : 0,
        operatorType: user.role,
        operatorName: user.display_name,
        latitude,
        longitude,
      },
    })

    res.json({
      success: verified,
      message: verified ? '认证成功' : '认证失败',
      logId,
    })
  } catch (error) {
    console.error('authentication-verify error:', error)
    res.status(500).json({ success: false, message: '认证验证失败' })
  }
})

router.post('/nfc-auth', async (req: Request, res: Response): Promise<void> => {
  try {
    const { nfcTagId, username, gps, doorId, authToken } = req.body

    const dedupKey = `${nfcTagId}:${doorId}:${authToken || ''}`
    cleanOldNfcTokens()

    if (seenNfcTokens.has(dedupKey)) {
      res.status(200).json({ success: false, message: '重复认证，请稍后再试', deduplicated: true })
      return
    }
    seenNfcTokens.set(dedupKey, Date.now())

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
      | { id: string; display_name: string; role: string }
      | undefined

    if (!user) {
      res.status(404).json({ success: false, message: '用户不存在' })
      return
    }

    const key = db.prepare('SELECT * FROM keys WHERE credential_id = ?').get(nfcTagId) as
      | { id: string; user_id: string }
      | undefined

    if (doorId) {
      const scheduleCheck = checkDoorSchedule(doorId)
      if (!scheduleCheck.allowed) {
        const logId = uuidv4()
        db.prepare(
          'INSERT INTO access_logs (id, user_id, key_id, door_id, method, latitude, longitude, success, operator_type, operator_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(logId, user.id, key?.id ?? null, doorId, 'nfc', gps?.latitude ?? null, gps?.longitude ?? null, 0, user.role, user.display_name)
        res.json({ success: false, message: `不在允许时段：${scheduleCheck.reason}`, logId })
        return
      }

      if (key) {
        const doorKey = db.prepare('SELECT * FROM door_keys WHERE door_id = ? AND key_id = ?').get(doorId, key.id)
        if (!doorKey) {
          const logId = uuidv4()
          db.prepare(
            'INSERT INTO access_logs (id, user_id, key_id, door_id, method, latitude, longitude, success, operator_type, operator_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(logId, user.id, key.id, doorId, 'nfc', gps?.latitude ?? null, gps?.longitude ?? null, 0, user.role, user.display_name)
          res.json({ success: false, message: '该密钥无权通行此门禁', logId })
          return
        }
      }
    }

    const logId = uuidv4()
    const latitude = gps?.latitude ?? null
    const longitude = gps?.longitude ?? null
    const success = key ? 1 : 0

    db.prepare(
      'INSERT INTO access_logs (id, user_id, key_id, door_id, method, latitude, longitude, success, operator_type, operator_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      logId,
      user.id,
      key?.id ?? null,
      doorId,
      'nfc',
      latitude,
      longitude,
      success,
      user.role,
      user.display_name
    )

    if (key) {
      db.prepare('UPDATE keys SET last_used_at = datetime(\'now\') WHERE id = ?').run(key.id)
    }

    const door = db.prepare('SELECT * FROM doors WHERE id = ?').get(doorId) as
      | { name: string }
      | undefined

    broadcastEvent({
      type: 'access_log',
      data: {
        id: logId,
        userId: user.id,
        keyId: key?.id,
        doorId,
        doorName: door?.name,
        method: 'nfc',
        success,
        operatorType: user.role,
        operatorName: user.display_name,
        latitude,
        longitude,
      },
    })

    res.json({
      success: success === 1,
      message: success === 1 ? 'NFC认证成功' : 'NFC标签未注册',
      logId,
    })
  } catch (error) {
    console.error('nfc-auth error:', error)
    res.status(500).json({ success: false, message: 'NFC认证失败' })
  }
})

export default router
