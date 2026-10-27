import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Loader } from 'lucide-react';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      setError('Invalid email or password');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card login-card">
        <img src="/Inspektorat.png" alt="Logo Kalimantan Timur" className="auth-logo" />
        <h2 className="auth-heading">Sign In into your Account</h2>

        {location.state?.message && (
          <p className="auth-message success">{location.state.message}</p>
        )}

        <form onSubmit={handleSubmit}>
          {error && (
            <p className="auth-message error">{error}</p>
          )}

          <div className="auth-fields login-fields">
            <input id="email-address" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input auth-input-plain" placeholder="Email Address" />
            <div className="auth-password-field login-password-field">
              <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="auth-input auth-input-plain" placeholder="Password" />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button type="button" className="login-forgot" onClick={() => navigate('/forgot-password')}>Forget Password?</button>
          <div className="auth-submit">
            <button
              type="submit"
              disabled={isLoading}
              className="primary-button"
            >
              {isLoading ? (
                <Loader className="animate-spin h-5 w-5" />
              ) : (
                'Sign in'
              )}
            </button>
          </div>
          <div className="login-or">Or <button type="button" onClick={() => navigate('/signup')}>Sign Up</button></div>
          <button type="button" className="primary-button login-signup" onClick={() => navigate('/signup')}>Sign Up</button>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;
