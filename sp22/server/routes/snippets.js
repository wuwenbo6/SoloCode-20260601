import express from 'express'
import crypto from 'crypto'
import { CID } from 'multiformats/cid'
import { getIPFS, pinCid, retryOperation, addChunkedContent, readChunkedContent, setUploadProgress, getUploadProgress, deleteUploadProgress, registerExpiration, getForkChildren, getAllExpirationEntries } from '../ipfs-node.js'

const router = express.Router()

function calculateExpiresAt(expiresIn) {
  if (!expiresIn) return null
  const now = Date.now()
  const durationMap = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000
  }
  const duration = durationMap[expiresIn]
  if (!duration) return null
  return new Date(now + duration).toISOString()
}

async function createSnippetInternal({ 
  title, language, content, parentCid = null, expiresIn = null, updateProgress = null 
}) {
  const uploadId = crypto.randomUUID()
  if (updateProgress) updateProgress(uploadId, { phase: 'started', percent: 0 })

  const { dag, dht } = getIPFS()

  const snippet = {
    title,
    language,
    content,
    createdAt: new Date().toISOString(),
    type: 'snippet',
    size: new TextEncoder().encode(content).byteLength,
    parentCid: parentCid,
    forkCount: 0
  }

  if (parentCid) {
    snippet.forkedFrom = parentCid
    snippet.forkedAt = new Date().toISOString()
  }

  const expiresAt = calculateExpiresAt(expiresIn)
  if (expiresAt) {
    snippet.expiresAt = expiresAt
  }

  const contentSize = new TextEncoder().encode(content).byteLength

  let contentCid
  let isChunked = false

  if (contentSize > 256 * 1024) {
    isChunked = true
    const chunkResult = await addChunkedContent(content, (progress) => {
      if (updateProgress) updateProgress(uploadId, progress)
    })
    contentCid = chunkResult.cid
    snippet.contentRef = contentCid.toString()
    snippet.content = null
  }

  if (updateProgress) updateProgress(uploadId, { phase: 'creating-metadata', percent: 92 })
  
  const snippetCid = await retryOperation(async () => {
    return await dag.add(snippet)
  })

  await pinCid(snippetCid)

  if (contentCid) {
    await pinCid(contentCid)
  }

  if (expiresAt) {
    registerExpiration(snippetCid.toString(), expiresAt, {
      type: 'snippet',
      contentRef: contentCid ? contentCid.toString() : null,
      isChunked,
      parentCid
    })
  }

  if (updateProgress) updateProgress(uploadId, { phase: 'indexing', percent: 96 })

  try {
    const key = `/snippets/${title.toLowerCase().replace(/\s+/g, '-')}`
    const value = new TextEncoder().encode(snippetCid.toString())
    await retryOperation(async () => {
      await dht.put(key, value)
    })
  } catch (dhtError) {
    console.log('DHT indexing failed (non-critical):', dhtError.message)
  }

  if (updateProgress) updateProgress(uploadId, { phase: 'complete', percent: 100 })

  const responseSnippet = isChunked 
    ? { ...snippet, content } 
    : snippet

  setTimeout(() => deleteUploadProgress(uploadId), 30000)

  return {
    cid: snippetCid.toString(),
    uploadId,
    isChunked,
    size: contentSize,
    expiresAt,
    parentCid,
    snippet: responseSnippet
  }
}

router.post('/', async (req, res) => {
  try {
    const { title, language, content, parentCid, expiresIn } = req.body

    if (!title || !language || !content) {
      return res.status(400).json({ error: 'Title, language, and content are required' })
    }

    const result = await createSnippetInternal({
      title,
      language,
      content,
      parentCid,
      expiresIn,
      updateProgress: setUploadProgress
    })

    res.json(result)
  } catch (error) {
    console.error('Error creating snippet:', error)
    res.status(500).json({ error: 'Failed to create snippet: ' + error.message })
  }
})

