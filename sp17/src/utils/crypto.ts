const PBKDF2_ITERATIONS = 100000
const KEY_LENGTH = 256
const IV_LENGTH = 12
const SALT_LENGTH = 16

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const STOPWORDS = new Set([
  'the', 'and', 'or', 'a', 'an', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall',
  'can', 'need', 'dare', 'ought', 'used', 'it', 'its', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'what',
  'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there',
  'then', 'once', 'if', 'because', 'while', 'although', 'though',
  'after', 'before', 'since', 'until', 'unless', 'but', 'however',
  'yet', 'still', 'even', 'about', 'into', 'through', 'during',
  'between', 'under', 'over', 'above', 'below', 'up', 'down',
  'out', 'off', 'over', 'again', 'further', 'any', 'much'
])

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-512',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

export function generateIv(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(IV_LENGTH))
}

export function generateSalt(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
}

export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const iv = generateIv()
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  )
  return {
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  }
}

export async function decrypt(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToArrayBuffer(iv) },
    key,
    base64ToArrayBuffer(ciphertext)
  )
  return decoder.decode(decrypted)
}

export async function encryptFileChunk(
  data: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  return window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
}

export async function decryptFileChunk(
  data: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  return window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer as ArrayBuffer
}

export async function hashPassword(password: string): Promise<string> {
  const hash = await window.crypto.subtle.digest('SHA-256', encoder.encode(password))
  return arrayBufferToBase64(hash)
}

export async function deriveHmacKey(masterKey: CryptoKey): Promise<CryptoKey> {
  const exportedKey = await window.crypto.subtle.exportKey('raw', masterKey)
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    exportedKey,
    'HKDF',
    false,
    ['deriveKey']
  )
  return window.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode('blind-index-salt'),
      info: encoder.encode('hmac-search-key'),
    },
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign', 'verify']
  )
}

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().split(/\W+/).filter(word => {
    return word.length >= 2 && !STOPWORDS.has(word)
  })
  return Array.from(new Set(words))
}

export async function computeBlindIndex(text: string, hmacKey: CryptoKey): Promise<string[]> {
  const keywords = extractKeywords(text)
  const hashes: string[] = []
  for (const keyword of keywords) {
    const signature = await window.crypto.subtle.sign(
      'HMAC',
      hmacKey,
      encoder.encode(keyword)
    )
    hashes.push(arrayBufferToBase64(signature))
  }
  return hashes
}

export async function computeQueryHash(query: string, hmacKey: CryptoKey): Promise<string> {
  const keyword = query.toLowerCase().trim()
  const signature = await window.crypto.subtle.sign(
    'HMAC',
    hmacKey,
    encoder.encode(keyword)
  )
  return arrayBufferToBase64(signature)
}
