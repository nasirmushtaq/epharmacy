const express = require('express');
const https = require('https');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const Order = require('../models/Order'); // Added import for Order model

const router = express.Router();

function createRazorpayOrder({ keyId, keySecret, amount, currency = 'INR', receipt = '', notes = {} }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ amount, currency, receipt, notes });
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const req = https.request({
      hostname: 'api.razorpay.com',
      path: '/v1/orders',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        } else {
          reject(new Error(`Razorpay order failed ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Create a payment order
router.post('/create', authenticate, async (req, res) => {
  try {
    const { amount, currency = 'INR', purpose = 'general', entityType, entityId } = req.body || {};
    console.log('[PAYMENTS][RP][CREATE] user=', req.user?._id?.toString(), 'amount=', amount, 'entity=', entityType, entityId);
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) { console.log('[PAYMENTS][RP][MISSING_KEYS]'); return res.status(500).json({ success: false, message: 'Razorpay keys not configured' }); }

    const receipt = `${entityType || 'misc'}_${entityId || 'na'}_${Date.now()}`;
    const order = await createRazorpayOrder({ keyId, keySecret, amount: Math.round(Number(amount) * 100), currency, receipt, notes: { purpose, entityType, entityId } });

    res.json({ success: true, data: { orderId: order.id, amount: order.amount, currency: order.currency, keyId, entityType, entityId } });
  } catch (e) {
    console.error('[PAYMENTS][RP][ERROR] Create payment order error', e);
    res.status(500).json({ success: false, message: 'Payment init failed' });
  }
});

// Serve a minimal checkout page for WebView
router.get('/checkout-page', authenticate, (req, res) => {
  const { orderId, keyId, amount, currency = 'INR', name = 'Payment', description = 'Checkout' } = req.query;
  if (!orderId || !keyId) return res.status(400).send('Missing orderId/keyId');
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Checkout</title></head><body>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  var options = {
    key: ${JSON.stringify(keyId)},
    amount: ${JSON.stringify(amount || '')},
    currency: ${JSON.stringify(currency)},
    name: ${JSON.stringify(name)},
    description: ${JSON.stringify(description)},
    order_id: ${JSON.stringify(orderId)},
    handler: function (response){
      var msg = JSON.stringify({ event: 'success', data: response });
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) window.ReactNativeWebView.postMessage(msg);
    },
    modal: { ondismiss: function(){
      var msg = JSON.stringify({ event: 'dismiss' });
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) window.ReactNativeWebView.postMessage(msg);
    } }
  };
  var rzp1 = new Razorpay(options);
  rzp1.on('payment.failed', function (response){
    var msg = JSON.stringify({ event: 'failed', data: response.error });
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) window.ReactNativeWebView.postMessage(msg);
  });
  rzp1.open();
</script>
</body></html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Verify payment (for signature verification)
router.post('/verify', authenticate, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    // For Razorpay signature verification
    if (razorpay_signature) {
      const crypto = require('crypto');
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      
      if (!keySecret) {
        return res.status(500).json({ success: false, message: 'Razorpay secret not configured' });
      }
      
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto.createHmac('sha256', keySecret).update(body).digest('hex');
      
      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Invalid signature' });
      }
    }
    
    // Find and update order
    try {
      const order = await Order.findOne({ 
        $or: [
          { 'payment.gatewayOrderId': razorpay_order_id },
          { orderNumber: razorpay_order_id }
        ]
      });
      
      if (order) {
        order.payment.paymentId = razorpay_payment_id;
        order.payment.signature = razorpay_signature;
        
        const updated = order.updatePaymentStatus('paid', 'user', {
          paymentId: razorpay_payment_id,
          signature: razorpay_signature
        });
        
        if (updated) {
          await order.save();
          console.log('[PAYMENTS] Payment verified and order updated:', order.orderNumber);
        }
      }
    } catch (error) {
      console.warn('[PAYMENTS] Could not update order after verification:', error.message);
    }
    
    res.json({ success: true, message: 'Payment verified' });
    
  } catch (error) {
    console.error('[PAYMENTS] Verify payment error:', error);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

module.exports = router;

// ========================= CASHFREE (PG) ============================= //
function getCashfreeBase(env) {
  return (env === 'PROD' || env === 'production') ? 'https://api.cashfree.com' : 'https://sandbox.cashfree.com';
}

// Create Cashfree order/session
router.post('/cashfree/create', authenticate, async (req, res) => {
  try {
    const { amount, currency = 'INR', orderId, customer = {} } = req.body || {};
    console.log('[PAYMENTS][CF][CREATE] user=', req.user?._id?.toString(), 'amount=', amount, 'orderId=', orderId);
    
    if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });
    
    const appId = process.env.CASHFREE_APP_ID;
    const secret = process.env.CASHFREE_SECRET_KEY;
    const env = process.env.CASHFREE_ENVIRONMENT || process.env.CASHFREE_ENV || 'SANDBOX';
    console.log('[PAYMENTS][CF][CREATE] Using environment:', env);
    
    if (!appId || !secret) { 
      console.log('[PAYMENTS][CF][MISSING_KEYS]'); 
      return res.status(500).json({ success: false, message: 'Cashfree keys not configured' }); 
    }
    
    const cfOrderId = orderId || `CF_${Date.now()}`;
    const base = getCashfreeBase(env);
    
    const body = JSON.stringify({
      order_id: cfOrderId,
      order_amount: Number(amount),
      order_currency: currency,
      customer_details: {
        customer_id: (req.user?._id || 'cust').toString(),
        customer_phone: customer.phone || req.user?.phone || '9999999999',
        customer_email: customer.email || req.user?.email || 'customer@example.com'
      }
    });
    
    const https = require('https');
    const resp = await new Promise((resolve, reject) => {
      const rq = https.request({ 
        hostname: base.replace('https://',''), 
        path: '/pg/orders', 
        method: 'POST', 
        headers: {
          'x-client-id': appId,
          'x-client-secret': secret,
          'x-api-version': '2022-09-01',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (r) => { 
        let d=''; 
        r.on('data', c => d+=c); 
        r.on('end', ()=> { 
          try { resolve(JSON.parse(d)); } catch(e){ reject(e);} 
        }); 
      });
      rq.on('error', reject); 
      rq.write(body); 
      rq.end();
    });
    
    console.log('[PAYMENTS][CF][CREATE] Raw Cashfree response:', JSON.stringify(resp, null, 2));
    
    if (!resp?.payment_session_id) {
      console.log('[PAYMENTS][CF][CREATE] ERROR: No session ID in response');
      return res.status(500).json({ success: false, message: 'Cashfree did not return session' });
    }
    
    console.log('[PAYMENTS][CF][CREATE] Session ID:', resp.payment_session_id);
    
    // Update order with payment tracking info if order exists
    if (orderId) {
      try {
        // Find order by orderNumber (which matches the orderId)
        let order = null;
        
        // Try different order ID patterns
        if (orderId.startsWith('BOOKING_')) {
          order = await Order.findById(orderId.replace('BOOKING_', ''));
        } else if (orderId.startsWith('TEST_')) {
          order = await Order.findById(orderId.replace('TEST_', ''));
        } else {
          // Try to find by orderNumber
          order = await Order.findOne({ orderNumber: orderId });
        }
        
        if (order) {
          order.payment.gatewayOrderId = cfOrderId;
          order.payment.paymentSessionId = resp.payment_session_id;
          order.payment.status = 'processing';
          
          // Add payment attempt
          order.addPaymentAttempt(resp, 'session_created');
          await order.save();
          
          console.log('[PAYMENTS][CF][CREATE] Order updated with payment session:', order.orderNumber);
        }
      } catch (error) {
        console.warn('[PAYMENTS][CF][CREATE] Could not update order:', error.message);
      }
    }
    
    // Always return 'SANDBOX' for non-production environments
    const returnEnv = (env === 'PROD' || env === 'production') ? 'PROD' : 'SANDBOX';
    res.json({ success: true, data: { sessionId: resp.payment_session_id, orderId: cfOrderId, appId, env: returnEnv } });
    
  } catch (e) { 
    console.error('[PAYMENTS][CF][ERROR] create error', e); 
    res.status(500).json({ success: false, message: 'Cashfree init failed' }); 
  }
});

// Cashfree checkout page for WebView
router.get('/cashfree/checkout-page', (req, res) => {
  const { sessionId, appId, env = 'SANDBOX' } = req.query;
  console.log('[PAYMENTS][CF][CHECKOUT_PAGE] RAW params - sessionId=', sessionId, 'appId=', appId, 'env=', env);
  if (!sessionId || !appId) {
    console.log('[PAYMENTS][CF][CHECKOUT_PAGE] ERROR: Missing required params');
    return res.status(400).send('Missing sessionId/appId');
  }
  
  const sdkSrc = 'https://sdk.cashfree.com/js/v3/cashfree.js';
  const cfMode = (env === 'PROD' || env === 'production') ? 'production' : 'sandbox';
  console.log('[PAYMENTS][CF][CHECKOUT_PAGE] Using CF mode:', cfMode, 'for env:', env);
  
  if (sessionId.length < 10 || !sessionId.startsWith('session_')) {
    console.log('[PAYMENTS][CF][CHECKOUT_PAGE] ERROR: Invalid session ID format:', sessionId);
    return res.status(400).send('Invalid session ID format');
  }
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Cashfree Checkout</title>
<style>
  body { font-family: -apple-system, Roboto, Arial; margin:0; }
  #wrap { padding:16px; }
  #btn { display:inline-block; background:#4f46e5; color:#fff; border:none; border-radius:8px; padding:12px 16px; font-size:16px; }
  #msg { color:#333; margin-top:12px; }
</style>
</head><body>
<div id="wrap">
  <button id="btn">Pay Now</button>
  <div id="msg">Loading payment...</div>
</div>
<script>
  var timeout = setTimeout(function(){ send('failed', { error: 'SDK load timeout' }); }, 8000);
  function send(event, data){
    try {
      var payload = JSON.stringify({ event: event, data: data || {} });
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) window.ReactNativeWebView.postMessage(payload);
      var el = document.getElementById('msg'); if (el) el.textContent = event + (data? (': '+ JSON.stringify(data)) : '');
    } catch (e) {}
  }
  function start(){
    try {
      clearTimeout(timeout);
      var el = document.getElementById('msg');
      if (el) el.textContent = 'Checking Cashfree SDK...';
      
      console.log('🔧 Starting payment process...');
      console.log('🔧 Cashfree available:', typeof Cashfree !== 'undefined');
      
      if (typeof Cashfree === 'undefined') {
        console.error('❌ Cashfree SDK not loaded');
        if (el) el.textContent = 'Error: Cashfree SDK not loaded';
        send('failed', { error: 'Cashfree SDK not loaded' });
        return;
      }
      
      console.log('🔧 Initializing Cashfree with mode: ${cfMode}');
      if (el) el.textContent = 'Initializing Cashfree...';
      
      var cashfree = Cashfree({ mode: ${JSON.stringify(cfMode)} });
      console.log('✅ Cashfree initialized:', cashfree);
      console.log('✅ Cashfree methods:', Object.keys(cashfree || {}));
      
      if (!cashfree) {
        console.error('❌ Cashfree initialization returned null/undefined');
        if (el) el.textContent = 'Error: Cashfree initialization failed';
        send('failed', { error: 'Cashfree initialization failed' });
        return;
      }
      
      if (typeof cashfree.checkout !== 'function') {
        console.error('❌ Cashfree checkout method not available');
        console.log('Available methods:', Object.keys(cashfree));
        if (el) el.textContent = 'Error: Checkout method not available';
        send('failed', { error: 'Checkout method not available' });
        return;
      }
      
      console.log('🆔 Session ID: ${sessionId}');
      console.log('🆔 Session ID length:', ${JSON.stringify(sessionId)}.length);
      console.log('🆔 Session ID valid format:', ${JSON.stringify(sessionId)}.startsWith('session_'));
      
      if (el) el.textContent = 'Starting checkout...';
      console.log('🚀 Calling cashfree.checkout...');
      
      var checkoutResult = cashfree.checkout({ 
        paymentSessionId: ${JSON.stringify(sessionId)} 
      }, {
        onSuccess: function(data){ 
          console.log('✅ Cashfree Success:', data);
          if (el) el.textContent = 'Payment successful!';
          send('success', data && data.order); 
        },
        onFailure: function(data){ 
          console.log('❌ Cashfree Failure:', data);
          if (el) el.textContent = 'Payment failed: ' + (data?.error?.message || data?.message || 'Unknown error');
          var errorMsg = 'Payment failed';
          if (data && data.error && data.error.message) {
            errorMsg = data.error.message;
          } else if (data && data.message) {
            errorMsg = data.message;
          } else if (typeof data === 'string') {
            errorMsg = data;
          }
          send('failed', { error: errorMsg, rawData: data }); 
        },
        onClose: function(){ 
          console.log('🚪 Cashfree Closed');
          if (el) el.textContent = 'Payment window closed';
          send('dismiss'); 
        }
      });
      
      console.log('🚀 Checkout call result:', checkoutResult);
      if (el) el.textContent = 'Checkout initiated...';
      
    } catch (e) { 
      console.error('💥 Exception in start():', e);
      var el = document.getElementById('msg');
      if (el) el.textContent = 'Error: ' + e.message;
      send('failed', { error: (e && e.message) || String(e) }); 
    }
  }
  var s = document.createElement('script'); s.src = ${JSON.stringify(sdkSrc)}; s.async = true;
  s.onload = function(){
    // hook button
    try { var b = document.getElementById('btn'); if (b) b.onclick = start; } catch(e){}
    // auto-start after a tick; if blocked, user can tap button
    setTimeout(start, 400);
  };
  s.onerror = function(){ clearTimeout(timeout); send('failed', { error: 'SDK script failed to load' }); };
  document.head.appendChild(s);
  window.onerror = function(msg, src, line, col, err){ send('failed', { error: String(msg || (err && err.message) || err) }); };
</script>
</body></html>`;
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://sdk.cashfree.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.cashfree.com https://sandbox.cashfree.com; frame-src https://payments.cashfree.com https://payments-test.cashfree.com https://sdk.cashfree.com https://sandbox.cashfree.com");
  res.send(html);
  console.log('[PAYMENTS][CF][CHECKOUT_PAGE][RES] html sent');
});

// Cashfree webhook endpoint
router.post('/cashfree/webhook', async (req, res) => {
  try {
    const webhookData = req.body;
    console.log('[PAYMENTS][CF][WEBHOOK] Received:', JSON.stringify(webhookData, null, 2));
    
    // Verify webhook signature (if configured)
    const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET;
    if (webhookSecret) {
      const receivedSignature = req.headers['x-webhook-signature'];
      const crypto = require('crypto');
      const expectedSignature = crypto.createHmac('sha256', webhookSecret)
        .update(JSON.stringify(webhookData))
        .digest('hex');
      
      if (receivedSignature !== expectedSignature) {
        console.log('[PAYMENTS][CF][WEBHOOK] Invalid signature');
        return res.status(400).json({ success: false, message: 'Invalid signature' });
      }
    }
    
    const { type, data } = webhookData;
    
    if (type === 'PAYMENT_SUCCESS_WEBHOOK' || type === 'PAYMENT_FAILED_WEBHOOK') {
      const orderId = data?.order?.order_id;
      const paymentId = data?.payment?.cf_payment_id;
      const amount = data?.payment?.payment_amount;
      const status = type === 'PAYMENT_SUCCESS_WEBHOOK' ? 'paid' : 'failed';
      
      // Generate webhook ID for ordering
      const webhookId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      
      try {
        // Find order by gateway order ID or order number
        const order = await Order.findOne({
          $or: [
            { 'payment.gatewayOrderId': orderId },
            { orderNumber: orderId }
          ]
        });
        
        if (order) {
          // Update payment details
          if (paymentId) order.payment.paymentId = paymentId;
          if (amount) order.payment.amount = amount;
          
          // Update payment status with webhook protection
          const updated = order.updatePaymentStatus(status, 'webhook', {
            webhookType: type,
            paymentId,
            amount,
            rawWebhookData: webhookData
          }, webhookId);
          
          if (updated) {
            await order.save();
            console.log(`[PAYMENTS][CF][WEBHOOK] Order ${order.orderNumber} payment status updated to ${status}`);
            
            // Send order confirmation email ONLY after successful payment
            if (status === 'paid') {
              try {
                const customer = await User.findById(order.customer);
                if (emailService && emailService.sendOrderConfirmationEmail) {
                  await emailService.sendOrderConfirmationEmail(order, customer);
                  console.log(`✅ Order confirmation email sent to ${customer.email} after Cashfree payment confirmation`);
                } else {
                  console.log(`⚠️ Email service not configured, order ${order.orderNumber} payment confirmed for ${customer.email}`);
                }
              } catch (error) {
                console.error('❌ Failed to send order confirmation email after Cashfree payment:', error.message);
                // Don't fail webhook processing if email fails
              }
            }
          } else {
            console.log(`[PAYMENTS][CF][WEBHOOK] Payment status update rejected for order ${order.orderNumber}`);
          }
        } else {
          console.log(`[PAYMENTS][CF][WEBHOOK] Order not found for ID: ${orderId}`);
        }
      } catch (error) {
        console.error('[PAYMENTS][CF][WEBHOOK] Error updating order:', error);
      }
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('[PAYMENTS][CF][WEBHOOK] Error:', error);
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});

// Debug endpoint to test Cashfree session creation
router.get('/cashfree/debug', authenticate, async (req, res) => {
  try {
    const appId = process.env.CASHFREE_APP_ID;
    const secret = process.env.CASHFREE_SECRET_KEY;
    const env = process.env.CASHFREE_ENV || 'TEST';
    
    console.log('[PAYMENTS][CF][DEBUG] appId=', !!appId, 'secret=', !!secret, 'env=', env);
    
    if (!appId || !secret) {
      return res.json({
        success: false,
        error: 'Cashfree keys not configured',
        config: { appId: !!appId, secret: !!secret, env }
      });
    }

    // Test creating a session
    const cfOrderId = `DEBUG_${Date.now()}`;
    const base = getCashfreeBase(env);
    const body = JSON.stringify({
      order_id: cfOrderId,
      order_amount: 1,
      order_currency: 'INR',
      customer_details: {
        customer_id: req.user?._id?.toString() || 'debug_user',
        customer_phone: req.user?.phone || '9999999999',
        customer_email: req.user?.email || 'debug@example.com'
      }
    });

    console.log('[PAYMENTS][CF][DEBUG] creating test order with body:', body);

    const https = require('https');
    const resp = await new Promise((resolve, reject) => {
      const rq = https.request({
        hostname: base.replace('https://',''),
        path: '/pg/orders',
        method: 'POST',
        headers: {
          'x-client-id': appId,
          'x-client-secret': secret,
          'x-api-version': '2022-09-01',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (r) => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => {
          try {
            resolve({ status: r.statusCode, data: JSON.parse(d) });
          } catch(e) {
            resolve({ status: r.statusCode, data: d });
          }
        });
      });
      rq.on('error', reject);
      rq.write(body);
      rq.end();
    });

    console.log('[PAYMENTS][CF][DEBUG] response:', resp);

    res.json({
      success: true,
      config: { appId: !!appId, secret: !!secret, env, base },
      testOrder: resp,
      sessionAvailable: !!resp.data?.payment_session_id
    });

  } catch (e) {
    console.error('[PAYMENTS][CF][DEBUG] error:', e);
    res.json({ success: false, error: e.message, stack: e.stack });
  }
}); 