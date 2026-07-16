import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();
  const sidebarRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isOpen && sidebarRef.current && !sidebarRef.current.contains(e.target) && !e.target.closest('.hamburger')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close sidebar on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

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
    { id: 'about', label: 'About', icon: '✦' },
    { id: 'menu', label: 'Menu', icon: '🍽' },
    { id: 'specials', label: 'Specials', icon: '⭐' },
    { id: 'ordering', label: 'Order', icon: '📦' },
    { id: 'events', label: 'Events', icon: '🎉' },
    { id: 'gallery', label: 'Gallery', icon: '📸' },
    { id: 'reservation', label: 'Reserve', icon: '📅' }
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
            {user?.isAdmin && (
              <li>
                <Link to="/admin" style={{ color: '#d4a574', fontWeight: 'bold' }}>Dashboard</Link>
              </li>
            )}
            {user ? (
              <li className="user-menu">
                <span className="user-name">
                  {user.firstName || 'User'}
                  {process.env.REACT_APP_DEMO_EMAIL && user.email?.toLowerCase() === process.env.REACT_APP_DEMO_EMAIL.toLowerCase() && (
                    <span style={{ marginLeft: '10px', padding: '4px 8px', background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #2ecc71' }}>🟢 READ ONLY</span>
                  )}
                </span>
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

      {/* Sidebar Overlay */}
      <div className={`sidebar-overlay ${isOpen ? 'active' : ''}`} />

      {/* Premium Sidebar */}
      <div ref={sidebarRef} className={`sidebar ${isOpen ? 'active' : ''}`}>
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <Link to="/" className="sidebar-logo" onClick={() => setIsOpen(false)}>
            Food Lover
          </Link>
          <button className="sidebar-close" onClick={() => setIsOpen(false)}>
            ✕
          </button>
        </div>

        {/* Sidebar Divider */}
        <div className="sidebar-divider" />

        {/* User Info */}
        {user && (
          <>
            <div className="sidebar-user">
              <div className="sidebar-user-avatar">
                {(user.firstName || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {user.firstName || 'User'} {user.lastName || ''}
                  {process.env.REACT_APP_DEMO_EMAIL && user.email?.toLowerCase() === process.env.REACT_APP_DEMO_EMAIL.toLowerCase() && (
                    <span style={{ padding: '2px 6px', background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', border: '1px solid #2ecc71' }}>🟢 READ ONLY</span>
                  )}
                </span>
                <span className="sidebar-user-email">{user.email}</span>
              </div>
            </div>
            <div className="sidebar-divider" />
          </>
        )}

        {/* Navigation Links */}
        <ul className="sidebar-nav">
          {navLinks.map((link, index) => (
            <li key={link.id} style={{ animationDelay: `${0.05 * index}s` }}>
              <button onClick={() => scrollToSection(link.id)}>
                <span className="sidebar-nav-icon">{link.icon}</span>
                <span className="sidebar-nav-label">{link.label}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="sidebar-divider" />

        {/* Quick Actions */}
        <div className="sidebar-actions">
          <button className="sidebar-action-btn cart-btn" onClick={() => { setIsOpen(false); navigate('/cart'); }}>
            <span>🛒</span>
            <span>Cart</span>
            {cartCount > 0 && <span className="sidebar-cart-badge">{cartCount}</span>}
          </button>

          {user?.isAdmin && (
            <Link to="/admin" className="sidebar-action-btn dashboard-btn" onClick={() => setIsOpen(false)}>
              <span>📊</span>
              <span>Dashboard</span>
            </Link>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          {user ? (
            <button className="sidebar-footer-btn logout" onClick={handleLogout}>
              Sign Out
            </button>
          ) : (
            <Link to="/login" className="sidebar-footer-btn login" onClick={() => setIsOpen(false)}>
              Sign In
            </Link>
          )}
          <p className="sidebar-copyright">© 2025 Food Lover</p>
        </div>
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