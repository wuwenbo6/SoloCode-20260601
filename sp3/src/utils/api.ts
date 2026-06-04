import type { SimulateRequest, SimulateResponse, HealthResponse } from '@shared/types'

const API_BASE = '/api'

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
  }
  
  return response.json()
}

export async function checkHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health', {
    method: 'GET',
  })
}

export async function runSimulation(params: SimulateRequest): Promise<SimulateResponse> {
  return request<SimulateResponse>('/simulate', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}
