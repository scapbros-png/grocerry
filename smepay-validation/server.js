require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());

// Load SMEPay secrets from .env (you must create this file)
const SMEPAY_API_BASE = process.env.SMEPAY_API_BASE || 'https://api.smepay.example'; // placeholder
const SMEPAY_CLIENT_ID = process.env.SMEPAY_CLIENT_ID || '';
const SMEPAY_SECRET = process.env.SMEPAY_SECRET || ''; // used for HMAC verification if applicable

// Example: POST /validate-payment
// Body: { client_id, amount, slug }
// This endpoint demonstrates calling SMEPay's order/status endpoint and optionally verifying signature
app.post('/validate-payment', async (req, res) => {
  const { client_id, amount, slug } = req.body;
  if (!client_id || !amount || !slug) {
    return res.status(400).json({ error: 'client_id, amount and slug are required' });
  }

  try {
    // Example: call SMEPay order/status endpoint to fetch order details
    // Replace with accurate SMEPay API path and authorization method
    const statusUrl = `${SMEPAY_API_BASE}/orders/${encodeURIComponent(slug)}`;

    const resp = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SMEPAY_API_KEY || ''}`
      }
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(502).json({ error: 'Failed to fetch SMEPay order status', details: text });
    }

    const body = await resp.json();

    // Example response body handling -- adjust field names to match SMEPay API
    // Suppose body contains: { amount: '4398.9', status: 'success', client_id: '...' }
    const paidAmount = body.amount;
    const status = body.status;
    const returnedClientId = body.client_id || body.clientId;

    // Basic validation
    const amountMatches = String(paidAmount) === String(amount);
    const clientMatches = !SMEPAY_CLIENT_ID || SMEPAY_CLIENT_ID === returnedClientId || client_id === returnedClientId;

    // Optionally verify HMAC signature sent by SMEPay (if they send one)
    let signatureValid = true;
    if (body.signature && SMEPAY_SECRET) {
      const payload = `${body.order_id || ''}|${body.amount || ''}|${body.status || ''}`; // example concatenation
      const expected = crypto.createHmac('sha256', SMEPAY_SECRET).update(payload).digest('hex');
      signatureValid = expected === body.signature;
    }

    const valid = amountMatches && clientMatches && signatureValid && status === 'success';

    return res.json({ valid, details: { amountMatches, clientMatches, signatureValid, status, body } });
  } catch (err) {
    console.error('validate-payment error:', err);
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`SMEPay validation server listening on ${port}`));
