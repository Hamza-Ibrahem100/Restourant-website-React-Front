const functions = require('firebase-functions');
const admin = require('firebase-admin');
require('dotenv').config();

admin.initializeApp();
const db = admin.database();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;


/**
 * 2. Webhook: stripeWebhook
 * Triggered by Stripe servers when a transaction completes.
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    if (STRIPE_WEBHOOK_SECRET) {
      // Securely verify signature if secret is provided in production
      event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
    } else {
      // Fallback for local testing without strict webhook verification
      event = req.body;
    }
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.client_reference_id;

    if (orderId) {
      const orderRef = db.ref(`orders/${orderId}`);
      await orderRef.update({
        status: 'paid',
        stripeSessionId: session.id,
        paidAt: Date.now()
      });
      console.log(`Successfully updated Firebase order ${orderId} to paid`);
    }
  }

  res.json({received: true});
});
