import React from 'react';

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-about">
            <div className="footer-logo">Food Lover</div>
            <p className="footer-desc">An upscale dining experience where culinary artistry meets warm hospitality.</p>
            <div className="social-links">
              <a href="#" aria-label="Instagram">IG</a>
              <a href="#" aria-label="Facebook">FB</a>
              <a href="#" aria-label="Twitter">TW</a>
            </div>
          </div>
          <div className="footer-hours">
            <h4>Hours</h4>
            <ul>
              <li>Mon - Thu: 5pm - 10pm</li>
              <li>Fri - Sat: 5pm - 11pm</li>
              <li>Sun: 4pm - 9pm</li>
            </ul>
          </div>
          <div className="footer-contact">
            <h4>Contact</h4>
            <ul>
              <li>123 Culinary Lane</li>
              <li>New York, NY 10001</li>
              <li>(212) 555-0187</li>
              <li>hello@foodlover.com</li>
            </ul>
          </div>
          <div className="footer-admin">
            <h4>Restaurant Management</h4>
            <ul>
              <li style={{ fontSize: '14px', opacity: 0.8 }}>For dashboard access:</li>
              <li style={{ fontWeight: '600', color: 'var(--primary-accent)' }}>hamzaelsharkh@gmail.com</li>
            </ul>
          </div>
          <div className="footer-links">
            <h4>Links</h4>
            <ul>
              <li><a href="#about" style={{color:'inherit',textDecoration:'none'}}>About Us</a></li>
              <li><a href="#menu" style={{color:'inherit',textDecoration:'none'}}>Menu</a></li>
              <li><a href="#gallery" style={{color:'inherit',textDecoration:'none'}}>Gallery</a></li>
              <li><a href="#reservation" style={{color:'inherit',textDecoration:'none'}}>Reservations</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 Food Lover. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;