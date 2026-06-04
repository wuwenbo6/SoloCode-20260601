import express from 'express'
import { CID } from 'multiformats/cid'
import { getIPFS } from '../ipfs-node.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const { q, language } = req.query

    if (!q && !language) {
      return res.status(400).json({ error: 'Query parameter "q" or "language" is required' })
    }

    const { dag, dht } = getIPFS()
    const results = []
    const seenCids = new Set()

    try {
      const searchKey = q ? `/snippets/${q.toLowerCase().replace(/\s+/g, '-')}` : '/snippets/'
      console.log('Searching DHT for:', searchKey)

      for await (const event of dht.get(searchKey)) {
        if (event.name === 'VALUE') {
          try {
            const cidStr = new TextDecoder().decode(event.value)
            if (seenCids.has(cidStr)) continue
            
            seenCids.add(cidStr)
            const parsedCid = CID.parse(cidStr)
            const snippet = await dag.get(parsedCid)

            if (snippet.type === 'snippet') {
              const matchesQuery = !q || 
                snippet.title.toLowerCase().includes(q.toLowerCase()) ||
                snippet.content.toLowerCase().includes(q.toLowerCase())
              
              const matchesLanguage = !language || 
                snippet.language.toLowerCase() === language.toLowerCase()

              if (matchesQuery && matchesLanguage) {
                results.push({
                  cid: cidStr,
                  title: snippet.title,
                  language: snippet.language,
                  createdAt: snippet.createdAt,
                  preview: snippet.content.substring(0, 200)
                })
              }
            }
          } catch (e) {
            console.log('Error processing search result:', e.message)
          }
        }
      }
    } catch (e) {
      console.log('DHT search error:', e.message)
    }

    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    res.json({
      query: q,
      language,
      count: results.length,
      results
    })
  } catch (error) {
    console.error('Error searching snippets:', error)
    res.status(500).json({ error: 'Failed to search snippets' })
  }
})

export default router
