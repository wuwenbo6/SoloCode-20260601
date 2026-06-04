import { useState, useCallback, useRef, useEffect } from 'react'
import { Upload, FileIcon, Download, Loader2, Play, Pause, X, AlertCircle } from 'lucide-react'
import { encryptFileChunk, decryptFileChunk, generateIv, arrayBufferToBase64, base64ToArrayBuffer } from '@/utils/crypto'
import { initUpload, getPartUrl, completePart, resumeUpload, finalizeUpload, getDownloadUrl } from '@/utils/api'
import { useAuthStore } from '@/stores/authStore'
import type { AttachmentMeta, UploadedPart } from '@/utils/api'

const CHUNK_SIZE = 1024 * 1024
const MAX_PARALLEL = 3

interface UploadingFile {
  id: string
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed'
  attachmentId: string | null
  uploadedParts: UploadedPart[]
  error: string | null
  currentPart: number
}

interface AttachmentManagerProps {
  noteId: string
  attachments: AttachmentMeta[]
  onAttachmentsChange: () => void
}

export default function AttachmentManager({ noteId, attachments, onAttachmentsChange }: AttachmentManagerProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cryptoKey = useAuthStore((s) => s.cryptoKey)
  const abortControllerRef = useRef<Map<string, AbortController>>(new Map())

  useEffect(() => {
    return () => {
      abortControllerRef.current.forEach((controller) => controller.abort())
    }
  }, [])

  const processFile = useCallback(async (uploadFile: UploadingFile, file: File, attachmentId: string) => {
    const totalParts = Math.ceil(file.size / CHUNK_SIZE)
    const fileIv = generateIv()

    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      let currentStatus: UploadingFile | undefined
      setUploadingFiles((prev) => {
        currentStatus = prev.find((uf) => uf.id === uploadFile.id)
        return prev
      })

      if (!currentStatus || currentStatus.status === 'paused' || currentStatus.status === 'failed') {
        break
      }

      const isAlreadyUploaded = currentStatus.uploadedParts.some((p) => p.partNumber === partNumber)
      if (isAlreadyUploaded) {
        continue
      }

      try {
        const start = (partNumber - 1) * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, file.size)
        const chunk = file.slice(start, end)
        const buffer = await chunk.arrayBuffer()

        const encrypted = await encryptFileChunk(buffer, cryptoKey!, fileIv)

        const partRes = await getPartUrl({ attachmentId, partNumber })

        const abortController = new AbortController()
        abortControllerRef.current.set(`${uploadFile.id}-${partNumber}`, abortController)

        const uploadResponse = await fetch(partRes.url, {
          method: 'PUT',
          body: encrypted,
          signal: abortController.signal,
        })

        abortControllerRef.current.delete(`${uploadFile.id}-${partNumber}`)

        if (!uploadResponse.ok) {
          throw new Error(`Part ${partNumber} upload failed`)
        }

        const etag = uploadResponse.headers.get('ETag')?.replace(/"/g, '') || ''
        const encryptedSize = encrypted.byteLength

        await completePart({ attachmentId, partNumber, etag, size: encryptedSize })

        const newProgress = Math.round((partNumber / totalParts) * 100)

        setUploadingFiles((prev) =>
          prev.map((uf) =>
            uf.id === uploadFile.id
              ? {
                  ...uf,
                  progress: newProgress,
                  currentPart: partNumber,
                  uploadedParts: [...uf.uploadedParts, { partNumber, etag, size: encryptedSize }],
                }
              : uf
          )
        )
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        setUploadingFiles((prev) =>
          prev.map((uf) =>
            uf.id === uploadFile.id
              ? { ...uf, status: 'failed', error: (error as Error).message }
              : uf
          )
        )
        return
      }
    }

    let finalStatus: UploadingFile | undefined
    setUploadingFiles((prev) => {
      finalStatus = prev.find((uf) => uf.id === uploadFile.id)
      return prev
    })

    if (finalStatus && finalStatus.status === 'uploading') {
      const partsWithEtags = finalStatus.uploadedParts
        .sort((a, b) => a.partNumber - b.partNumber)
        .map((p) => ({ partNumber: p.partNumber, etag: p.etag }))

      try {
        await finalizeUpload({
          attachmentId,
          parts: partsWithEtags,
        })

        setUploadingFiles((prev) =>
          prev.map((uf) =>
            uf.id === uploadFile.id ? { ...uf, status: 'completed', progress: 100 } : uf
          )
        )

        setTimeout(() => {
          setUploadingFiles((prev) => prev.filter((uf) => uf.id !== uploadFile.id))
          onAttachmentsChange()
        }, 1000)
      } catch (error) {
        setUploadingFiles((prev) =>
          prev.map((uf) =>
            uf.id === uploadFile.id
              ? { ...uf, status: 'failed', error: (error as Error).message }
              : uf
          )
        )
      }
    }
  }, [cryptoKey, onAttachmentsChange])

  const startUpload = useCallback(async (file: File) => {
    if (!cryptoKey) return

    const chunkCount = Math.ceil(file.size / CHUNK_SIZE)
    const fileId = `${file.name}-${Date.now()}`

    const uploadFile: UploadingFile = {
      id: fileId,
      file,
      progress: 0,
      status: 'uploading',
      attachmentId: null,
      uploadedParts: [],
      error: null,
      currentPart: 0,
    }

    setUploadingFiles((prev) => [...prev, uploadFile])

    try {
      const fileIv = generateIv()
      const ivBase64 = arrayBufferToBase64(fileIv.buffer as ArrayBuffer)

      const initRes = await initUpload({
        noteId,
        fileName: file.name,
        fileSize: file.size,
        encryptedFileSize: file.size,
        chunkCount,
        chunkSize: CHUNK_SIZE,
        iv: ivBase64,
      })

      setUploadingFiles((prev) =>
        prev.map((uf) =>
          uf.id === fileId ? { ...uf, attachmentId: initRes.attachmentId } : uf
        )
      )

      processFile(uploadFile, file, initRes.attachmentId)
    } catch (error) {
      setUploadingFiles((prev) =>
        prev.map((uf) =>
          uf.id === fileId
            ? { ...uf, status: 'failed', error: (error as Error).message }
            : uf
        )
      )
    }
  }, [cryptoKey, noteId, processFile])

  const pauseUpload = useCallback((fileId: string) => {
    setUploadingFiles((prev) =>
      prev.map((uf) =>
        uf.id === fileId ? { ...uf, status: 'paused' as const } : uf
      )
    )
    abortControllerRef.current.forEach((controller, key) => {
      if (key.startsWith(fileId)) {
        controller.abort()
        abortControllerRef.current.delete(key)
      }
    })
  }, [])

  const resumeUploadHandler = useCallback(async (fileId: string) => {
    const upload = uploadingFiles.find((uf) => uf.id === fileId)
    if (!upload || !cryptoKey) return

    setUploadingFiles((prev) =>
      prev.map((uf) =>
        uf.id === fileId ? { ...uf, status: 'uploading' as const, error: null } : uf
      )
    )

    if (upload.attachmentId) {
      try {
        const resumeRes = await resumeUpload(upload.attachmentId)
        setUploadingFiles((prev) =>
          prev.map((uf) =>
            uf.id === fileId
              ? { ...uf, uploadedParts: resumeRes.uploadedParts, progress: resumeRes.uploadProgress }
              : uf
          )
        )
        processFile(upload, upload.file, upload.attachmentId)
      } catch (error) {
        setUploadingFiles((prev) =>
          prev.map((uf) =>
            uf.id === fileId
              ? { ...uf, status: 'failed' as const, error: (error as Error).message }
              : uf
          )
        )
      }
    }
  }, [uploadingFiles, cryptoKey, processFile])

  const removeUpload = useCallback((fileId: string) => {
    pauseUpload(fileId)
    setUploadingFiles((prev) => prev.filter((uf) => uf.id !== fileId))
  }, [pauseUpload])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    files.forEach(startUpload)
  }, [startUpload])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach(startUpload)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [startUpload])

  const handleDownload = async (attachment: AttachmentMeta) => {
    if (!cryptoKey) return
    try {
      const res = await getDownloadUrl(attachment.id)
      const chunks: ArrayBuffer[] = []
      const iv = new Uint8Array(base64ToArrayBuffer(res.iv))

      for (const url of res.urls) {
        const downloadResponse = await fetch(url)
        const encryptedData = await downloadResponse.arrayBuffer()
        const decrypted = await decryptFileChunk(encryptedData, cryptoKey, iv)
        chunks.push(decrypted)
      }

      const blob = new Blob(chunks)
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = res.fileName
      link.click()
      URL.revokeObjectURL(link.href)
    } catch {
      // silently fail
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-crypt-accent bg-crypt-accent/10' : 'border-crypt-border hover:border-crypt-accent/50'
        }`}
      >
        <Upload size={24} className="mx-auto text-crypt-text mb-2" />
        <p className="text-sm text-crypt-text">Drop files here or click to upload</p>
        <p className="text-xs text-crypt-text/50 mt-1">Images and PDFs only • Max parallel: 3</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((uf) => (
            <div key={uf.id} className="bg-crypt-bg rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 size={14} className={`text-crypt-accent ${uf.status === 'uploading' ? 'animate-spin' : 'hidden'}`} />
                <FileIcon size={14} className="text-crypt-accent" />
                <span className="text-sm text-white truncate flex-1">{uf.file.name}</span>
                <span className="text-xs text-crypt-text">{uf.progress}%</span>
                {uf.status === 'uploading' && (
                  <button onClick={() => pauseUpload(uf.id)} className="text-crypt-text hover:text-white p-1">
                    <Pause size={14} />
                  </button>
                )}
                {uf.status === 'paused' && (
                  <button onClick={() => resumeUploadHandler(uf.id)} className="text-crypt-accent hover:text-white p-1">
                    <Play size={14} />
                  </button>
                )}
                <button onClick={() => removeUpload(uf.id)} className="text-crypt-text hover:text-red-400 p-1">
                  <X size={14} />
                </button>
              </div>
              <div className="w-full bg-crypt-border rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    uf.status === 'failed' ? 'bg-red-500' : 'bg-crypt-accent'
                  }`}
                  style={{ width: `${uf.progress}%` }}
                />
              </div>
              {uf.error && (
                <div className="flex items-center gap-1 mt-2 text-xs text-red-400">
                  <AlertCircle size={12} />
                  {uf.error}
                </div>
              )}
              {uf.status === 'paused' && (
                <p className="text-xs text-crypt-text mt-1">Paused - click play to resume</p>
              )}
            </div>
          ))}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-3 bg-crypt-bg rounded-lg p-3">
              <FileIcon size={16} className="text-crypt-accent shrink-0" />
              <span className="text-sm text-white truncate flex-1">{att.fileName}</span>
              <span className="text-xs text-crypt-text">
                {att.fileSize < 1024 * 1024
                  ? `${(att.fileSize / 1024).toFixed(1)} KB`
                  : `${(att.fileSize / (1024 * 1024)).toFixed(1)} MB`}
              </span>
              <button
                onClick={() => handleDownload(att)}
                className="text-crypt-text hover:text-crypt-accent transition-colors"
              >
                <Download size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
