const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? `http://${window.location.hostname}:3001/api` : '/api')

export interface ApiUser {
  id: string
  username: string
  email: string
  dateOfBirth?: string
  field?: string
  profileImage?: string
}

export interface ApiSession {
  token: string
  user: ApiUser
}

async function requestApi<T>(path: string, options: RequestInit = {}): Promise<{ body: T; response: Response }> {
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
  return { body: body as T, response }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const result = await requestApi<T>(path, options)
  return result.body
}

export async function apiRequestPage<T>(path: string, options: RequestInit = {}): Promise<{ data: T; hasMore: boolean }> {
  const result = await requestApi<T>(path, options)
  return {
    data: result.body,
    hasMore: result.response.headers.get('X-History-Has-More') === 'true',
  }
}
