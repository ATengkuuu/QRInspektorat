import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronRight, Edit3, FilePlus2, Globe2, Trash2, UserRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, ApiUser } from '../lib/api'

type Language = 'id' | 'en'
const labels = {
  id: { user: 'Pengguna', profile: 'Profil', history: 'Riwayat', preferences: 'Preferensi', dark: 'Mode Gelap', language: 'Bahasa', signOut: 'Keluar', save: 'Simpan', username: 'Nama Pengguna', email: 'Email', birth: 'Tanggal Lahir', field: 'Bidang', indonesia: 'Bahasa Indonesia', english: 'Bahasa Inggris', saved: 'Profil berhasil disimpan' },
  en: { user: 'User', profile: 'Profile', history: 'History', preferences: 'Preferences', dark: 'Dark Mode', language: 'Language', signOut: 'Sign Out', save: 'Save', username: 'Username', email: 'Email', birth: 'Date Of Birth', field: 'Field', indonesia: 'Bahasa Indonesia', english: 'English', saved: 'Profile saved successfully' },
}

const getLanguage = (): Language => localStorage.getItem('qr_language') === 'id' ? 'id' : 'en'
const notifyPreferences = () => window.dispatchEvent(new Event('qr-preferences-change'))
const normalizeDate = (value?: string) => value ? value.slice(0, 10) : ''

const UserHero = ({ title, language, user }: { title: string; language: Language; user: ApiUser | null }) => {
  const navigate = useNavigate()
  const text = labels[language]
  return (
    <div className="user-hero">
      {title !== text.user && <button className="user-back" onClick={() => navigate('/user')} aria-label="Back"><ArrowLeft size={14} /></button>}
      <h1>{title}</h1>
      <div className="user-avatar">{user?.profileImage ? <img src={user.profileImage} alt={text.profile} /> : <UserRound size={38} />}</div>
    </div>
  )
}

const UserMenu = ({ language, setDark }: { language: Language; setDark: (value: boolean) => void }) => {
  const navigate = useNavigate()
  const { signOut, user } = useAuth()
  const text = labels[language]
  const [dark, setDarkState] = useState(localStorage.getItem('qr_dark_mode') === 'true')
  const toggleDark = () => { const next = !dark; setDarkState(next); localStorage.setItem('qr_dark_mode', String(next)); setDark(next); notifyPreferences() }
  return (
    <>
      <UserHero title={text.user} language={language} user={user} />
      <div className="user-panel user-menu-panel">
        <button className="user-menu-row" onClick={() => navigate('/user/profile')}><span>{text.profile}</span><ChevronRight size={14} /></button>
        <button className="user-menu-row" onClick={() => navigate('/user/history')}><span>{text.history}</span><ChevronRight size={14} /></button>
        <p className="user-section-label">{text.preferences}</p>
        <button className="user-menu-row" onClick={toggleDark}><span>{text.dark}</span><span className={`toggle ${dark ? 'on' : ''}`}><i /></span></button>
        <button className="user-menu-row" onClick={() => navigate('/user/language')}><span>{text.language}</span><ChevronRight size={14} /></button>
        <button className="secondary-button user-signout" onClick={async () => { await signOut(); navigate('/login') }}>{text.signOut}</button>
      </div>
    </>
  )
}

