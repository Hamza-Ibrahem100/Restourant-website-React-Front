import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import '../styles/ForgotPasswordPage.css';

function ForgotPasswordPage() {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState(null);
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); // 5 minutes = 300 seconds

  const navigate = useNavigate();
  const { showPopup } = useAuth();

  // Timer logic for OTP step
  useEffect(() => {
    if (step === 2 && timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [step, timeLeft]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setErrors({});
    if (!email || !email.includes('@')) {
      setErrors({ email: 'Please enter a valid email address.' });
      return;
    }

    setLoading(true);
    try {
      await dataService.sendOtp(email);
      showPopup('OTP sent! Please check your email.');
      setStep(2);
      setTimeLeft(300); // 5 minutes
    } catch (error) {
      setErrors({ general: error.response?.data?.error || error.message || 'Failed to send OTP.' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrors({});
    if (!otp || otp.length < 6) {
      setErrors({ otp: 'Please enter the 6-digit OTP.' });
      return;
    }

    setLoading(true);
    try {
      const res = await dataService.verifyOtp(email, otp);
      setResetToken(res.resetToken);
      showPopup('OTP verified successfully.');
      setStep(3);
    } catch (error) {
      setErrors({ general: error.response?.data?.error || error.message || 'Invalid OTP.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrors({});
    if (newPassword.length < 6) {
      setErrors({ newPassword: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    try {
      await dataService.resetPassword(email, resetToken, newPassword);
      showPopup('Password reset successfully! You can now log in.', true);
      navigate('/login');
    } catch (error) {
      setErrors({ general: error.response?.data?.error || error.message || 'Failed to reset password.' });
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
          <p className="hero-tag">Account Recovery</p>
          <h1 className="hero-title" style={{ fontSize: '48px' }}>Reset Password</h1>
        </div>
      </section>

      <section className="login-section">
        <div className="container">
          <div className="login-card forgot-password-card">
            
            {/* STEP 1: REQUEST OTP */}
            {step === 1 && (
              <form className="login-form" onSubmit={handleRequestOtp}>
                <h3>Forgot Password?</h3>
                <p className="form-desc">Enter your email and we'll send you a 6-digit verification code.</p>
                
                {errors.general && <div className="field-error center-error">{errors.general}</div>}
                
                <div className="form-group">
                  <input 
                    type="email" 
                    id="email" 
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors({...errors, email: null, general: null}); }}
                    required 
                    placeholder=" "
                    className={errors.email ? 'error-input' : ''}
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

            {/* STEP 2: VERIFY OTP */}
            {step === 2 && (
              <form className="login-form" onSubmit={handleVerifyOtp}>
                <h3>Enter Verification Code</h3>
                <p className="form-desc">We sent a 6-digit code to <strong>{email}</strong>.</p>
                
                {errors.general && <div className="field-error center-error">{errors.general}</div>}
                
                <div className="form-group otp-group">
                  <input 
                    type="text" 
                    id="otp" 
                    value={otp}
                    onChange={(e) => { 
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtp(val); 
                      setErrors({...errors, otp: null, general: null}); 
                    }}
                    required 
                    placeholder=" "
                    maxLength={6}
                    className={errors.otp ? 'error-input' : ''}
                    style={{ letterSpacing: '8px', textAlign: 'center', fontSize: '24px' }}
                  />
                  <label htmlFor="otp">6-Digit OTP</label>
                  {errors.otp && <span className="field-error">{errors.otp}</span>}
                </div>

                <div className="timer-display">
                  {timeLeft > 0 ? (
                    <p>Code expires in: <span>{formatTime(timeLeft)}</span></p>
                  ) : (
                    <p className="expired-text">Code has expired.</p>
                  )}
                </div>
                
                <button type="submit" className="form-submit" disabled={loading || timeLeft === 0 || otp.length < 6}>
                  {loading ? 'Verifying...' : 'Verify Code'}
                </button>

                <div className="resend-action">
                  <button 
                    type="button" 
                    className="resend-btn" 
                    onClick={handleRequestOtp} 
                    disabled={loading || timeLeft > 240} // Only allow resend after 1 min
                  >
                    Resend Code
                  </button>
                </div>
                
                <p className="login-link"><Link to="#" onClick={() => setStep(1)}>Change Email</Link></p>
              </form>
            )}

            {/* STEP 3: RESET PASSWORD */}
            {step === 3 && (
              <form className="login-form" onSubmit={handleResetPassword}>
                <h3>Create New Password</h3>
                <p className="form-desc">Please enter your new password below.</p>
                
                {errors.general && <div className="field-error center-error">{errors.general}</div>}
                
                <div className="form-group">
                  <input 
                    type="password" 
                    id="newPassword" 
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setErrors({...errors, newPassword: null, general: null}); }}
                    required 
                    placeholder=" "
                    className={errors.newPassword ? 'error-input' : ''}
                  />
                  <label htmlFor="newPassword">New Password</label>
                  {errors.newPassword && <span className="field-error">{errors.newPassword}</span>}
                </div>

                <div className="form-group">
                  <input 
                    type="password" 
                    id="confirmPassword" 
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setErrors({...errors, confirmPassword: null, general: null}); }}
                    required 
                    placeholder=" "
                    className={errors.confirmPassword ? 'error-input' : ''}
                  />
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
                </div>
                
                <button type="submit" className="form-submit" disabled={loading}>
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
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
