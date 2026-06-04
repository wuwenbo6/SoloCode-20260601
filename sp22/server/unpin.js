import { getExpiringEntries, removeExpirationEntry, unpinCid, getIPFS } from './ipfs-node.js'

let cleanupInterval = null
let isRunning = false

const CHECK_INTERVAL = 60 * 1000

async function cleanupExpiredPins() {
  if (isRunning) return
  
  isRunning = true
  try {
    console.log('[Expiration Cleanup] Checking for expired pins...')
    
    const now = Date.now()
    const expiring = getExpiringEntries(now)
    
    if (expiring.length === 0) {
      console.log('[Expiration Cleanup] No expired entries found.')
      return
    }

    console.log(`[Expiration Cleanup] Found ${expiring.length} expired entries to process.`)

    for (const entry of expiring) {
      try {
        console.log(`[Expiration Cleanup] Processing ${entry.cid} (expired: ${new Date(entry.expiresAt).toISOString()})`)

        const unpinned = await unpinCid(entry.cid)
        if (unpinned) {
          console.log(`[Expiration Cleanup] Successfully unpinned: ${entry.cid}`)
        }

        if (entry.contentRef && entry.isChunked) {
          try {
            const { CID } = await import('multiformats/cid')
            const { dag } = getIPFS()
            const manifestCid = CID.parse(entry.cid)
            const manifest = await dag.get(manifestCid)
            
            if (manifest && manifest.chunkCids && Array.isArray(manifest.chunkCids)) {
              for (const chunkCid of manifest.chunkCids) {
                try {
                  await unpinCid(chunkCid)
                  console.log(`[Expiration Cleanup] Unpinned chunk: ${chunkCid}`)
                } catch (e) {
                  console.log(`[Expiration Cleanup] Failed to unpin chunk ${chunkCid}:`, e.message)
                }
              }
            }
          } catch (e) {
            console.log('[Expiration Cleanup] Could not unpublish chunks:', e.message)
          }
        }

        if (entry.contentRef) {
          try {
            await unpinCid(entry.contentRef)
            console.log(`[Expiration Cleanup] Unpinned content ref: ${entry.contentRef}`)
          } catch (e) {
            console.log(`[Expiration Cleanup] Failed to unpin content ref:`, e.message)
          }
        }

        removeExpirationEntry(entry.cid)
        console.log(`[Expiration Cleanup] Removed expiration entry for: ${entry.cid}`)

      } catch (error) {
        console.error(`[Expiration Cleanup] Failed to process ${entry.cid}:`, error.message)
      }
    }

    console.log(`[Expiration Cleanup] Completed. Processed ${expiring.length} entries.`)
  } catch (error) {
    console.error('[Expiration Cleanup] Error during cleanup:', error)
  } finally {
    isRunning = false
  }
}

export function startExpirationCleanup() {
  if (cleanupInterval) {
    console.log('[Expiration Cleanup] Cleanup task already running.')
    return
  }

  cleanupExpiredPins()

  cleanupInterval = setInterval(cleanupExpiredPins, CHECK_INTERVAL)
  console.log(`[Expiration Cleanup] Started. Will check every ${CHECK_INTERVAL / 1000} seconds.`)
}

export function stopExpirationCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
    console.log('[Expiration Cleanup] Stopped.')
  }
}

export function getCleanupStatus() {
  const expiring = getExpiringEntries(Date.now())
  const upcoming = getExpiringEntries(Date.now() + 24 * 60 * 60 * 1000)
  
  return {
    isRunning: !!cleanupInterval,
    checkIntervalSeconds: CHECK_INTERVAL / 1000,
    expiredNow: expiring.length,
    expiringIn24h: upcoming.length,
    nextCheck: isRunning ? 'In progress' : `${CHECK_INTERVAL / 1000}s`
  }
}