const ProfileScreen = ({ language }: { language: Language }) => {
  const { user, updateCurrentUser } = useAuth()
  const text = labels[language]
  const [form, setForm] = useState<ApiUser>({ id: '', username: '', email: '', dateOfBirth: '', field: '', profileImage: '' })
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (user) setForm({ ...user, dateOfBirth: normalizeDate(user.dateOfBirth) })
  }, [user])
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    await apiRequest('/auth/me', { method: 'PUT', body: JSON.stringify({ username: form.username, email: form.email, dateOfBirth: normalizeDate(form.dateOfBirth), field: form.field, profileImage: form.profileImage || null }) })
    const savedUser = await apiRequest<ApiUser>('/auth/me')
    updateCurrentUser({ ...savedUser, dateOfBirth: normalizeDate(savedUser.dateOfBirth) })
    setForm({ ...savedUser, dateOfBirth: normalizeDate(savedUser.dateOfBirth) })
    setMessage(text.saved)
  }
  const upload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024 || !file.type.startsWith('image/')) { setMessage('Foto maksimal 2MB'); return }
    const reader = new FileReader()
    reader.onload = () => setForm({ ...form, profileImage: String(reader.result) })
    reader.readAsDataURL(file)
  }
  return (
    <>
      <UserHero title={text.profile} language={language} user={form} />
      <form className="user-panel profile-form" onSubmit={save}>
        <label className="profile-upload"><span className="profile-upload-preview">{form.profileImage ? <img src={form.profileImage} alt={text.profile} /> : <UserRound size={28} />}</span><span>Foto Profil</span><input type="file" accept="image/*" onChange={upload} /></label>
        {([['username', text.username], ['email', text.email], ['dateOfBirth', text.birth], ['field', text.field]] as const).map(([key, label]) => (
          <label key={key}>{label}<div className="user-input-wrap"><input type={key === 'dateOfBirth' ? 'date' : 'text'} value={form[key] || ''} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /><Edit3 size={12} /></div></label>
        ))}
        {message && <p className="auth-message success">{message}</p>}
        <button className="primary-button" type="submit">{text.save}</button>
      </form>
    </>
  )
}

const HistoryScreen = ({ language }: { language: Language }) => {
  const text = labels[language]
  return <><UserHero title={text.history} language={language} user={null} /><div className="user-panel history-panel"><div className="history-row"><FilePlus2 /><span>{language === 'id' ? 'Pengguna menambahkan [Nama Produk].' : 'User has added [Product Name].'}</span></div><div className="history-row"><Globe2 /><span>{language === 'id' ? 'Pengguna mengunduh QR [Nama Produk].' : 'User has downloaded the QR [Product Name].'}</span></div><div className="history-row"><Trash2 /><span>{language === 'id' ? 'Pengguna menghapus [Nama Produk].' : 'User has deleted [Product Name].'}</span></div></div></>
}

const LanguageScreen = ({ language, setLanguage }: { language: Language; setLanguage: (value: Language) => void }) => {
  const navigate = useNavigate()
  const text = labels[language]
  return <><UserHero title={text.language} language={language} user={null} /><div className="user-panel language-panel"><p>{text.language}</p><label><span>{text.indonesia}</span><input type="radio" name="language" checked={language === 'id'} onChange={() => { localStorage.setItem('qr_language', 'id'); setLanguage('id'); notifyPreferences() }} /></label><label><span>{text.english}</span><input type="radio" name="language" checked={language === 'en'} onChange={() => { localStorage.setItem('qr_language', 'en'); setLanguage('en'); notifyPreferences() }} /></label><button className="primary-button" onClick={() => navigate('/user')}>{text.save}</button></div></>
}

export default function UserScreens() {
  const { pathname } = useLocation()
  const [language, setLanguage] = useState<Language>(getLanguage)
  const [, setPreferencesVersion] = useState(0)
  const [dark, setDark] = useState(localStorage.getItem('qr_dark_mode') === 'true')
  useEffect(() => { const update = () => { setLanguage(getLanguage()); setDark(localStorage.getItem('qr_dark_mode') === 'true') }; window.addEventListener('qr-preferences-change', update); return () => window.removeEventListener('qr-preferences-change', update) }, [])
  useEffect(() => { document.documentElement.classList.toggle('dark-mode', dark); setPreferencesVersion((value) => value + 1) }, [dark])
  if (pathname === '/user/profile') return <ProfileScreen language={language} />
  if (pathname === '/user/history') return <HistoryScreen language={language} />
  if (pathname === '/user/language') return <LanguageScreen language={language} setLanguage={setLanguage} />
  return <UserMenu language={language} setDark={setDark} />
}
