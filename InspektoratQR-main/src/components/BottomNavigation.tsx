import { List, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

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
            onClick={handleSignOut}
            className="nav-item"
          >
            <LogOut size={24} />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default BottomNavigation;
