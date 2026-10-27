import { List, UserRound } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

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
          className={`nav-item ${
            isActive('/') ? 'active' : ''
          }`}
        >
          <List size={24} />
          <span>Product</span>
        </button>

        {user && (
          <button
            onClick={() => navigate('/user')}
            className={`nav-item ${location.pathname.startsWith('/user') ? 'active' : ''}`}
          >
            <UserRound size={24} />
            <span>User</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default BottomNavigation;
