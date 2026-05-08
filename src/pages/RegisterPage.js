import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { createUserWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth';
import { auth, googleProvider, facebookProvider, db } from '../firebase';
import { push, ref } from 'firebase/database';

function RegisterPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    terms: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showPopup } = useAuth();

  const validateField = (name, value) => {
    switch (name) {
      case 'firstName':
        return value.trim() ? null : 'First name is required';
      case 'lastName':
        return value.trim() ? null : 'Last name is required';
      case 'email':
        return value.includes('@') ? null : 'Please enter a valid email';
      case 'phone':
        return value.length >= 10 ? null : 'Please enter a valid phone number';
      case 'password':
        return value.length >= 8 ? null : 'Password must be at least 8 characters';
      case 'confirmPassword':
        return value === formData.password ? null : 'Passwords do not match';
      default:
        return null;
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setErrors(prev => ({ ...prev, [name]: null, general: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    
    Object.keys(formData).forEach(key => {
      if (key !== 'terms') {
        const error = validateField(key, formData[key]);
        if (error) newErrors[key] = error;
      }
    });

    if (!formData.terms) {
      setErrors({ terms: 'You must agree to the Terms of Service' });
      return;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      await updateProfile(userCredential.user, {
        displayName: `${formData.firstName} ${formData.lastName}`
      });
      
      await push(ref(db, 'users'), {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        phone: formData.phone,
        createdAt: Date.now(),
        loyalty_points: 0
      });
      
      showPopup('Welcome! Account created successfully.');
      setTimeout(() => navigate('/'), 1500);
    } catch (error) {
      setErrors({ general: error.message || 'Failed to create account' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      showPopup('Welcome! Registered with Google.');
      setTimeout(() => navigate('/'), 1500);
    } catch (error) {
      setErrors({ general: error.message || 'Failed to sign up with Google' });
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookSignUp = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, facebookProvider);
      showPopup('Welcome! Registered with Facebook.');
      setTimeout(() => navigate('/'), 1500);
    } catch (error) {
      setErrors({ general: error.message || 'Failed to sign up with Facebook' });
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
          <p className="hero-tag">Join Us</p>
          <h1 className="hero-title" style={{ fontSize: '56px' }}>Create Your Account</h1>
          <p className="hero-subtitle">Become part of the Food Lover family and enjoy exclusive benefits.</p>
        </div>
      </section>

      <section className="register-section">
        <div className="container">
          <div className="register-card">
            <form className="register-form" onSubmit={handleSubmit}>
              <h3>Sign Up</h3>
              <p className="form-desc">Fill in your details to create an account</p>
              
              {errors.general && <div className="field-error" style={{ textAlign: 'center', marginBottom: '15px' }}>{errors.general}</div>}
              
              <div className="form-row">
                <div className="form-group">
                  <input 
                    type="text" 
                    name="firstName" 
                    value={formData.firstName}
                    onChange={handleChange}
                    required 
                    placeholder=" "
                    aria-label="First Name"
                    style={{ borderColor: errors.firstName ? '#e74c3c' : '' }}
                  />
                  <label htmlFor="firstName">First Name</label>
                  {errors.firstName && <span className="field-error">{errors.firstName}</span>}
                </div>
                <div className="form-group">
                  <input 
                    type="text" 
                    name="lastName" 
                    value={formData.lastName}
                    onChange={handleChange}
                    required 
                    placeholder=" "
                    aria-label="Last Name"
                    style={{ borderColor: errors.lastName ? '#e74c3c' : '' }}
                  />
                  <label htmlFor="lastName">Last Name</label>
                  {errors.lastName && <span className="field-error">{errors.lastName}</span>}
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group full-width">
                  <input 
                    type="email" 
                    name="email" 
                    value={formData.email}
                    onChange={handleChange}
                    required 
                    placeholder=" "
                    aria-label="Email Address"
                    style={{ borderColor: errors.email ? '#e74c3c' : '' }}
                  />
                  <label htmlFor="email">Email Address</label>
                  {errors.email && <span className="field-error">{errors.email}</span>}
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group full-width">
                  <input 
                    type="tel" 
                    name="phone" 
                    value={formData.phone}
                    onChange={handleChange}
                    required 
                    placeholder=" "
                    aria-label="Phone Number"
                    style={{ borderColor: errors.phone ? '#e74c3c' : '' }}
                  />
                  <label htmlFor="phone">Phone Number</label>
                  {errors.phone && <span className="field-error">{errors.phone}</span>}
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group full-width password-wrapper">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    name="password" 
                    value={formData.password}
                    onChange={handleChange}
                    required 
                    minLength="8"
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
              </div>
              
              <div className="form-row">
                <div className="form-group full-width password-wrapper">
                  <input 
                    type={showConfirmPassword ? 'text' : 'password'} 
                    name="confirmPassword" 
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required 
                    placeholder=" "
                    aria-label="Confirm Password"
                    style={{ borderColor: errors.confirmPassword ? '#e74c3c' : '' }}
                  />
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <button 
                    type="button" 
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                  {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
                </div>
              </div>
              
              <div className="form-checkbox">
                <input 
                  type="checkbox" 
                  name="terms"
                  checked={formData.terms}
                  onChange={handleChange}
                  required
                />
                <label htmlFor="terms">I agree to the <Link to="#">Terms of Service</Link> and <Link to="#">Privacy Policy</Link></label>
              </div>
              
              <button type="submit" className="form-submit" disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
              
              <div className="form-divider">or continue with</div>
              
              <div className="social-register">
                <button type="button" className="social-btn" onClick={handleGoogleSignUp} disabled={loading}>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </button>
                <button type="button" className="social-btn" onClick={handleFacebookSignUp} disabled={loading}>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Facebook
                </button>
              </div>
              
              <p className="login-link">Already have an account? <Link to="/login">Sign in</Link></p>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

export default RegisterPage;