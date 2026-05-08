import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { signOut, deleteUser } from 'firebase/auth';
import { auth } from '../firebase';
import LogoutModal from './LogoutModal';

function Nav() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { user, showPopup } = useAuth();
  const { cartCount } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId) => {
    setIsOpen(false);
    if (window.location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleLogout = async () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    if (!user) return;
    
    try {
      const userAuth = auth.currentUser;
      await signOut(auth);
      if (userAuth) {
        await deleteUser(userAuth);
      }
      showPopup('Account deleted successfully.', true);
      setTimeout(() => {
        window.location.href = '/login';
      }, 1000);
    } catch (error) {
      console.error('Delete account error:', error);
      showPopup('Failed to delete account.', false);
    }
  };

  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  const navLinks = [
    { id: 'about', label: 'About' },
    { id: 'menu', label: 'Menu' },
    { id: 'specials', label: 'Specials' },
    { id: 'ordering', label: 'Order' },
    { id: 'events', label: 'Events' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'reservation', label: 'Reserve' }
  ];

  return (
    <>
      <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="container nav-inner">
          <Link to="/" className="logo">Food Lover</Link>
          <ul className="nav-links">
            {navLinks.map(link => (
              <li key={link.id}>
                <button 
                  onClick={() => scrollToSection(link.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {link.label}
                </button>
              </li>
            ))}
            {user?.email === 'hamzaelsharkh@gmail.com' ? (
              <li><Link to="/admin">Dashboard</Link></li>
            ) : user ? (
              <li className="user-menu">
                <span className="user-name">{user.firstName || 'User'}</span>
                <button onClick={handleLogout}>Logout</button>
              </li>
            ) : (
              <li><Link to="/login">Login</Link></li>
)}
            </ul>
            <button 
              onClick={() => navigate('/cart')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                padding: '8px',
                marginRight: '16px'
              }}
            >
              <span style={{ fontSize: '24px' }}>🛒</span>
              {cartCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '0',
                  right: '0',
                  background: 'var(--primary-accent)',
                  color: 'var(--bg-dark)',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold'
                }}>
                  {cartCount}
                </span>
              )}
            </button>
            <div
            className={`hamburger ${isOpen ? 'active' : ''}`}
            onClick={() => setIsOpen(!isOpen)}
          >
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </nav>

      <div className={`mobile-menu ${isOpen ? 'active' : ''}`}>
        <ul>
{navLinks.map(link => (
              <li key={link.id}>
                <button 
                  onClick={() => scrollToSection(link.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Playfair Display', serif", fontSize: '32px', color: 'var(--text-primary)' }}
                >
                  {link.label}
                </button>
              </li>
            ))}
            {user?.email === 'hamzaelsharkh@gmail.com' ? (
              <li><Link to="/admin" onClick={() => setIsOpen(false)}>Dashboard</Link></li>
            ) : user ? (
              <li className="user-menu">
                <span className="user-name">{user.firstName || 'User'}</span>
                <button onClick={handleLogout}>Logout</button>
              </li>
            ) : (
              <li><Link to="/login" onClick={() => setIsOpen(false)}>Login</Link></li>
            )}
          </ul>
        </div>

      <LogoutModal 
        isOpen={showLogoutModal} 
        onConfirm={confirmLogout} 
        onCancel={cancelLogout} 
      />
    </>
  );
}

export default Nav;