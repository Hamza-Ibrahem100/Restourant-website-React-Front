import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { signInWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';
import { auth, googleProvider, facebookProvider } from '../firebase';
import { dataService } from '../services/dataService';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showPopup } = useAuth();

  useEffect(() => {
    const savedEmail = localStorage.getItem('savedEmail');
    const remember = localStorage.getItem('rememberMe') === 'true';
    if (savedEmail) setEmail(savedEmail);
    if (remember) setRememberMe(true);
  }, []);

  const validateField = (name, value) => {
    if (name === 'email') {
      if (!value.includes('@')) return 'Please enter a valid email';
    }
    if (name === 'password') {
      if (value.length < 1) return 'Password is required';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    
    const emailError = validateField('email', email);
    const passwordError = validateField('password', password);
    
    if (emailError) newErrors.email = emailError;
    if (passwordError) newErrors.password = passwordError;
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('savedEmail', email);
      } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('savedEmail');
      }
      showPopup('Signed in successfully.');
      setTimeout(() => navigate('/'), 1500);
    } catch (error) {
      setErrors({ general: error.message || 'Failed to sign in' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      showPopup('Signed in successfully with Google.');
      setTimeout(() => navigate('/'), 1500);
    } catch (error) {
      setErrors({ general: error.message || 'Failed to sign in with Google' });
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, facebookProvider);
      showPopup('Signed in successfully with Facebook.');
      setTimeout(() => navigate('/'), 1500);
    } catch (error) {
      setErrors({ general: error.message || 'Failed to sign in with Facebook' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Nav />
      
      <section className="hero static" style={{ minHeight: '50vh' }}>
        <div className="hero-bg"></div>
        <div className="hero-content">
          <p className="hero-tag">Welcome Back</p>
          <h1 className="hero-title" style={{ fontSize: '56px' }}>Sign In</h1>
          <p className="hero-subtitle">Access your account to manage reservations and more.</p>
        </div>
      </section>

      <section className="login-section">
        <div className="container">
          <div className="login-card">
            <form className="login-form" onSubmit={handleSubmit}>
              <h3>Welcome Back</h3>
              <p className="form-desc">Sign in to your account</p>
              
              {errors.general && <div className="field-error" style={{ textAlign: 'center', marginBottom: '15px' }}>{errors.general}</div>}
              
              <div className="form-group">
                <input 
                  type="email" 
                  id="email" 
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors({...errors, email: null, general: null}); }}
                  required 
                  placeholder=" "
                  aria-label="Email Address"
                  style={{ borderColor: errors.email ? '#e74c3c' : '' }}
                />
                <label htmlFor="email">Email Address</label>
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>
              
              <div className="form-group password-wrapper">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  id="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors({...errors, password: null, general: null}); }}
                  required 
                  placeholder=" "
                  aria-label="Password"
                  style={{ borderColor: errors.password ? '#e74c3c' : '' }}
                />
                <label htmlFor="password">Password</label>
                <button 
                  type="button" 
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
                {errors.password && <span className="field-error">{errors.password}</span>}
              </div>
              
              <div className="form-row-check">
                <div className="form-checkbox">
                  <input 
                    type="checkbox" 
                    id="rememberMe" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <label htmlFor="rememberMe">Remember me</label>
                </div>
                <Link to="/forgot-password" className="forgot-password">Forgot password?</Link>
              </div>
              
              <button type="submit" className="form-submit" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              
              <div className="form-divider">or continue with</div>
              
              <div className="social-register">
                <button type="button" className="social-btn" onClick={handleGoogleLogin} disabled={loading}>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </button>
                <button type="button" className="social-btn" onClick={handleFacebookLogin} disabled={loading}>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Facebook
                </button>
              </div>
              
              <p className="login-link">Don't have an account? <Link to="/register">Create one</Link></p>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

export default LoginPage;