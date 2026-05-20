import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../firebase';
import '../styles/ForgotPasswordPage.css';

function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { showPopup } = useAuth();

  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    };
  }, []);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setErrors({});
    
    if (!phoneNumber || !phoneNumber.startsWith('+') || phoneNumber.length < 8) {
      setErrors({ phoneNumber: 'Enter a valid phone number with country code (e.g., +1234567890)' });
      return;
    }

    setLoading(true);
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          'size': 'invisible',
          'callback': (response) => {}
        });
      }

      const appVerifier = window.recaptchaVerifier;
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      
      window.confirmationResult = confirmationResult;
      showPopup('OTP sent! Check your phone.');
      setStep(2);
    } catch (error) {
      console.error('Error sending OTP:', error);
      let errorMsg = error.message || 'Failed to send OTP';
      if (error.code === 'auth/invalid-phone-number') {
        errorMsg = 'Invalid phone number format.';
      }
      setErrors({ general: errorMsg });
      
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setErrors({});
    if (!otp || otp.length < 6) {
      setErrors({ otp: 'Enter the 6-digit OTP' });
      return;
    }

    setLoading(true);
    try {
      await window.confirmationResult.confirm(otp);
      showPopup('Verified and logged in successfully!');
      navigate('/');
    } catch (error) {
      console.error('Error verifying OTP:', error);
      const errorMsg = error.message || 'Invalid OTP';
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
          <p className="hero-tag">Phone Authentication</p>
          <h1 className="hero-title" style={{ fontSize: '48px' }}>Log In / Recover</h1>
        </div>
      </section>

      <section className="login-section">
        <div className="container">
          <div className="login-card forgot-password-card">
            <div id="recaptcha-container"></div>

            {step === 1 && (
              <form className="login-form" onSubmit={handleSendOTP}>
                <h3>Phone Verification</h3>
                <p className="form-desc">Enter your phone number (with country code) to receive a secure code.</p>
                {errors.general && <div className="field-error center-error">{errors.general}</div>}
                
                <div className="form-group">
                  <input 
                    type="tel" 
                    id="phoneNumber" 
                    value={phoneNumber}
                    onChange={(e) => { setPhoneNumber(e.target.value); setErrors({...errors, phoneNumber: null, general: null}); }}
                    required placeholder=" " className={errors.phoneNumber ? 'error-input' : ''}
                    dir="ltr"
                  />
                  <label htmlFor="phoneNumber">Phone Number (e.g. +123...)</label>
                  {errors.phoneNumber && <span className="field-error">{errors.phoneNumber}</span>}
                </div>
                
                <button type="submit" className="form-submit" disabled={loading}>
                  {loading ? 'Sending...' : 'Send SMS Code'}
                </button>
                <p className="login-link"><Link to="/login">Back to Login</Link></p>
              </form>
            )}

            {step === 2 && (
              <form className="login-form" onSubmit={handleVerifyOTP}>
                <h3>Enter Verification Code</h3>
                <p className="form-desc">Code sent to <strong>{phoneNumber}</strong></p>
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
                  {loading ? 'Verifying...' : 'Verify & Log In'}
                </button>
                
                <p className="login-link"><Link to="#" onClick={() => { setStep(1); setOtp(''); }}>Change Phone Number</Link></p>
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