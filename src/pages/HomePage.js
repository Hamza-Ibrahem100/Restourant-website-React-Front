import React, { useEffect, useRef, useState } from 'react';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { db } from '../firebase';
import { ref, get, push, onValue } from 'firebase/database';
import { useNavigate } from 'react-router-dom';

function HomePage() {
  const menuCardsRef = useRef([]);
  const galleryItemsRef = useRef([]);
  const specialsRef = useRef([]);
  const ordersRef = useRef([]);
  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('all');
// Real-time menu items from Firestore (admin CRUD will update these as well)
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadedImages, setLoadedImages] = useState({});
  const [visibleCount, setVisibleCount] = useState(12);
  const [menuPage, setMenuPage] = useState(1);

  const handleImageLoad = (id) => {
    setLoadedImages(prev => ({ ...prev, [id]: true }));
  };

  const displayedItems = menuItems
    .filter(i => (activeCategory === 'all' || i.category === activeCategory) && i.is_available !== false && !i.is_hidden)
    .slice(0, visibleCount);

  const loadMoreItems = () => {
    setVisibleCount(prev => prev + 12);
  };

  useEffect(() => {
    menuItems.slice(0, visibleCount).forEach(item => {
      if (item.image) {
        const img = new Image();
        img.src = item.image;
      }
    });
  }, [menuItems]);

  useEffect(() => {
    setVisibleCount(12);
  }, [activeCategory]);

  useEffect(() => {
    const observerOptions = { threshold: 0.1 };
    
    const fadeObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, observerOptions);

    document.querySelectorAll('.fade-in').forEach(el => fadeObserver.observe(el));

    const menuCards = document.querySelectorAll('.menu-card');
    menuCards.forEach((card, index) => {
      setTimeout(() => card.classList.add('visible'), index * 100);
    });

    const galleryItems = document.querySelectorAll('.gallery-item');
    galleryItems.forEach((item, index) => {
      setTimeout(() => item.classList.add('visible'), index * 100);
    });

    const specialsCards = document.querySelectorAll('.special-card');
    specialsCards.forEach((card, index) => {
      setTimeout(() => card.classList.add('visible'), index * 100);
    });

    const orderCards = document.querySelectorAll('.order-card');
    orderCards.forEach((card, index) => {
      setTimeout(() => card.classList.add('visible'), index * 100);
    });

    return () => fadeObserver.disconnect();
  }, []);

