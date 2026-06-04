import { createHelia } from 'helia'
import { unixfs } from '@helia/unixfs'
import { dagCbor } from '@helia/dag-cbor'
import { kadDHT } from '@libp2p/kad-dht'
import { identifyService } from 'libp2p/identify'

let helia = null
let fs = null
let dag = null
let dht = null

const CHUNK_SIZE = 256 * 1024

const commentIndex = new Map()

const uploadProgress = new Map()

export async function initIPFS() {
  if (helia) {
    return { helia, fs, dag, dht }
  }

  console.log('Initializing IPFS node...')
  
  helia = await createHelia({
    start: true,
    libp2p: {
      addresses: {
        listen: ['/ip4/0.0.0.0/tcp/4001', '/ip4/127.0.0.1/tcp/4002/ws']
      },
      services: {
        identify: identifyService(),
        dht: kadDHT({
          clientMode: false
        })
      }
    }
  })

  fs = unixfs(helia)
  dag = dagCbor(helia)
  dht = helia.libp2p.services.dht

  console.log('IPFS node initialized, peer ID:', helia.libp2p.peerId.toString())
  
  return { helia, fs, dag, dht }
}

export function getIPFS() {
  return { helia, fs, dag, dht }
}

export async function stopIPFS() {
  if (helia) {
    await helia.stop()
    console.log('IPFS node stopped')
  }
}

export async function pinCid(cid) {
  if (!helia) throw new Error('IPFS not initialized')
  try {
    const parsedCid = typeof cid === 'string' ? (await import('multiformats/cid')).CID.parse(cid) : cid
    await helia.pins.add(parsedCid)
    console.log(`Pinned CID: ${parsedCid.toString()}`)
    return true
  } catch (error) {
    console.error(`Failed to pin CID ${cid}:`, error.message)
    return false
  }
}

export async function isPinned(cid) {
  if (!helia) return false
  try {
    const parsedCid = typeof cid === 'string' ? (await import('multiformats/cid')).CID.parse(cid) : cid
    for await (const pinnedCid of helia.pins.ls()) {
      if (pinnedCid.toString() === parsedCid.toString()) {
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

export async function retryOperation(operation, maxRetries = 3, delayMs = 1000) {
  let lastError
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      console.log(`Attempt ${attempt}/${maxRetries} failed: ${error.message}`)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt))
      }
    }
  }
  throw lastError
}

export async function addChunkedContent(content, onProgress) {
  const contentBytes = new TextEncoder().encode(content)
  const totalSize = contentBytes.byteLength

  if (totalSize <= CHUNK_SIZE) {
    if (onProgress) onProgress({ phase: 'uploading', chunk: 1, totalChunks: 1, percent: 50 })
    const cid = await retryOperation(async () => {
      return await fs.addBytes(contentBytes)
    })
    if (onProgress) onProgress({ phase: 'pinning', chunk: 1, totalChunks: 1, percent: 90 })
    await pinCid(cid)
    if (onProgress) onProgress({ phase: 'complete', chunk: 1, totalChunks: 1, percent: 100 })
    return { cid, isChunked: false, totalSize }
  }

  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE)
  const chunkCids = []

  if (onProgress) onProgress({ phase: 'chunking', chunk: 0, totalChunks, percent: 0 })

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, totalSize)
    const chunk = contentBytes.slice(start, end)

    const chunkCid = await retryOperation(async () => {
      return await fs.addBytes(chunk)
    })
    await pinCid(chunkCid)
    chunkCids.push(chunkCid.toString())

    const percent = Math.round(((i + 1) / totalChunks) * 80)
    if (onProgress) onProgress({ phase: 'chunking', chunk: i + 1, totalChunks, percent })
  }

  if (onProgress) onProgress({ phase: 'merging', chunk: totalChunks, totalChunks, percent: 85 })

  const manifest = {
    type: 'chunked-content',
    chunkCids,
    totalSize,
    chunkSize: CHUNK_SIZE,
    createdAt: new Date().toISOString()
  }

  const manifestCid = await retryOperation(async () => {
    return await dag.add(manifest)
  })
  await pinCid(manifestCid)

  if (onProgress) onProgress({ phase: 'complete', chunk: totalChunks, totalChunks, percent: 100 })

  return { cid: manifestCid, isChunked: true, totalSize }
}

