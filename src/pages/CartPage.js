import React, { useState, useEffect } from 'react';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { push, ref, get } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/CartPage.css';

function CartPage() {
  const { cart, removeFromCart, updateQuantity, clearCart, cartTotal, cartCount } = useCart();
  const { user } = useAuth();
  
  // Checkout State
  const [orderType, setOrderType] = useState('pickup');
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', tableNumber: '' });
  const [address, setAddress] = useState({ street: '', city: '', zip: '' });
  const [paymentMethod, setPaymentMethod] = useState('credit_card');
  const [tipPercentage, setTipPercentage] = useState(15);
  
  const [errors, setErrors] = useState({});
  const [placingOrder, setPlacingOrder] = useState(false);
  const navigate = useNavigate();

  // Load user data
  useEffect(() => {
    const fetchCustomerInfo = async () => {
      if (user?.email) {
        try {
          const snapshot = await get(ref(db, 'users'));
          const data = snapshot.val();
          if (data) {
            const userData = Object.values(data).find(u => u.email?.toLowerCase() === user.email.toLowerCase());
            if (userData) {
              setCustomerInfo(prev => ({
                ...prev,
                name: userData.name || '',
                phone: userData.phone || ''
              }));
              if (userData.address) {
                // simple parsing if address is a single string from previous features
                setAddress({ street: userData.address, city: '', zip: '' });
              }
            }
          }
        } catch (error) {
          console.error('Error fetching customer info:', error);
        }
      }
    };
    fetchCustomerInfo();
  }, [user]);

  // Calculations
  const subtotal = cartTotal;
  const taxRate = 0.08;
  const tax = subtotal * taxRate;
  const deliveryFee = orderType === 'delivery' ? 5.00 : 0;
  const tipAmount = (subtotal * tipPercentage) / 100;
  const finalTotal = subtotal + tax + deliveryFee + tipAmount;

  const handleQuantityChange = (name, delta) => {
    const item = cart.find(i => i.name === name);
    if (item) {
      if (item.quantity + delta > 0) {
        updateQuantity(name, item.quantity + delta);
      } else {
        removeFromCart(name);
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!customerInfo.name.trim()) newErrors.name = 'Name is required';
    if (!customerInfo.phone.trim()) newErrors.phone = 'Phone number is required';
    
    if (orderType === 'dine-in' && !customerInfo.tableNumber) {
      newErrors.tableNumber = 'Table number is required for Dine In';
    }
    
    if (orderType === 'delivery') {
      if (!address.street.trim()) newErrors.street = 'Street address is required';
      if (!address.city.trim()) newErrors.city = 'City is required';
      if (!address.zip.trim()) newErrors.zip = 'ZIP code is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCheckout = async () => {
    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (cart.length === 0) return;

    setPlacingOrder(true);
    
    try {
      const orderData = {
        customerName: customerInfo.name,
        phone: customerInfo.phone,
        email: user?.email || null,
        orderType: orderType,
        tableNumber: orderType === 'dine-in' ? customerInfo.tableNumber : null,
        deliveryAddress: orderType === 'delivery' ? address : null,
        items: cart.map(item => ({
          name: item.name,
          price: Number(item.price),
          quantity: Number(item.quantity)
        })),
        financials: {
          subtotal: Number(subtotal.toFixed(2)),
          tax: Number(tax.toFixed(2)),
          deliveryFee: Number(deliveryFee.toFixed(2)),
          tip: Number(tipAmount.toFixed(2)),
          total: Number(finalTotal.toFixed(2))
        },
        paymentMethod: paymentMethod,
        status: 'pending',
        createdAt: Date.now()
      };
      
      await push(ref(db, 'orders'), orderData);
      
      alert('Order placed successfully! We will confirm via email shortly.');
      clearCart();
      navigate('/');
    } catch (error) {
      console.error('Error placing order:', error);
      alert(error.code === 'PERMISSION_DENIED' ? 'Unable to save order. Please log in.' : 'Failed to place order.');
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <>
      <Nav />
      <div className="cart-page-container">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 className="cart-header">Checkout</h1>

          {cart.length === 0 ? (
            <div className="empty-cart">
              <p style={{ fontSize: '18px', marginBottom: '24px', color: 'var(--text-secondary)' }}>
                Your cart is empty
              </p>
              <button onClick={() => navigate('/#menu')} className="checkout-btn" style={{ maxWidth: '200px' }}>
                Browse Menu
              </button>
            </div>
          ) : (
            <div className="cart-grid">
              
              {/* Left Column: Details & Items */}
              <div className="checkout-details">
                
                {/* Order Type Selection */}
                <div className="cart-section">
                  <h2 className="cart-section-title">Order Type</h2>
                  <div className="order-type-grid">
                    {['pickup', 'dine-in', 'delivery'].map(type => (
                      <button
                        key={type}
                        onClick={() => setOrderType(type)}
                        className={`order-type-btn ${orderType === type ? 'active' : 'inactive'}`}
                      >
                        <span style={{ fontSize: '24px' }}>
                          {type === 'pickup' ? '🛍️' : type === 'dine-in' ? '🍽️' : '🛵'}
                        </span>
                        {type === 'dine-in' ? 'Dine In' : type === 'pickup' ? 'Pickup' : 'Delivery'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer Info Form */}
                <div className="cart-section">
                  <h2 className="cart-section-title">Contact Information</h2>
                  <div className="form-grid">
                    <div>
                      <input
                        type="text"
                        placeholder="Full Name *"
                        className={`form-input ${errors.name ? 'error' : ''}`}
                        value={customerInfo.name}
                        onChange={(e) => { setCustomerInfo({...customerInfo, name: e.target.value}); setErrors({...errors, name: null}); }}
                      />
                      {errors.name && <span className="error-text">{errors.name}</span>}
                    </div>
                    <div>
                      <input
                        type="tel"
                        placeholder="Phone Number *"
                        className={`form-input ${errors.phone ? 'error' : ''}`}
                        value={customerInfo.phone}
                        onChange={(e) => { setCustomerInfo({...customerInfo, phone: e.target.value}); setErrors({...errors, phone: null}); }}
                      />
                      {errors.phone && <span className="error-text">{errors.phone}</span>}
                    </div>

                    <AnimatePresence>
                      {orderType === 'dine-in' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <input
                            type="number"
                            placeholder="Table Number *"
                            className={`form-input ${errors.tableNumber ? 'error' : ''}`}
                            value={customerInfo.tableNumber}
                            onChange={(e) => { setCustomerInfo({...customerInfo, tableNumber: e.target.value}); setErrors({...errors, tableNumber: null}); }}
                          />
                          {errors.tableNumber && <span className="error-text">{errors.tableNumber}</span>}
                        </motion.div>
                      )}
                      
                      {orderType === 'delivery' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          style={{ display: 'grid', gap: '16px', overflow: 'hidden' }}
                        >
                          <div>
                            <input
                              type="text"
                              placeholder="Street Address *"
                              className={`form-input ${errors.street ? 'error' : ''}`}
                              value={address.street}
                              onChange={(e) => { setAddress({...address, street: e.target.value}); setErrors({...errors, street: null}); }}
                            />
                            {errors.street && <span className="error-text">{errors.street}</span>}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                            <div>
                              <input
                                type="text"
                                placeholder="City *"
                                className={`form-input ${errors.city ? 'error' : ''}`}
                                value={address.city}
                                onChange={(e) => { setAddress({...address, city: e.target.value}); setErrors({...errors, city: null}); }}
                              />
                              {errors.city && <span className="error-text">{errors.city}</span>}
                            </div>
                            <div>
                              <input
                                type="text"
                                placeholder="ZIP *"
                                className={`form-input ${errors.zip ? 'error' : ''}`}
                                value={address.zip}
                                onChange={(e) => { setAddress({...address, zip: e.target.value}); setErrors({...errors, zip: null}); }}
                              />
                              {errors.zip && <span className="error-text">{errors.zip}</span>}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Cart Items */}
                <div className="cart-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 className="cart-section-title" style={{ margin: 0 }}>Order Items</h2>
                    <button onClick={clearCart} className="btn-secondary">Clear Cart</button>
                  </div>
                  <div>
                    {cart.map((item) => (
                      <div key={item.name} className="cart-item">
                        <div className="cart-item-info">
                          <h3>{item.name}</h3>
                          <p className="cart-item-price">${item.price.toFixed(2)}</p>
                        </div>
                        <div className="quantity-controls">
                          <button className="qty-btn" onClick={() => handleQuantityChange(item.name, -1)}>−</button>
                          <span className="qty-value">{item.quantity}</span>
                          <button className="qty-btn" onClick={() => handleQuantityChange(item.name, 1)}>+</button>
                          <span className="item-total">${(item.price * item.quantity).toFixed(2)}</span>
                          <button className="remove-btn" onClick={() => removeFromCart(item.name)}>🗑</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Mock */}
                <div className="cart-section">
                  <h2 className="cart-section-title">Payment Method</h2>
                  <div className="payment-methods">
                    <label className={`payment-option ${paymentMethod === 'credit_card' ? 'selected' : ''}`}>
                      <input type="radio" name="payment" value="credit_card" checked={paymentMethod === 'credit_card'} onChange={() => setPaymentMethod('credit_card')} />
                      <span>Credit Card</span>
                    </label>
                    
                    <AnimatePresence>
                      {paymentMethod === 'credit_card' && (
                        <motion.div 
                          className="credit-card-form"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <div className="form-grid">
                            <input type="text" placeholder="Card Number (Mock)" className="form-input" maxLength="19" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                              <input type="text" placeholder="MM/YY" className="form-input" maxLength="5" />
                              <input type="text" placeholder="CVC" className="form-input" maxLength="4" />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <label className={`payment-option ${paymentMethod === 'apple_pay' ? 'selected' : ''}`}>
                      <input type="radio" name="payment" value="apple_pay" checked={paymentMethod === 'apple_pay'} onChange={() => setPaymentMethod('apple_pay')} />
                      <span>Apple Pay / Google Pay</span>
                    </label>

                    <label className={`payment-option ${paymentMethod === 'cash' ? 'selected' : ''}`}>
                      <input type="radio" name="payment" value="cash" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} />
                      <span>{orderType === 'delivery' ? 'Cash on Delivery' : 'Pay at Counter'}</span>
                    </label>
                  </div>
                </div>

              </div>

              {/* Right Column: Summary */}
              <div>
                <div className="cart-section summary-sidebar">
                  <h2 className="cart-section-title">Order Summary</h2>
                  
                  <div className="summary-row">
                    <span>Subtotal ({cartCount} items)</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Tax (8%)</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                  {orderType === 'delivery' && (
                    <div className="summary-row">
                      <span>Delivery Fee</span>
                      <span>${deliveryFee.toFixed(2)}</span>
                    </div>
                  )}

                  <div style={{ marginTop: '20px', borderTop: '1px solid var(--secondary-accent)', paddingTop: '20px' }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Add Tip</span>
                    <div className="tip-selector">
                      {[10, 15, 20, 25].map(pct => (
                        <button 
                          key={pct}
                          className={`tip-btn ${tipPercentage === pct ? 'active' : ''}`}
                          onClick={() => setTipPercentage(pct)}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                    <div className="summary-row">
                      <span>Tip</span>
                      <span>${tipAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="summary-row total">
                    <span>Total</span>
                    <span>${finalTotal.toFixed(2)}</span>
                  </div>

                  <button 
                    className="checkout-btn"
                    onClick={handleCheckout}
                    disabled={placingOrder}
                  >
                    {placingOrder ? 'Processing...' : `Place Order • $${finalTotal.toFixed(2)}`}
                  </button>
                  <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '16px' }}>
                    By placing your order, you agree to our Terms of Service and Privacy Policy.
                  </p>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}

export default CartPage;