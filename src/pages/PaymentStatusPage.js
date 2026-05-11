import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { ref, update, get } from 'firebase/database';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import '../styles/PaymentStatus.css';

function PaymentStatusPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // loading, success, failed
  const [orderDetails, setOrderDetails] = useState(null);
  
  const orderId = searchParams.get('orderId');
  const isSuccess = searchParams.get('success') === 'true';
  const txnId = searchParams.get('id');

  useEffect(() => {
    const processPaymentResult = async () => {
      if (!orderId) {
        setStatus('failed');
        return;
      }

      try {
        const orderRef = ref(db, `orders/${orderId}`);
        const snapshot = await get(orderRef);
        
        if (snapshot.exists()) {
          const order = snapshot.val();
          setOrderDetails({
            id: orderId,
            amount: order.financials?.total || 0,
            date: new Date(order.createdAt).toLocaleString(),
            customerName: order.customerName
          });

          // If the payment is successful, update the database
          if (isSuccess && order.status === 'pending_payment') {
            await update(orderRef, {
              status: 'paid',
              stripeSessionId: txnId || 'unknown',
              paidAt: Date.now()
            });
            setStatus('success');
          } else if (isSuccess && order.status === 'paid') {
            // Already updated (e.g. by webhook or previous visit)
            setStatus('success');
          } else {
            // If the payment failed or user cancelled, we keep the status as pending_payment
            // The user can try again by recreating the order from their cart (or we could provide a retry link)
            setStatus('failed');
          }
        } else {
          setStatus('failed');
        }
      } catch (error) {
        console.error('Error processing payment status:', error);
        setStatus('failed');
      }
    };

    processPaymentResult();
  }, [orderId, isSuccess, txnId]);

  return (
    <>
      <Nav />
      <div className="payment-status-container">
        <div className="payment-status-card">
          
          {status === 'loading' && (
            <>
              <div className="status-icon loading">↻</div>
              <h1>Verifying Payment</h1>
              <p>Please wait while we confirm your transaction...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="status-icon success">✓</div>
              <h1>Payment Successful!</h1>
              <p>Thank you for your order. Your payment has been processed successfully and your food will be prepared shortly.</p>
              
              {orderDetails && (
                <div className="status-details">
                  <div className="status-details-row">
                    <span className="status-details-label">Order ID:</span>
                    <span className="status-details-value">{orderDetails.id}</span>
                  </div>
                  <div className="status-details-row">
                    <span className="status-details-label">Amount Paid:</span>
                    <span className="status-details-value">${orderDetails.amount.toFixed(2)}</span>
                  </div>
                  {txnId && (
                    <div className="status-details-row">
                      <span className="status-details-label">Transaction ID:</span>
                      <span className="status-details-value">{txnId}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="status-actions">
                <Link to="/" className="btn-primary">Return to Home</Link>
              </div>
            </>
          )}

          {status === 'failed' && (
            <>
              <div className="status-icon failed">✕</div>
              <h1>Payment Failed</h1>
              <p>We were unable to process your payment. Your card has not been charged.</p>
              
              <div className="status-actions">
                <Link to="/cart" className="btn-primary">Try Again</Link>
                <Link to="/" className="btn-outline">Return to Home</Link>
              </div>
            </>
          )}

        </div>
      </div>
      <Footer />
    </>
  );
}

export default PaymentStatusPage;