export async function readChunkedContent(cidOrStr) {
  const { CID } = await import('multiformats/cid')
  const parsedCid = typeof cidOrStr === 'string' ? CID.parse(cidOrStr) : cidOrStr

  try {
    const data = await dag.get(parsedCid)
    
    if (data && data.type === 'chunked-content' && Array.isArray(data.chunkCids)) {
      const chunks = []
      for (const chunkCidStr of data.chunkCids) {
        const chunkCid = CID.parse(chunkCidStr)
        const chunkData = await retryOperation(async () => {
          const chunksArr = []
          for await (const chunk of fs.cat(chunkCid)) {
            chunksArr.push(chunk)
          }
          return Buffer.concat(chunksArr)
        })
        chunks.push(chunkData)
      }
      return Buffer.concat(chunks).toString('utf-8')
    }

    return null
  } catch (error) {
    try {
      const chunksArr = []
      for await (const chunk of fs.cat(parsedCid)) {
        chunksArr.push(chunk)
      }
      return Buffer.concat(chunksArr).toString('utf-8')
    } catch {
      return null
    }
  }
}

export function addCommentToIndex(snippetCid, commentCid) {
  if (!commentIndex.has(snippetCid)) {
    commentIndex.set(snippetCid, [])
  }
  const existing = commentIndex.get(snippetCid)
  if (!existing.includes(commentCid)) {
    existing.push(commentCid)
  }
}

export function getCommentIndex(snippetCid) {
  return commentIndex.get(snippetCid) || []
}

export function setUploadProgress(uploadId, progress) {
  uploadProgress.set(uploadId, progress)
}

export function getUploadProgress(uploadId) {
  return uploadProgress.get(uploadId) || null
}

export function deleteUploadProgress(uploadId) {
  uploadProgress.delete(uploadId)
}

export async function unpinCid(cid) {
  if (!helia) throw new Error('IPFS not initialized')
  try {
    const { CID } = await import('multiformats/cid')
    const parsedCid = typeof cid === 'string' ? CID.parse(cid) : cid
    await helia.pins.rm(parsedCid)
    console.log(`Unpinned CID: ${parsedCid.toString()}`)
    return true
  } catch (error) {
    console.error(`Failed to unpin CID ${cid}:`, error.message)
    return false
  }
}

const expirationIndex = new Map()

export function registerExpiration(cid, expiresAt, metadata = {}) {
  const cidStr = typeof cid === 'string' ? cid : cid.toString()
  expirationIndex.set(cidStr, {
    cid: cidStr,
    expiresAt: new Date(expiresAt).getTime(),
    createdAt: Date.now(),
    ...metadata
  })
  console.log(`Registered expiration for ${cidStr} at ${new Date(expiresAt).toISOString()}`)
}

export function getExpiringEntries(beforeTime = Date.now()) {
  const expiring = []
  for (const [cid, entry] of expirationIndex.entries()) {
    if (entry.expiresAt <= beforeTime) {
      expiring.push(entry)
    }
  }
  return expiring.sort((a, b) => a.expiresAt - b.expiresAt)
}

export function removeExpirationEntry(cid) {
  const cidStr = typeof cid === 'string' ? cid : cid.toString()
  expirationIndex.delete(cidStr)
}

export function getAllExpirationEntries() {
  return Array.from(expirationIndex.values())
}

export function getForkChildren(parentCid) {
  const parentStr = typeof parentCid === 'string' ? parentCid : parentCid.toString()
  const children = []
  for (const entry of expirationIndex.values()) {
    if (entry.parentCid === parentStr) {
      children.push(entry)
    }
  }
  return children
}

export { CHUNK_SIZE }
