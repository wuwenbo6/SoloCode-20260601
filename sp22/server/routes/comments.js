import express from 'express'
import { CID } from 'multiformats/cid'
import { getIPFS, pinCid, retryOperation, addCommentToIndex, getCommentIndex } from '../ipfs-node.js'

const router = express.Router()

router.post('/', async (req, res) => {
  try {
    const { snippetCid, author, content, parentCommentCid } = req.body

    if (!snippetCid || !content) {
      return res.status(400).json({ error: 'Snippet CID and content are required' })
    }

    const { dag } = getIPFS()

    const comment = {
      snippetCid,
      author: author || 'Anonymous',
      content,
      createdAt: new Date().toISOString(),
      type: 'comment',
      parentCommentCid: parentCommentCid || null
    }

    const commentCid = await retryOperation(async () => {
      return await dag.add(comment)
    })

    const commentCidStr = commentCid.toString()

    await pinCid(commentCid)

    addCommentToIndex(snippetCid, commentCidStr)

    res.json({
      cid: commentCidStr,
      comment
    })
  } catch (error) {
    console.error('Error creating comment:', error)
    res.status(500).json({ error: 'Failed to create comment: ' + error.message })
  }
})

router.get('/snippet/:snippetCid', async (req, res) => {
  try {
    const { snippetCid } = req.params
    const { dag } = getIPFS()

    const localCommentCids = getCommentIndex(snippetCid)

    const dagCommentCids = []
    try {
      const parsedCid = CID.parse(snippetCid)
      const snippet = await retryOperation(async () => {
        return await dag.get(parsedCid)
      }, 2, 1000)
      if (snippet && Array.isArray(snippet.comments)) {
        dagCommentCids.push(...snippet.comments)
      }
    } catch (e) {
      console.log('Could not read snippet DAG for comments:', e.message)
    }

    const allCommentCidsSet = new Set([...localCommentCids, ...dagCommentCids])
    const allCommentCids = [...allCommentCidsSet]

    const comments = []
    const seenCids = new Set()

    for (const cidStr of allCommentCids) {
      if (seenCids.has(cidStr)) continue
      seenCids.add(cidStr)

      try {
        const commentCid = CID.parse(cidStr)
        const comment = await retryOperation(async () => {
          return await dag.get(commentCid)
        }, 2, 1500)

        if (comment && comment.type === 'comment' && comment.snippetCid === snippetCid) {
          comments.push({
            cid: cidStr,
            author: comment.author,
            content: comment.content,
            createdAt: comment.createdAt,
            parentCommentCid: comment.parentCommentCid
          })
        }
      } catch (e) {
        console.log(`Could not fetch comment ${cidStr}:`, e.message)
      }
    }

    const uniqueComments = []
    const contentSet = new Set()
    for (const c of comments) {
      const dedupeKey = `${c.author}:${c.content}:${c.createdAt}`
      if (!contentSet.has(dedupeKey)) {
        contentSet.add(dedupeKey)
        uniqueComments.push(c)
      }
    }

    uniqueComments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

    res.json({
      snippetCid,
      comments: uniqueComments
    })
  } catch (error) {
    console.error('Error fetching comments:', error)
    res.status(404).json({ error: 'Failed to fetch comments' })
  }
})

router.get('/:cid', async (req, res) => {
  try {
    const { cid } = req.params
    const { dag } = getIPFS()

    const parsedCid = CID.parse(cid)
    const comment = await retryOperation(async () => {
      return await dag.get(parsedCid)
    }, 2, 1500)

    res.json({
      cid: cid,
      comment
    })
  } catch (error) {
    console.error('Error fetching comment:', error)
    res.status(404).json({ error: 'Comment not found' })
  }
})

export default router