router.post('/fork/:cid', async (req, res) => {
  try {
    const { cid: parentCid } = req.params
    const { title, language, content, expiresIn } = req.body

    const { dag } = getIPFS()

    const parsedParentCid = CID.parse(parentCid)
    const parentSnippet = await retryOperation(async () => {
      return await dag.get(parsedParentCid)
    }, 3, 1000)

    if (!parentSnippet || parentSnippet.type !== 'snippet') {
      return res.status(404).json({ error: 'Parent snippet not found' })
    }

    const forkTitle = title || `${parentSnippet.title} (fork)`
    const forkLanguage = language || parentSnippet.language
    const forkContent = content !== undefined ? content : (parentSnippet.content || '')

    if (parentSnippet.contentRef && !parentSnippet.content) {
      const fullContent = await readChunkedContent(parentSnippet.contentRef)
      if (fullContent !== null && content === undefined) {
        parentSnippet.content = fullContent
      }
    }

    const result = await createSnippetInternal({
      title: forkTitle,
      language: forkLanguage,
      content: forkContent,
      parentCid,
      expiresIn,
      updateProgress: setUploadProgress
    })

    res.json({
      ...result,
      forkedFrom: parentCid,
      parentTitle: parentSnippet.title
    })
  } catch (error) {
    console.error('Error forking snippet:', error)
    res.status(500).json({ error: 'Failed to fork snippet: ' + error.message })
  }
})

router.get('/:cid/forks', async (req, res) => {
  try {
    const { cid } = req.params
    const { dag } = getIPFS()

    const children = getForkChildren(cid)
    const forks = []

    for (const entry of children) {
      try {
        const childCid = CID.parse(entry.cid)
        const childSnippet = await dag.get(childCid)
        if (childSnippet && childSnippet.type === 'snippet') {
          forks.push({
            cid: entry.cid,
            title: childSnippet.title,
            language: childSnippet.language,
            createdAt: entry.createdAt,
            preview: (childSnippet.content || '').substring(0, 100)
          })
        }
      } catch (e) {
        console.log('Could not fetch fork:', entry.cid)
      }
    }

    res.json({
      parentCid: cid,
      count: forks.length,
      forks
    })
  } catch (error) {
    console.error('Error fetching forks:', error)
    res.status(500).json({ error: 'Failed to fetch forks' })
  }
})

router.get('/progress/:uploadId', async (req, res) => {
  const { uploadId } = req.params
  const progress = getUploadProgress(uploadId)
  
  if (!progress) {
    return res.status(404).json({ error: 'Upload not found' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const sendProgress = () => {
    const current = getUploadProgress(uploadId)
    if (current) {
      res.write(`data: ${JSON.stringify(current)}\n\n`)
      if (current.phase === 'complete') {
        res.end()
        return true
      }
    } else {
      res.write(`data: ${JSON.stringify({ phase: 'unknown', percent: 0 })}\n\n`)
      res.end()
      return true
    }
    return false
  }

  sendProgress()

  const interval = setInterval(() => {
    const done = sendProgress()
    if (done) clearInterval(interval)
  }, 500)

  req.on('close', () => clearInterval(interval))
})

router.get('/:cid', async (req, res) => {
  try {
    const { cid } = req.params
    const { dag } = getIPFS()

    const parsedCid = CID.parse(cid)
    const snippet = await retryOperation(async () => {
      return await dag.get(parsedCid)
    }, 3, 2000)

    if (snippet.contentRef && !snippet.content) {
      const fullContent = await readChunkedContent(snippet.contentRef)
      if (fullContent !== null) {
        snippet.content = fullContent
      }
    }

    const pinned = await pinCid(parsedCid)

    const isExpired = snippet.expiresAt && new Date(snippet.expiresAt) < new Date()
    const expiresInMs = snippet.expiresAt ? new Date(snippet.expiresAt) - new Date() : null

    const forkChildren = getForkChildren(cid)

    res.json({
      cid: cid,
      snippet,
      pinned,
      isExpired,
      expiresInMs,
      forkCount: forkChildren.length,
      hasParent: !!snippet.parentCid || !!snippet.forkedFrom
    })
  } catch (error) {
    console.error('Error fetching snippet:', error)
    res.status(404).json({ error: 'Snippet not found' })
  }
})

router.get('/admin/expirations', async (req, res) => {
  try {
    const entries = getAllExpirationEntries()
    res.json({
      count: entries.length,
      entries
    })
  } catch (error) {
    console.error('Error fetching expirations:', error)
    res.status(500).json({ error: 'Failed to fetch expirations' })
  }
})

export default router
