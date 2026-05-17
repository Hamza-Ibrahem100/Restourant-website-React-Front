import React, { useRef, useState } from 'react';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { dataService } from '../services/dataService';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMenu } from '../hooks/useFirebaseData';
import '../styles/HomePage.css';

function HomePage() {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('all');
  const [visibleCount, setVisibleCount] = useState(12);

  const menuRef = useRef(null);
  const reservationRef = useRef(null);

  // Use React Query for fetching menu items
  const { data: menuItems = [], isLoading: loading } = useMenu();

  const displayedItems = menuItems
    .filter(i => (activeCategory === 'all' || i.category === activeCategory) && i.is_available !== false && !i.is_hidden)
    .slice(0, visibleCount);

  const loadMoreItems = () => {
    setVisibleCount(prev => prev + 12);
  };

  const handleMenuFilter = (category) => {
    setActiveCategory(category);
    setVisibleCount(12);
  };

  const handleOrder = (itemName, itemPrice) => {
    if (!user) {
      alert("Please sign in to place an order.");
      navigate('/login');
      return;
    }
    addToCart({ name: itemName, price: itemPrice });
    navigate('/cart');
  };

  const handleReservation = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("Please sign in to make a reservation.");
      navigate('/login');
      return;
    }
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
    
    try {
      await dataService.createReservation(reservationData);
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

  const fadeUpVariant = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
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
          <button onClick={() => reservationRef.current?.scrollIntoView({ behavior: 'smooth' })} className="btn-primary">Reserve Your Table</button>
        </div>
      </section>

      <section id="about" className="about">
        <div className="container">
          <div className="about-grid">
            <motion.div 
              className="about-image"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUpVariant}
            >
              <img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80" alt="Food Lover restaurant interior" />
            </motion.div>
            <motion.div 
              className="about-content"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUpVariant}
            >
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
              <div style={{ marginTop: '2.5rem', padding: '1.5rem', background: 'var(--bg-card)', borderLeft: '4px solid var(--primary-accent)', borderRadius: '0 8px 8px 0' }}>
                <h4 style={{ color: 'var(--primary-accent)', marginBottom: '0.5rem', fontSize: '1.2rem' }}>Guest Accounts System</h4>
                <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                  Join our community of over 50,000 guests by creating a personal account. You can seamlessly track your dining history, manage upcoming reservations, and save your culinary preferences for a truly personalized and memorable experience every time you visit.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="menu" ref={menuRef} className="menu">
        <div className="container">
          <div className="section-header">
            <p className="section-tag">Our Menu</p>
            <h2 className="section-title">Culinary Creations</h2>
          </div>
          
          <div className="specials-banner">
            <h3 className="specials-banner-title">🍽️ Tonight's Specials</h3>
            <p className="specials-banner-text">Exclusive dishes available only tonight. Reserve your table now!</p>
            <div className="specials-banner-grid">
              {menuItems.filter(i => i.category === 'specials' && i.is_available !== false && !i.is_hidden).slice(0, 4).map(item => (
                <div key={item.id} className="specials-banner-item">
                  <img src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=80&q=50'} alt={item.name} loading="lazy" className="specials-banner-img" />
                  <div className="specials-banner-info">
                    <div className="specials-banner-name">{item.name}</div>
                    <div className="specials-banner-price">${item.price}</div>
                  </div>
                  <button 
                    onClick={() => { addToCart({ name: item.name, price: item.price }); navigate('/cart'); }}
                    className="specials-banner-btn"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => reservationRef.current?.scrollIntoView({ behavior: 'smooth' })} className="specials-banner-link" style={{background: 'none', border: 'none', cursor: 'pointer'}}>Book a table to enjoy these specials →</button>
          </div>

          <div className="menu-tabs">
            <button className={`menu-tab ${activeCategory==='all'?'active':''}`} onClick={()=>handleMenuFilter('all')}>All</button>
            <button className={`menu-tab ${activeCategory==='starters'?'active':''}`} onClick={()=>handleMenuFilter('starters')}>Starters</button>
            <button className={`menu-tab ${activeCategory==='soups'?'active':''}`} onClick={()=>handleMenuFilter('soups')}>Soups</button>
            <button className={`menu-tab ${activeCategory==='salads'?'active':''}`} onClick={()=>handleMenuFilter('salads')}>Salads</button>
            <button className={`menu-tab ${activeCategory==='mains'?'active':''}`} onClick={()=>handleMenuFilter('mains')}>Mains</button>
            <button className={`menu-tab ${activeCategory==='sides'?'active':''}`} onClick={()=>handleMenuFilter('sides')}>Sides</button>
            <button className={`menu-tab ${activeCategory==='desserts'?'active':''}`} onClick={()=>handleMenuFilter('desserts')}>Desserts</button>
            <button className={`menu-tab ${activeCategory==='drinks'?'active':''}`} onClick={()=>handleMenuFilter('drinks')}>Drinks</button>
            <button className={`menu-tab ${activeCategory==='specials'?'active':''}`} onClick={()=>handleMenuFilter('specials')}>Specials</button>
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
              <div className="empty-category-msg">
                No items in this category.
              </div>
            ) : (
              <>
                {displayedItems.map((item, index) => (
                  <motion.div 
                    key={item.id} 
                    className="menu-card" 
                    data-category={item.category}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="menu-card-image" style={{ background: '#f5f5f5' }}>
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
                  </motion.div>
                ))}
                {menuItems.filter(i => (activeCategory === 'all' || i.category === activeCategory) && i.is_available !== false && !i.is_hidden).length > visibleCount && (
                  <button onClick={loadMoreItems} className="load-more-btn">
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
            {[
              { name: 'Truffle Risotto',   price: 48,  badge: "Chef's Choice", badgeClass: '' },
              { name: 'Wagyu A5 Steak',    price: 125, badge: 'Limited',       badgeClass: 'limited' },
              { name: 'Lobster Thermidor', price: 72,  badge: 'New',           badgeClass: '' },
            ].map(({ name, price, badge, badgeClass }) => (
              <motion.div 
                key={name}
                className="special-card"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUpVariant}
              >
                <span className={`special-badge ${badgeClass}`}>{badge}</span>
                <h4>{name}</h4>
                <p>An exquisite culinary creation for tonight's special.</p>
                <div className="special-price">${price}</div>
                <button className="special-btn" onClick={() => handleOrder(name, price)}>Order Now</button>
              </motion.div>
            ))}
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
            {[
              { type: 'pickup',   label: 'Pickup',  icon: '🍽️', desc: 'Order online and pick up at your convenience. Skip the wait!' },
              { type: 'dine-in',  label: 'Dine In', icon: '🪑', desc: 'Order ahead for your table. Your meal will be ready when you arrive.' },
              { type: 'delivery', label: 'Delivery', icon: '📦', desc: 'Fresh meals delivered to your door within our delivery zone.' },
            ].map(({ type, label, icon, desc }, index) => (
              <motion.div 
                key={type}
                className="order-card"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="order-icon">{icon}</div>
                <h4>{label}</h4>
                <p>{desc}</p>
                <button
                  onClick={() => navigate('/cart', { state: { orderType: type } })}
                  className="special-btn"
                  style={{ background: 'none', border: '1px solid var(--primary-accent)', color: 'var(--primary-accent)', cursor: 'pointer', padding: '8px 16px' }}
                >
                  Start Order
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="events" className="events">
        <div className="container">
          <div className="events-grid">
            <motion.div 
              className="events-image"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <img src="https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=80" alt="Private event dining" />
            </motion.div>
            <motion.div 
              className="events-content"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUpVariant}
            >
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
              <button onClick={() => reservationRef.current?.scrollIntoView({ behavior: 'smooth' })} className="btn-primary">Inquire Now</button>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="chefstable" className="chef-table-section">
        <div className="container">
          <div className="chef-table-content">
            <p className="section-tag" style={{ color: 'var(--primary-accent)' }}>Exclusive Experience</p>
            <h2 className="chef-table-title">Chef's Table</h2>
            <p className="chef-table-desc">
              Tonight's Special tasting menu - An exclusive 7-course culinary journey crafted by our executive chef. 
              Limited seats available for this intimate dining experience.
            </p>
            <div className="chef-table-stats">
              <div className="chef-table-stat-card">
                <div className="chef-table-stat-label">Price per person</div>
                <div className="chef-table-stat-value">$150</div>
              </div>
              <div className="chef-table-stat-card">
                <div className="chef-table-stat-label">Courses</div>
                <div className="chef-table-stat-value">7 Course</div>
              </div>
              <div className="chef-table-stat-card">
                <div className="chef-table-stat-label">Availability</div>
                <div className="chef-table-stat-value limited">Limited</div>
              </div>
            </div>
            <button 
              onClick={() => {
                const reqField = document.getElementById('requests');
                if (reqField) reqField.value = 'Chef\'s Table Reservation Request - 7-course tasting menu for ' + (document.getElementById('party')?.value || '2') + ' guests';
                reservationRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="chef-table-btn"
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
            {[
              "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80",
              "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80",
              "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=600&q=80",
              "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80",
              "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=600&q=80",
              "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80"
            ].map((img, index) => (
              <motion.div 
                key={index}
                className="gallery-item"
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <img src={img} alt={`Gallery item ${index}`} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="reservation" ref={reservationRef} className="reservation">
        <div className="container">
          <div className="section-header">
            <p className="section-tag">Reservations</p>
            <h2 className="section-title">Book Your Table</h2>
          </div>
          <motion.form 
            id="reservation-form" 
            className="reservation-form" 
            onSubmit={handleReservation}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUpVariant}
          >
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
          </motion.form>
        </div>
      </section>

      <Footer />
    </>
  );
}

export default HomePage;
