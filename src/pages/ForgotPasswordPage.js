import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import '../styles/ForgotPasswordPage.css';

function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { showPopup } = useAuth();

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setErrors({});
    
    if (!email || !email.includes('@')) {
      setErrors({ email: 'Enter a valid email address' });
      return;
    }

    setLoading(true);
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'https://restaurant-website-react-back-5k53kprwm.vercel.app/api';
      await axios.post(`${apiUrl}/auth/send-otp`, { email });
      showPopup('OTP sent to your email!');
      setStep(2);
    } catch (error) {
      console.error('Error sending OTP:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Failed to send OTP';
      setErrors({ general: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setErrors({});
    if (!otp || otp.length !== 6) {
      setErrors({ otp: 'Enter the 6-digit OTP' });
      return;
    }

    setLoading(true);
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'https://restaurant-website-react-back-5k53kprwm.vercel.app/api';
      const res = await axios.post(`${apiUrl}/auth/verify-otp`, { email, otp });
      
      if (res.data.success) {
        showPopup('Password reset! Set your new password.');
        navigate('/reset-password', { state: { email } });
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      const errorMsg = error.response?.data?.message || 'Invalid OTP';
      setErrors({ general: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Nav />
      <section className="hero static" style={{ minHeight: '40vh' }}>
        <div className="hero-bg"></div>
        <div className="hero-content">
          <p className="hero-tag">Email Authentication</p>
          <h1 className="hero-title" style={{ fontSize: '48px' }}>Forgot Password</h1>
        </div>
      </section>

      <section className="login-section">
        <div className="container">
          <div className="login-card forgot-password-card">
            {step === 1 && (
              <form className="login-form" onSubmit={handleSendOTP}>
                <h3>Forgot Password?</h3>
                <p className="form-desc">Enter your email for a 6-digit verification code.</p>
                {errors.general && <div className="field-error center-error">{errors.general}</div>}
                
                <div className="form-group">
                  <input 
                    type="email" 
                    id="email" 
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors({...errors, email: null, general: null}); }}
                    required placeholder=" " className={errors.email ? 'error-input' : ''}
                  />
                  <label htmlFor="email">Email Address</label>
                  {errors.email && <span className="field-error">{errors.email}</span>}
                </div>
                
                <button type="submit" className="form-submit" disabled={loading}>
                  {loading ? 'Sending...' : 'Send OTP'}
                </button>
                <p className="login-link"><Link to="/login">Back to Login</Link></p>
              </form>
            )}

            {step === 2 && (
              <form className="login-form" onSubmit={handleVerifyOTP}>
                <h3>Enter Verification Code</h3>
                <p className="form-desc">Code sent to <strong>{email}</strong></p>
                {errors.general && <div className="field-error center-error">{errors.general}</div>}
                
                <div className="form-group otp-group">
                  <input 
                    type="text" id="otp" 
                    value={otp}
                    onChange={(e) => { 
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtp(val); 
                      setErrors({...errors, otp: null, general: null}); 
                    }}
                    required placeholder=" " maxLength={6}
                    className={errors.otp ? 'error-input' : ''}
                    style={{ letterSpacing: '8px', textAlign: 'center', fontSize: '24px' }}
                  />
                  <label htmlFor="otp">6-Digit OTP</label>
                  {errors.otp && <span className="field-error">{errors.otp}</span>}
                </div>
                
                <button type="submit" className="form-submit" disabled={loading || otp.length < 6}>
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
                
                <p className="login-link"><Link to="#" onClick={() => { setStep(1); setOtp(''); }}>Change Email</Link></p>
              </form>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}

export default ForgotPasswordPage;