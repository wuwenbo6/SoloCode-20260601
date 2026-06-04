const BASE = '/api'

function getToken(): string | null {
  return localStorage.getItem('token')
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  const json = await res.json()
  return json.data !== undefined ? json.data : json
}

async function requestBlob(
  path: string,
  options: RequestInit = {}
): Promise<Blob> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  return res.blob()
}

export interface AuthResponse {
  token: string
  user: { id: string; email: string; salt: string; totpEnabled?: boolean }
}

export interface TwoFactorRequiredResponse {
  requiresTwoFactor: true
  tempToken: string
}

export interface TotpGenerateResponse {
  secret: string
  otpauth: string
  qrCodeUrl: string
}

export interface NoteResponse {
  id: string
  titleCiphertext: string
  titleIv: string
  contentCiphertext?: string
  contentIv?: string
  tagsCiphertext: string
  tagsIv: string
  attachments?: AttachmentMeta[]
  createdAt: string
  updatedAt: string
  currentVersion: number
}

export interface AttachmentMeta {
  id: string
  fileName: string
  fileSize: number
  chunkCount: number
  status: string
}

export interface UploadedPart {
  partNumber: number
  etag: string
  size: number
}

export interface InitUploadResponse {
  attachmentId: string
  uploadId: string
  chunkSize: number
  chunkCount: number
}

export interface PartUrlResponse {
  url: string
  partNumber: number
}

export interface PartCompleteResponse {
  success: boolean
  uploadProgress: number
}

export interface ResumeUploadResponse {
  attachmentId: string
  uploadId: string
  uploadedParts: UploadedPart[]
  uploadProgress: number
  chunkCount: number
  chunkSize: number
  fileName: string
  fileSize: number
  iv: string
}

export interface DownloadUrlResponse {
  urls: string[]
  chunkSize: number
  iv: string
  fileName: string
  fileSize: number
  chunkCount: number
  encryptedFileSize: number
}

export interface ShareResponse {
  shareId: string
  shareUrl: string
}

export interface GetShareResponse {
  shareId: string
  titleCiphertext: string
  titleIv: string
  contentCiphertext: string
  contentIv: string
  salt: string
  expiresAt: string
  isExpired: boolean
}

export async function getMe(): Promise<{ id: string; email: string; salt: string; totpEnabled?: boolean }> {
  return request('/auth/me')
}

export async function register(
  email: string,
  passwordHash: string,
  salt: string
): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, passwordHash, salt }),
  })
}

export async function login(
  email: string,
  passwordHash: string
): Promise<AuthResponse | TwoFactorRequiredResponse> {
  return request<AuthResponse | TwoFactorRequiredResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, passwordHash }),
  })
}

export async function createNote(data: {
  titleCiphertext: string
  titleIv: string
  contentCiphertext: string
  contentIv: string
  tagsCiphertext: string
  tagsIv: string
  searchIndex: string[]
}): Promise<{ id: string }> {
  return request('/notes', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export interface SearchNoteResult {
  id: string
  titleCiphertext: string
  titleIv: string
  updatedAt: string
}

export async function searchNotes(queryHash: string): Promise<{ noteIds: string[]; notes: SearchNoteResult[] }> {
  return request('/notes/search', {
    method: 'POST',
    body: JSON.stringify({ queryHash }),
  })
}

export async function listNotes(): Promise<{ notes: NoteResponse[] }> {
  return request('/notes')
}

export async function getNote(id: string): Promise<NoteResponse> {
  return request(`/notes/${id}`)
}

export async function updateNote(
  id: string,
  data: {
    titleCiphertext: string
    titleIv: string
    contentCiphertext: string
    contentIv: string
    tagsCiphertext: string
    tagsIv: string
    searchIndex?: string[]
  }
): Promise<void> {
  return request(`/notes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteNote(id: string): Promise<void> {
  return request(`/notes/${id}`, { method: 'DELETE' })
}

export async function initUpload(data: {
  noteId: string
  fileName: string
  fileSize: number
  encryptedFileSize: number
  chunkCount: number
  chunkSize: number
  iv: string
}): Promise<InitUploadResponse> {
  return request('/attachments/init', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getPartUrl(data: {
  attachmentId: string
  partNumber: number
}): Promise<PartUrlResponse> {
  return request('/attachments/part-url', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function completePart(data: {
  attachmentId: string
  partNumber: number
  etag: string
  size: number
}): Promise<PartCompleteResponse> {
  return request('/attachments/part-complete', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function resumeUpload(attachmentId: string): Promise<ResumeUploadResponse> {
  return request('/attachments/resume', {
    method: 'POST',
    body: JSON.stringify({ attachmentId }),
  })
}

export async function finalizeUpload(data: {
  attachmentId: string
  parts: { partNumber: number; etag: string }[]
}): Promise<{ attachmentId: string }> {
  return request('/attachments/complete', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getDownloadUrl(
  attachmentId: string
): Promise<DownloadUrlResponse> {
  return request(`/attachments/${attachmentId}/download`)
}

export async function createShare(data: {
  noteId: string
  contentCiphertext: string
  contentIv: string
  titleCiphertext: string
  titleIv: string
  salt: string
  expiresAt: string
}): Promise<ShareResponse> {
  return request('/shares', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getShare(shareId: string): Promise<GetShareResponse> {
  return request(`/shares/${shareId}`)
}

export async function generateTotp(): Promise<TotpGenerateResponse> {
  return request('/auth/totp/generate', {
    method: 'POST',
  })
}

export async function enableTotp(code: string, secret: string): Promise<void> {
  return request('/auth/totp/enable', {
    method: 'POST',
    body: JSON.stringify({ code, secret }),
  })
}

export async function disableTotp(passwordHash: string): Promise<void> {
  return request('/auth/totp/disable', {
    method: 'POST',
    body: JSON.stringify({ passwordHash }),
  })
}

export async function verifyTotp(tempToken: string, code: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/totp/verify', {
    method: 'POST',
    body: JSON.stringify({ tempToken, code }),
  })
}

export async function exportPdf(markdown: string, title: string): Promise<Blob> {
  return requestBlob('/export/pdf', {
    method: 'POST',
    body: JSON.stringify({ markdown, title }),
  })
}

export async function exportDocx(markdown: string, title: string): Promise<Blob> {
  return requestBlob('/export/docx', {
    method: 'POST',
    body: JSON.stringify({ markdown, title }),
  })
}

export interface NoteVersionMeta {
  version: number
  createdAt: string
}

export interface NoteVersionsResponse {
  versions: NoteVersionMeta[]
  currentVersion: number
}

export async function getNoteVersions(noteId: string): Promise<NoteVersionsResponse> {
  return request(`/notes/${noteId}/versions`)
}

export interface NoteVersionResponse {
  _id: string
  noteId: string
  version: number
  titleCiphertext: string
  titleIv: string
  contentCiphertext: string
  contentIv: string
  tagsCiphertext: string
  tagsIv: string
  createdAt: string
}

export async function getNoteVersion(noteId: string, version: number): Promise<NoteVersionResponse> {
  return request(`/notes/${noteId}/versions/${version}`)
}

export async function restoreNoteVersion(noteId: string, version: number): Promise<NoteResponse> {
  return request(`/notes/${noteId}/versions/${version}/restore`, {
    method: 'POST',
  })
}
