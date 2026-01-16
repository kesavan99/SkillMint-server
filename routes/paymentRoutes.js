const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  createOrder,
  verifyPayment,
  handleWebhook
} = require('../controllers/payment/paymentController');

// Protected routes (require authentication)
router.post('/create-order', authMiddleware, createOrder);
router.post('/verify', authMiddleware, verifyPayment);

// Webhook route (no authentication - Razorpay calls this directly)
// Make sure to add raw body parser for this route in server.js
router.post('/webhook', handleWebhook);

module.exports = router;
