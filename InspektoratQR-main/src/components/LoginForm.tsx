import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, Loader } from 'lucide-react';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      <div className="auth-card">
        {/* Company Logo */}
        <div className="flex flex-col items-center">
          <img
            src="/Inspektorat.png"
            alt="Logo Kalimantan Timur"
            className="auth-logo"
          />
          <h2 className="auth-heading">
            Sign In into your Account
          </h2>
        </div>

        {location.state?.message && (
          <div className="rounded-md bg-green-50 p-4">
            <p className="text-sm text-green-700">{location.state.message}</p>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="auth-fields">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <Mail className="auth-icon" />
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <Lock className="auth-icon" />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                placeholder="Password"
              />
            </div>
          </div>

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
          <div className="auth-links">
            <button type="button" onClick={() => navigate('/forgot-password')}>Forget Password?</button>
            <span>Or</span>
            <button type="button" onClick={() => navigate('/signup')}>Sign Up</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;
