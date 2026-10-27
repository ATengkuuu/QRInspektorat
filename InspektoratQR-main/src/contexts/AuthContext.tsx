import { createContext, useContext, useEffect, useState } from 'react'
import { apiRequest, ApiSession, ApiUser } from '../lib/api'

interface AuthContextType {
  session: ApiSession | null
  user: ApiUser | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, profile?: { username: string; dateOfBirth: string; field: string }) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  verifyOtp: (email: string, token: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
  updateCurrentUser: (user: ApiUser) => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ApiSession | null>(null)
  const [user, setUser] = useState<ApiUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('qr_token')
    if (!token) {
      setLoading(false)
      return
    }
    apiRequest<ApiUser>('/auth/me')
      .then((currentUser) => {
        setUser(currentUser)
        setSession({ token, user: currentUser })
      })
      .catch(() => localStorage.removeItem('qr_token'))
      .finally(() => setLoading(false))
  }, [])

  const signIn = async (email: string, password: string) => {
    const nextSession = await apiRequest<ApiSession>('/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) })
    localStorage.setItem('qr_token', nextSession.token)
    setSession(nextSession)
    setUser(nextSession.user)
  }

  const signUp = async (email: string, password: string, profile?: { username: string; dateOfBirth: string; field: string }) => {
    const nextSession = await apiRequest<ApiSession>('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, ...profile }) })
    localStorage.setItem('qr_token', nextSession.token)
    setSession(nextSession)
    setUser(nextSession.user)
  }

  const resetPassword = async (email: string) => {
    await apiRequest('/auth/password/forgot', { method: 'POST', body: JSON.stringify({ email }) })
  }

  const verifyOtp = async (email: string, code: string) => {
    const result = await apiRequest<{ resetToken: string }>('/auth/password/verify', { method: 'POST', body: JSON.stringify({ email, code }) })
    localStorage.setItem('qr_reset_token', result.resetToken)
  }

  const updatePassword = async (password: string) => {
    const token = localStorage.getItem('qr_reset_token')
    if (!token) throw new Error('Sesi reset password tidak ditemukan')
    await apiRequest('/auth/password/reset', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ password }) })
    localStorage.removeItem('qr_reset_token')
  }

  const signOut = async () => {
    localStorage.removeItem('qr_token')
    setSession(null)
    setUser(null)
  }

  const updateCurrentUser = (nextUser: ApiUser) => {
    setUser(nextUser)
    if (session) setSession({ ...session, user: nextUser })
  }

  return <AuthContext.Provider value={{ session, user, signIn, signUp, resetPassword, verifyOtp, updatePassword, signOut, updateCurrentUser, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
