import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronRight, Edit3, FilePlus2, Globe2, History, Pencil, Trash2, UserRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, ApiUser } from '../lib/api'

const UserHero = ({ title }: { title: string }) => {
  const navigate = useNavigate()
  return (
    <div className="user-hero">
      {title !== 'User' && <button className="user-back" onClick={() => navigate('/user')} aria-label="Back"><ArrowLeft size={14} /></button>}
      <h1>{title}</h1>
      <div className="user-avatar"><UserRound size={38} /></div>
    </div>
  )
}

const UserMenu = () => {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  return (
    <>
      <UserHero title="User" />
      <div className="user-panel user-menu-panel">
        <button className="user-menu-row" onClick={() => navigate('/user/profile')}><span>Profile</span><ChevronRight size={14} /></button>
        <button className="user-menu-row" onClick={() => navigate('/user/history')}><span>History</span><ChevronRight size={14} /></button>
        <p className="user-section-label">Preferences</p>
        <div className="user-menu-row"><span>Dark Mode</span><span className="toggle"><i /></span></div>
        <button className="user-menu-row" onClick={() => navigate('/user/language')}><span>Language</span><ChevronRight size={14} /></button>
        <button className="secondary-button user-signout" onClick={async () => { await signOut(); navigate('/login') }}>Sign Out</button>
      </div>
    </>
  )
}

const ProfileScreen = () => {
  const { user } = useAuth()
  const [form, setForm] = useState<ApiUser>({ id: '', username: '', email: '', dateOfBirth: '', field: '' })
  const [message, setMessage] = useState('')
  useEffect(() => { if (user) setForm(user) }, [user])
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    await apiRequest('/auth/me', { method: 'PUT', body: JSON.stringify({ username: form.username, email: form.email, dateOfBirth: form.dateOfBirth, field: form.field }) })
    setMessage('Profile berhasil disimpan')
  }
  return (
    <>
      <UserHero title="Profile" />
      <form className="user-panel profile-form" onSubmit={save}>
        {(['username', 'email', 'dateOfBirth', 'field'] as const).map((key) => (
          <label key={key}>{key === 'dateOfBirth' ? 'Date Of Birth' : key[0].toUpperCase() + key.slice(1)}
            <div className="user-input-wrap"><input type={key === 'dateOfBirth' ? 'date' : 'text'} value={form[key] || ''} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /><Edit3 size={12} /></div>
          </label>
        ))}
        {message && <p className="auth-message success">{message}</p>}
        <button className="primary-button" type="submit">Save</button>
      </form>
    </>
  )
}

const HistoryScreen = () => (
  <>
    <UserHero title="History" />
    <div className="user-panel history-panel">
      <div className="history-row"><FilePlus2 /><span>User has added [Product Name].</span></div>
      <div className="history-row"><Globe2 /><span>User has downloaded the QR [Product Name].</span></div>
      <div className="history-row"><Trash2 /><span>User has deleted [Product Name].</span></div>
    </div>
  </>
)

const LanguageScreen = () => {
  const navigate = useNavigate()
  return (
    <>
      <UserHero title="Language" />
      <div className="user-panel language-panel">
        <p>Language</p>
        <label><span>Bahasa Indonesia</span><input type="radio" name="language" /></label>
        <label><span>Bahasa Inggris</span><input type="radio" name="language" defaultChecked /></label>
        <button className="primary-button" onClick={() => navigate('/user')}>Save</button>
      </div>
    </>
  )
}

export default function UserScreens() {
  const { pathname } = useLocation()
  if (pathname === '/user/profile') return <ProfileScreen />
  if (pathname === '/user/history') return <HistoryScreen />
  if (pathname === '/user/language') return <LanguageScreen />
  return <UserMenu />
}
