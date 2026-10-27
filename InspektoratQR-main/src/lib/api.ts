const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001/api'

export interface ApiUser {
  id: string
  username: string
  email: string
  dateOfBirth?: string
  field?: string
}

export interface ApiSession {
  token: string
  user: ApiUser
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('qr_token')
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || 'Permintaan gagal')
  return body as T
}