// Real-time fetch of menu items from Firebase Firestore only
  useEffect(() => {
    const MENU_CACHE_KEY = 'foodlover_menu_cache';
    const CACHE_EXPIRY = 1000 * 60 * 30; // 30 minutes

    // Load cached data instantly first
    const cachedData = localStorage.getItem(MENU_CACHE_KEY);
    if (cachedData) {
      const { items, timestamp } = JSON.parse(cachedData);
      if (Date.now() - timestamp < CACHE_EXPIRY && items.length > 0) {
        setMenuItems(items);
        setLoading(false);
      }
    }

    // Then fetch fresh data from RTDB
    setLoading(true);
    const menuRef = ref(db, 'menu');
    const unsubscribe = onValue(menuRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const items = Object.entries(data).map(([id, value]) => ({ id, ...value }));
        console.log('Fetching menu items from RTDB:', items.length);
        setMenuItems(items);
        localStorage.setItem(MENU_CACHE_KEY, JSON.stringify({
          items,
          timestamp: Date.now()
        }));
      } else {
        setMenuItems([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("RTDB Error:", error);
      setMenuItems([]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleMenuFilter = (category) => {
    setActiveCategory(category);
  };

  const handleOrder = (itemName) => {
    alert(`${itemName} added to your order! Check our menu to complete your order.`);
    document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleReservation = async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('.form-submit');
    btn.textContent = 'Saving...';
    
    const reservationData = {
      name: form.name.value,
      email: form.email.value,
      phone: form.phone.value,
      party: parseInt(form.party.value),
      date: form.date.value,
      time: form.time.value,
      requests: form.requests.value || '',
      status: 'pending',
      createdAt: Date.now()
    };
    
    console.log('Saving reservation:', reservationData);
    
    try {
      const resRef = await push(ref(db, 'reservations'), reservationData);
      console.log('Reservation saved with ID:', resRef.key);
      btn.textContent = 'Success!';
      alert('Reservation request submitted! We will confirm via email.');
      form.reset();
      if (user) {
        form.name.value = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        form.email.value = user.email || '';
      }
    } catch (error) {
      console.error('Error:', error);
      let errorMessage = 'Failed to submit reservation. Please try again.';
      if (error.code === 'PERMISSION_DENIED') {
        errorMessage = 'Unable to save reservation. Please make sure you are logged in or try again.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      alert(errorMessage);
      btn.textContent = 'Error! Try again';
    }
  };

  return (
    <>
      <Nav />
      
      <section className="hero animated">
        <div className="hero-bg"></div>
        <div className="hero-content">
          <p className="hero-tag">Welcome to Food Lover</p>
          <h1 className="hero-title">
            <span className="word">Refined</span>
            <span className="word">Dining</span>
          </h1>
          <p className="hero-subtitle">Experience culinary artistry in an atmosphere of timeless elegance. Where every meal becomes a cherished memory.</p>
          <a href="#reservation" className="btn-primary">Reserve Your Table</a>
        </div>
      </section>

      <section id="about" className="about">
        <div className="container">
          <div className="about-grid">
            <div className="about-image fade-in">
              <img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80" alt="Food Lover restaurant interior" />
            </div>
            <div className="about-content fade-in">
              <p className="section-tag">Our Story</p>
              <h3>A Legacy of Culinary Excellence</h3>
              <p>Since 2010, Food Lover has been the heart of fine dining in our community. Our chef combines traditional techniques with modern innovation to create dishes that tell a story.</p>
              <p>Every ingredient is carefully sourced from local farms and artisan producers, ensuring freshness and sustainability in every bite.</p>
              <div className="about-stats">
                <div className="stat">
                  <div className="stat-number">15+</div>
                  <div className="stat-label">Years</div>
                </div>
                <div className="stat">
                  <div className="stat-number">50K</div>
                  <div className="stat-label">Guests</div>
                </div>
                <div className="stat">
                  <div className="stat-number">3</div>
                  <div className="stat-label">Awards</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="menu" className="menu">
        <div className="container">
          <div className="section-header">
            <p className="section-tag">Our Menu</p>
            <h2 className="section-title">Culinary Creations</h2>
          </div>
          
          <div style={{ background: 'linear-gradient(135deg, #D4A574 0%, #8B5A2B 100%)', padding: '30px', borderRadius: '12px', marginBottom: '30px', textAlign: 'center' }}>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '32px', color: 'var(--bg-dark)', marginBottom: '10px' }}>🍽️ Tonight's Specials</h3>
            <p style={{ color: 'var(--bg-dark)', opacity: 0.9, marginBottom: '20px', fontSize: '16px' }}>Exclusive dishes available only tonight. Reserve your table now!</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
              {menuItems.filter(i => i.category === 'specials' && i.is_available !== false && !i.is_hidden).slice(0, 4).map(item => (
                <div key={item.id} style={{ background: 'rgba(255,255,255,0.9)', padding: '15px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '15px', minWidth: '250px' }}>
                  <img src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=80&q=50'} alt={item.name} loading="lazy" style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', background: '#f0f0f0' }} />
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontWeight: '600', color: 'var(--bg-dark)', fontSize: '14px' }}>{item.name}</div>
                    <div style={{ color: '#D4A574', fontWeight: '700' }}>${item.price}</div>
                  </div>
                  <button 
                    onClick={() => { addToCart({ name: item.name, price: item.price }); navigate('/cart'); }}
                    style={{ background: '#D4A574', color: 'var(--bg-dark)', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
            <a href="#reservation" style={{ display: 'inline-block', marginTop: '20px', color: 'var(--bg-dark)', fontWeight: '600', textDecoration: 'underline' }}>Book a table to enjoy these specials →</a>
          </div>

          <div className="menu-tabs">
            <button className={`menu-tab ${activeCategory==='all'?'active':''}`} onClick={()=>setActiveCategory('all')}>All</button>
<button className={`menu-tab ${activeCategory==='starters'?'active':''}`} onClick={()=>setActiveCategory('starters')}>Starters</button>
            <button className={`menu-tab ${activeCategory==='mains'?'active':''}`} onClick={()=>setActiveCategory('mains')}>Mains</button>
            <button className={`menu-tab ${activeCategory==='specials'?'active':''}`} onClick={()=>setActiveCategory('specials')}>Specials</button>
            <button className={`menu-tab ${activeCategory==='desserts'?'active':''}`} onClick={()=>setActiveCategory('desserts')}>Desserts</button>
            <button className={`menu-tab ${activeCategory==='drinks'?'active':''}`} onClick={()=>setActiveCategory('drinks')}>Drinks</button>
          </div>
<div className="menu-grid">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="menu-card skeleton-card">
                  <div className="skeleton-image pulse"></div>
                  <div className="menu-card-content">
                    <div className="skeleton-text pulse short"></div>
                    <div className="skeleton-text pulse long"></div>
                    <div className="skeleton-button pulse"></div>
                  </div>
                </div>
              ))
) : displayedItems.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No items in this category.
              </div>
            ) : (
              <>
                {displayedItems.map(item => (
                  <div key={item.id} className="menu-card visible" data-category={item.category}>
                    <div className="menu-card-image" style={{ background: '#f5f5f5', minHeight: '200px' }}>
                      {item.image ? (
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          loading="lazy"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=400&q=60';
                          }}
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
                          <span style={{ fontSize: '14px' }}>No Image</span>
                        </div>
                      )}
                    </div>
                    <div className="menu-card-content">
                      <div className="menu-card-header">
                        <h4 className="menu-card-title">{item.name}</h4>
                        <span className="menu-card-price">${item.price}</span>
                      </div>
                      <p className="menu-card-desc">{item.description || ''}</p>
                      <button className="menu-order-btn" onClick={() => { addToCart({ name: item.name, price: item.price }); navigate('/cart'); }}>Add to Order</button>
                    </div>
                  </div>
                ))}
                {menuItems.filter(i => (activeCategory === 'all' || i.category === activeCategory) && i.is_available !== false && !i.is_hidden).length > visibleCount && (
                  <button 
                    onClick={loadMoreItems}
                    style={{ gridColumn: '1 / -1', padding: '20px', background: 'var(--bg-card)', border: '2px solid var(--primary-accent)', color: 'var(--primary-accent)', cursor: 'pointer', fontSize: '16px', fontWeight: '600', marginTop: '20px' }}
                  >
                    Load More Items ({menuItems.filter(i => (activeCategory === 'all' || i.category === activeCategory) && i.is_available !== false && !i.is_hidden).length - visibleCount} more)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <section id="specials" className="specials">
        <div className="container">
          <div className="section-header">
            <p className="section-tag">Chef's Table</p>
            <h2 className="section-title">Tonight's Specials</h2>
          </div>
          <div className="specials-grid">
            <div className="special-card">
              <span className="special-badge">Chef's Choice</span>
              <h4>Truffle Risotto</h4>
              <p>Wild foraged mushrooms, black truffle, aged parmesan, fresh herbs</p>
              <div className="special-price">$48</div>
              <button className="special-btn" onClick={() => handleOrder('Truffle Risotto')}>Order Now</button>
            </div>
            <div className="special-card">
              <span className="special-badge limited">Limited</span>
              <h4>Wagyu A5 Steak</h4>
              <p>Japanese A5 wagyu, charred onion, red wine reduction, seasonal greens</p>
              <div className="special-price">$125</div>
              <button className="special-btn" onClick={() => handleOrder('Wagyu A5 Steak')}>Order Now</button>
            </div>
            <div className="special-card">
              <span className="special-badge">New</span>
              <h4>Lobster Thermidor</h4>
              <p>Maine lobster, cognac cream, gruyere, roasted fingerling potatoes</p>
              <div className="special-price">$72</div>
              <button className="special-btn" onClick={() => handleOrder('Lobster Thermidor')}>Order Now</button>
            </div>
          </div>
        </div>
      </section>

      <section id="ordering" className="ordering">
        <div className="container">
          <div className="section-header">
            <p className="section-tag">Convenience</p>
            <h2 className="section-title">Order Online</h2>
          </div>
          <div className="ordering-grid">
            <div className="order-card">
              <div className="order-icon">🍽️</div>
              <h4>Pickup</h4>
              <p>Order online and pick up at your convenience. Skip the wait!</p>
              <a href="#menu" className="special-btn">Start Order</a>
            </div>
            <div className="order-card">
              <div className="order-icon">🚗</div>
              <h4>Curbside</h4>
              <p>We bring your order right to your car. Just pull up and we'll deliver.</p>
              <a href="#menu" className="special-btn">Start Order</a>
            </div>
            <div className="order-card">
              <div className="order-icon">📦</div>
              <h4>Delivery</h4>
              <p>Fresh meals delivered to your door within our delivery zone.</p>
              <a href="#menu" className="special-btn">Start Order</a>
            </div>
          </div>
        </div>
      </section>

      <section id="events" className="events">
        <div className="container">
          <div className="events-grid">
            <div className="events-image fade-in">
              <img src="https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=80" alt="Private event dining" />
            </div>
            <div className="events-content fade-in">
              <p className="section-tag">Private Dining</p>
              <h3>Host Your Event With Us</h3>
              <p>Celebrate life's special moments in an intimate setting. Our private dining room is perfect for anniversary dinners, business gatherings, birthday celebrations, and more.</p>
              <ul className="event-features">
                <li>Private room seating up to 20 guests</li>
                <li>Custom menu curated by our chef</li>
                <li>Dedicated event coordinator</li>
                <li>Flexible seating arrangements</li>
                <li>AV equipment available</li>
              </ul>
              <a href="#reservation" className="btn-primary">Inquire Now</a>
            </div>
          </div>
        </div>
      </section>

      <section id="chefstable" className="chef-table" style={{ background: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url(https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80)', backgroundSize: 'cover', backgroundPosition: 'center', padding: '100px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
            <p className="section-tag" style={{ color: 'var(--primary-accent)' }}>Exclusive Experience</p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '48px', color: 'white', marginBottom: '20px' }}>Chef's Table</h2>
            <p style={{ fontSize: '20px', color: '#ddd', marginBottom: '30px', lineHeight: '1.6' }}>
              Tonight's Special tasting menu - An exclusive 7-course culinary journey crafted by our executive chef. 
              Limited seats available for this intimate dining experience.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
              <div style={{ background: 'rgba(212,165,116,0.2)', padding: '20px 30px', borderRadius: '8px', border: '1px solid var(--primary-accent)' }}>
                <div style={{ fontSize: '14px', color: '#aaa' }}>Price per person</div>
                <div style={{ fontSize: '28px', color: 'var(--primary-accent)', fontWeight: '600' }}>$150</div>
              </div>
              <div style={{ background: 'rgba(212,165,116,0.2)', padding: '20px 30px', borderRadius: '8px', border: '1px solid var(--primary-accent)' }}>
                <div style={{ fontSize: '14px', color: '#aaa' }}>Courses</div>
                <div style={{ fontSize: '28px', color: 'var(--primary-accent)', fontWeight: '600' }}>7 Course</div>
              </div>
              <div style={{ background: 'rgba(212,165,116,0.2)', padding: '20px 30px', borderRadius: '8px', border: '1px solid var(--primary-accent)' }}>
                <div style={{ fontSize: '14px', color: '#aaa' }}>Availability</div>
                <div style={{ fontSize: '28px', color: '#e74c3c', fontWeight: '600' }}>Limited</div>
              </div>
            </div>
            <button 
              onClick={() => {
                const form = document.getElementById('reservation-form');
                if (form) {
                  document.getElementById('requests').value = 'Chef\'s Table Reservation Request - 7-course tasting menu for ' + (document.getElementById('party')?.value || '2') + ' guests';
                  form.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              style={{ padding: '16px 40px', background: 'var(--primary-accent)', color: 'var(--bg-dark)', border: 'none', borderRadius: '4px', fontSize: '18px', fontWeight: '600', cursor: 'pointer' }}
            >
              Reserve Your Spot
            </button>
          </div>
        </div>
      </section>

      <section id="gallery" className="gallery">
        <div className="container">
          <div className="section-header">
            <p className="section-tag">Gallery</p>
            <h2 className="section-title">Our Space</h2>
          </div>
          <div className="gallery-grid">
            <div className="gallery-item">
              <img src="https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80" alt="Restaurant interior" />
            </div>
            <div className="gallery-item">
              <img src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80" alt="Dining table" />
            </div>
            <div className="gallery-item">
              <img src="https://images.unsplash.com/photo-1552566626-52f8b828add9?w=600&q=80" alt="Chef cooking" />
            </div>
            <div className="gallery-item">
              <img src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80" alt="Plated dish" />
            </div>
            <div className="gallery-item">
              <img src="https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=600&q=80" alt="Bar" />
            </div>
            <div className="gallery-item">
              <img src="https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80" alt="Outdoor dining" />
            </div>
          </div>
        </div>
      </section>

      <section id="reservation" className="reservation">
        <div className="container">
          <div className="section-header">
            <p className="section-tag">Reservations</p>
            <h2 className="section-title">Book Your Table</h2>
          </div>
          <form id="reservation-form" className="reservation-form fade-in" onSubmit={handleReservation}>
            <div className="form-row">
              <div className="form-group">
                <input type="text" id="name" required placeholder=" " defaultValue={user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : ''} />
                <label htmlFor="name">Your Name</label>
              </div>
              <div className="form-group">
                <input type="email" id="email" required placeholder=" " defaultValue={user?.email || ''} readOnly={!!user} />
                <label htmlFor="email">Email Address</label>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <input type="tel" id="phone" required placeholder=" " />
                <label htmlFor="phone">Phone Number</label>
              </div>
              <div className="form-group">
                <input type="number" id="party" min="1" max="12" required placeholder=" " />
                <label htmlFor="party">Party Size</label>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <input type="date" id="date" required placeholder=" " />
                <label htmlFor="date">Date</label>
              </div>
              <div className="form-group">
                <input type="time" id="time" required placeholder=" " />
                <label htmlFor="time">Time</label>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group full-width">
                <input type="text" id="requests" placeholder=" " />
                <label htmlFor="requests">Special Requests (Optional)</label>
              </div>
            </div>
            <button type="submit" className="form-submit">Request Reservation</button>
          </form>
        </div>
      </section>

      <Footer />
    </>
  );
}

export default HomePage;
