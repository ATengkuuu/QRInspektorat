import { FormEvent, useState } from 'react'
import { ArrowLeft, Check, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

type AuthMode = 'signup' | 'forgot' | 'verify' | 'reset'

interface AuthScreensProps {
  mode: AuthMode
}

const copy: Record<AuthMode, { title: string; icon: 'mail' | 'key' | 'check' }> = {
  signup: { title: 'Make your own Account', icon: 'mail' },
  forgot: { title: 'Forget your Password?', icon: 'key' },
  verify: { title: 'Verify your Account', icon: 'mail' },
  reset: { title: 'Create New Password', icon: 'check' },
}

const AuthIcon = ({ icon }: { icon: 'mail' | 'key' | 'check' }) => {
  const Icon = icon === 'mail' ? Mail : icon === 'key' ? KeyRound : Check
  return <div className="auth-feature-icon"><Icon size={25} /></div>
}

const AuthScreens = ({ mode }: AuthScreensProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { signUp, resetPassword, verifyOtp, updatePassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [code, setCode] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const title = copy[mode]

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (mode === 'reset' && password !== confirmation) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)
    try {
      if (mode === 'signup') {
        await signUp(email, password)
        navigate('/verify', { state: { email } })
      } else if (mode === 'forgot') {
        await resetPassword(email)
        navigate('/verify', { state: { email, reset: true } })
      } else if (mode === 'verify') {
        await verifyOtp(email || location.state?.email || '', code)
        navigate(location.state?.reset ? '/reset-password' : '/login', {
          state: { message: 'Account verified successfully' },
        })
      } else {
        await updatePassword(password)
        navigate('/login', { state: { message: 'Password updated successfully' } })
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const isPasswordMode = mode === 'signup' || mode === 'reset'
  const currentEmail = email || location.state?.email || ''

  return (
    <div className="auth-screen">
      <div className="auth-card auth-card-tall">
        <button type="button" className="auth-back" onClick={() => navigate('/login')} aria-label="Back to sign in">
          <ArrowLeft size={15} />
        </button>
        <img src="/Inspektorat.png" alt="Logo Inspektorat" className="auth-logo" />
        <h2 className="auth-heading">{title.title}</h2>

        {mode === 'verify' && <AuthIcon icon="mail" />}
        {mode === 'forgot' && <AuthIcon icon="key" />}
        {mode === 'reset' && <AuthIcon icon="check" />}

        <p className="auth-helper">
          {mode === 'verify' ? 'Enter the code sent to your email to verify your account' :
            mode === 'forgot' ? 'Enter your Email to reset your Password' :
              mode === 'reset' ? 'Enter your New Password' : 'Create an account to get started'}
        </p>

        {error && <p className="auth-message error">{error}</p>}
        {message && <p className="auth-message success">{message}</p>}

        <form onSubmit={submit} className="auth-form">
          {(mode === 'signup' || mode === 'forgot') && (
            <input className="auth-input auth-input-plain" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email Address" />
          )}
          {mode === 'verify' && (
            <input className="auth-input auth-input-plain" inputMode="numeric" required value={code} onChange={(event) => setCode(event.target.value)} placeholder="Code OTP" />
          )}
          {isPasswordMode && (
            <div className="auth-password-field">
              <Lock className="auth-icon" />
              <input className="auth-input" type={showPassword ? 'text' : 'password'} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New Password" />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label="Show password">
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          )}
          {mode === 'signup' && (
            <div className="auth-password-field">
              <Lock className="auth-icon" />
              <input className="auth-input" type="password" required minLength={6} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Confirm Password" />
            </div>
          )}
          {mode === 'reset' && (
            <div className="auth-password-field">
              <Lock className="auth-icon" />
              <input className="auth-input" type={showPassword ? 'text' : 'password'} required minLength={6} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Confirm New Password" />
            </div>
          )}
          {mode === 'signup' && <label className="remember-row"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Remember me</label>}
          <button className="primary-button" type="submit" disabled={isLoading}>{isLoading ? 'Please wait...' : mode === 'signup' ? 'Sign Up' : mode === 'forgot' ? 'Continue' : mode === 'verify' ? 'Verify' : 'Continue'}</button>
        </form>

        {mode === 'signup' && <p className="auth-switch">Already have an account? <button type="button" onClick={() => navigate('/login')}>Sign In</button></p>}
        {mode === 'forgot' && <p className="auth-switch">Remember your Account? <button type="button" onClick={() => navigate('/login')}>Sign In</button></p>}
        {mode === 'verify' && <p className="auth-switch">Didn't receive Code? <button type="button" onClick={() => setMessage('A new code has been requested')}>Resend Code</button></p>}
      </div>
    </div>
  )
}

export default AuthScreens
