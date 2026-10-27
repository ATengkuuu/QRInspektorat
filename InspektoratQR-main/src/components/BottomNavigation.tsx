import { List, UserRound } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [indonesian, setIndonesian] = useState(localStorage.getItem('qr_language') === 'id')
  useEffect(() => { const update = () => setIndonesian(localStorage.getItem('qr_language') === 'id'); window.addEventListener('qr-preferences-change', update); return () => window.removeEventListener('qr-preferences-change', update) }, [])

  const isActive = (path: string) => location.pathname === path;

  // Don't show navigation on login and signup pages
  if (['/login', '/signup', '/forgot-password', '/verify', '/reset-password'].includes(location.pathname)) {
    return null;
  }

  return (
    <div className="bottom-nav">
      <div className="bottom-nav-inner">
        <button
          onClick={() => navigate('/')}
          className={`nav-item ${isActive('/') ? 'active' : ''}`}
        >
          <List size={24} />
          <span>{indonesian ? 'Produk' : 'Product'}</span>
        </button>

        {user && (
          <button
            onClick={() => navigate('/user')}
            className={`nav-item ${location.pathname.startsWith('/user') ? 'active' : ''}`}
          >
            <UserRound size={24} />
            <span>{indonesian ? 'Pengguna' : 'User'}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default BottomNavigation;
