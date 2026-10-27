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

  const resetPassword = async (_email: string) => {
    throw new Error('Reset password membutuhkan endpoint email backend.')
  }

  const verifyOtp = async (_email: string, _token: string) => {
    throw new Error('Verifikasi OTP belum dikonfigurasi pada MySQL lokal.')
  }

  const updatePassword = async (_password: string) => {
    throw new Error('Update password belum dikonfigurasi pada MySQL lokal.')
  }

  const signOut = async () => {
    localStorage.removeItem('qr_token')
    setSession(null)
    setUser(null)
  }

  return <AuthContext.Provider value={{ session, user, signIn, signUp, resetPassword, verifyOtp, updatePassword, signOut, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
