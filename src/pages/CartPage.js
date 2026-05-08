import React, { useState, useEffect } from 'react';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { push, ref, get } from 'firebase/database';
import { useNavigate } from 'react-router-dom';

function CartPage() {
  const { cart, removeFromCart, updateQuantity, clearCart, cartTotal, cartCount } = useCart();
  const { user } = useAuth();
  const [orderType, setOrderType] = useState('pickup');
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', tableNumber: '' });
  const [placingOrder, setPlacingOrder] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCustomerInfo = async () => {
      if (user?.email) {
        try {
          const usersRef = ref(db, 'users');
          const snapshot = await get(usersRef);
          const data = snapshot.val();
          if (data) {
            const userData = Object.values(data).find(u => u.email?.toLowerCase() === user.email.toLowerCase());
            if (userData) {
              setCustomerInfo({
                name: userData.name || '',
                phone: userData.phone || '',
                tableNumber: ''
              });
            }
          }
        } catch (error) {
          console.error('Error fetching customer info:', error);
        }
      }
    };
    fetchCustomerInfo();
  }, [user]);

  const handleQuantityChange = (name, delta) => {
    const item = cart.find(i => i.name === name);
    if (item) {
      updateQuantity(name, item.quantity + delta);
    }
  };

  const handleCheckout = async () => {
    if (!customerInfo.name || !customerInfo.phone) {
      alert('Please enter your name and phone number');
      return;
    }

    setPlacingOrder(true);
    try {
      await push(ref(db, 'orders'), {
        customerName: customerInfo.name,
        phone: customerInfo.phone,
        tableNumber: orderType === 'dine-in' ? customerInfo.tableNumber || null : null,
        items: cart.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        total: cartTotal,
        status: 'pending',
        orderType: orderType,
        createdAt: Date.now()
      });
      alert('Order placed successfully! We will contact you soon.');
      clearCart();
      navigate('/');
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <>
      <Nav />
      <div style={{ 
        minHeight: '100vh', 
        padding: '120px 24px 48px',
        background: 'var(--bg-dark)',
        color: 'var(--text-primary)'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h1 style={{ 
            fontFamily: 'Playfair Display, serif', 
            fontSize: '36px', 
            marginBottom: '32px',
            color: 'var(--primary-accent)'
          }}>
            Your Order
          </h1>

          {cart.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '64px 24px',
              background: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--secondary-accent)'
            }}>
              <p style={{ fontSize: '18px', marginBottom: '24px', color: 'var(--text-secondary)' }}>
                Your cart is empty
              </p>
              <button 
                onClick={() => navigate('/')}
                style={{ 
                  padding: '14px 32px', 
                  background: 'var(--primary-accent)', 
                  color: 'var(--bg-dark)', 
                  border: 'none', 
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <>
              <div style={{ 
                background: 'var(--bg-card)', 
                borderRadius: '12px',
                border: '1px solid var(--secondary-accent)',
                overflow: 'hidden',
                marginBottom: '24px'
              }}>
                {cart.map((item, index) => (
                  <div key={item.name} style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '20px 24px',
                    borderBottom: index < cart.length - 1 ? '1px solid var(--secondary-accent)' : 'none'
                  }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>{item.name}</h3>
                      <p style={{ margin: 0, color: 'var(--primary-accent)', fontWeight: '600' }}>
                        ${item.price.toFixed(2)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button 
                        onClick={() => handleQuantityChange(item.name, -1)}
                        style={{
                          width: '36px',
                          height: '36px',
                          background: 'var(--bg-dark)',
                          border: '1px solid var(--secondary-accent)',
                          color: 'var(--text-primary)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '18px'
                        }}
                      >
                        −
                      </button>
                      <span style={{ 
                        minWidth: '40px', 
                        textAlign: 'center',
                        fontSize: '18px',
                        fontWeight: '600'
                      }}>
                        {item.quantity}
                      </span>
                      <button 
                        onClick={() => handleQuantityChange(item.name, 1)}
                        style={{
                          width: '36px',
                          height: '36px',
                          background: 'var(--bg-dark)',
                          border: '1px solid var(--secondary-accent)',
                          color: 'var(--text-primary)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '18px'
                        }}
                      >
                        +
                      </button>
                      <span style={{ 
                        minWidth: '80px', 
                        textAlign: 'right',
                        fontSize: '18px',
                        fontWeight: '600',
                        color: 'var(--primary-accent)'
                      }}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                      <button 
                        onClick={() => removeFromCart(item.name)}
                        style={{
                          width: '36px',
                          height: '36px',
                          background: '#e74c3c',
                          border: 'none',
                          color: 'white',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '16px'
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px'
              }}>
                <button 
                  onClick={clearCart}
                  style={{
                    padding: '12px 24px',
                    background: 'transparent',
                    border: '1px solid #e74c3c',
                    color: '#e74c3c',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Clear Cart
                </button>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 8px 0', color: 'var(--text-secondary)' }}>
                    {cartCount} item{cartCount !== 1 ? 's' : ''}
                  </p>
                  <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: 'var(--primary-accent)' }}>
                    Total: ${cartTotal.toFixed(2)}
                  </p>
                </div>
              </div>

              <div style={{ 
                background: 'var(--bg-card)', 
                borderRadius: '12px',
                border: '1px solid var(--secondary-accent)',
                padding: '24px',
                marginBottom: '24px'
              }}>
                <h3 style={{ margin: '0 0 20px 0', color: 'var(--primary-accent)' }}>Order Type</h3>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {['pickup', 'dine-in', 'delivery'].map(type => (
                    <button
                      key={type}
                      onClick={() => setOrderType(type)}
                      style={{
                        flex: 1,
                        padding: '14px',
                        background: orderType === type ? 'var(--primary-accent)' : 'var(--bg-dark)',
                        color: orderType === type ? 'var(--bg-dark)' : 'var(--text-primary)',
                        border: `1px solid ${orderType === type ? 'var(--primary-accent)' : 'var(--secondary-accent)'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        textTransform: 'capitalize'
                      }}
                    >
                      {type === 'dine-in' ? 'Dine In' : type === 'pickup' ? 'Pickup' : 'Delivery'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ 
                background: 'var(--bg-card)', 
                borderRadius: '12px',
                border: '1px solid var(--secondary-accent)',
                padding: '24px',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, color: 'var(--primary-accent)' }}>Your Information</h3>
                  {user && (
                    <span style={{ 
                      background: 'rgba(39, 174, 96, 0.2)', 
                      color: '#27ae60', 
                      padding: '6px 12px', 
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      ✓ Logged in as {user.email}
                    </span>
                  )}
                </div>
                {user && customerInfo.name && (
                  <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
                    Information loaded from your account. You can edit if needed.
                  </p>
                )}
                <div style={{ display: 'grid', gap: '16px' }}>
                  <input
                    type="text"
                    placeholder="Your Name *"
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                    style={{
                      padding: '14px',
                      background: 'var(--bg-dark)',
                      border: '1px solid var(--secondary-accent)',
                      color: 'var(--text-primary)',
                      borderRadius: '8px',
                      fontSize: '16px'
                    }}
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number *"
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                    style={{
                      padding: '14px',
                      background: 'var(--bg-dark)',
                      border: '1px solid var(--secondary-accent)',
                      color: 'var(--text-primary)',
                      borderRadius: '8px',
                      fontSize: '16px'
                    }}
                  />
                  {orderType === 'dine-in' && (
                    <input
                      type="number"
                      placeholder="Table Number (optional)"
                      value={customerInfo.tableNumber}
                      onChange={(e) => setCustomerInfo({...customerInfo, tableNumber: e.target.value})}
                      style={{
                        padding: '14px',
                        background: 'var(--bg-dark)',
                        border: '1px solid var(--secondary-accent)',
                        color: 'var(--text-primary)',
                        borderRadius: '8px',
                        fontSize: '16px'
                      }}
                    />
                  )}
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={placingOrder}
                style={{
                  width: '100%',
                  padding: '18px',
                  background: placingOrder ? '#666' : 'var(--primary-accent)',
                  color: 'var(--bg-dark)',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  cursor: placingOrder ? 'not-allowed' : 'pointer'
                }}
              >
                {placingOrder ? 'Placing Order...' : `Place Order - $${cartTotal.toFixed(2)}`}
              </button>
            </>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}

export default CartPage;