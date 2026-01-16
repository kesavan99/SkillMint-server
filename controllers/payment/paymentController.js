const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../../models/schemas/userSchema');

let razorpayInstance = null;
let isInitializing = false;

const getRazorpayInstance = () => {
  if (razorpayInstance) {
    return razorpayInstance;
  }

  if (isInitializing) {
    return razorpayInstance;
  }

  isInitializing = true;

  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
    }

    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    return razorpayInstance;
  } finally {
    isInitializing = false;
  }
};

// Plan configurations
const PLANS = {
  standard: {
    planNumber: 2,
    name: 'Standard Plan',
    credits: 15,
    amount: 9900,
    aiLimit: 5
  },
  elite: {
    planNumber: 3,
    name: 'Elite Plan',
    credits: 50,
    amount: 24900,
    aiLimit: 10
  },
  recharge: {
    name: 'Credit Recharge',
    credits: 1,
    amount: 1000
  }
};

/**
 * Create Razorpay order for plan upgrade or recharge
 * POST /api/payment/create-order
 */
const createOrder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { planId, quantity } = req.body;

    // Validate plan
    if (!planId || !PLANS[planId]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan selected'
      });
    }

    const plan = PLANS[planId];

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // For plan upgrades (not recharge), check if user already has higher plan
    if (planId !== 'recharge' && user.plan >= plan.planNumber) {
      return res.status(400).json({
        success: false,
        message: 'You already have this plan or a higher plan'
      });
    }

    const shortUserId = userId.toString().slice(-8);
    const shortTimestamp = Date.now().toString(36);
    const receipt = `rcpt_${shortUserId}_${shortTimestamp}`;

    // Compute dynamic amount/credits for recharge if quantity provided
    let orderAmount = plan.amount; // in paise
    let orderCredits = plan.credits;

    if (planId === 'recharge') {
      const qty = Number.isInteger(quantity) ? quantity : 1;
      const safeQty = Math.max(1, Math.min(qty, 50)); // clamp between 1 and 50
      orderAmount = plan.amount * safeQty;
      orderCredits = plan.credits * safeQty;
    } else{
        orderAmount = plan.amount * quantity;
        orderCredits = plan.credits * quantity;
    }

    const orderOptions = {
      amount: orderAmount,
      currency: 'INR',
      receipt: receipt,
      notes: {
        userId: userId.toString(),
        planId: planId,
        planName: plan.name,
        credits: orderCredits.toString()
      }
    };

    const order = await getRazorpayInstance().orders.create(orderOptions);

    if (!order) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create order'
      });
    }

    // Return order details to client
    res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        planName: plan.name,
        credits: Number(orderOptions.notes.credits),
        keyId: process.env.RAZORPAY_KEY_ID // Only key_id is safe to send to client
      }
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Verify payment after Razorpay checkout
 * POST /api/payment/verify
 */
const verifyPayment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment details'
      });
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const isSignatureValid = expectedSignature === razorpay_signature;

    if (!isSignatureValid) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed - Invalid signature'
      });
    }

    // Fetch payment details from Razorpay to double-verify
    const payment = await getRazorpayInstance().payments.fetch(razorpay_payment_id);
    
    if (payment.status !== 'captured') {
      return res.status(400).json({
        success: false,
        message: 'Payment not captured'
      });
    }

    // Get plan details
    const plan = PLANS[planId];
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan'
      });
    }

    // Update user's plan and credits
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // For recharge, derive credits from order notes to support variable quantity
    if (planId === 'recharge') {
      const order = await getRazorpayInstance().orders.fetch(razorpay_order_id);
      const creditsFromOrder = Number(order?.notes?.credits || plan.credits);
      user.credit = (user.credit || 0) + creditsFromOrder;
    } else {
      // For plan upgrade
      user.plan = plan.planNumber;
      user.credit = (user.credit || 0) + plan.credits;
      user.aiLimit = plan.aiLimit; // Update AI limit based on plan
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        planName: plan.name,
        credits: planId === 'recharge' ? Number((await getRazorpayInstance().orders.fetch(razorpay_order_id))?.notes?.credits || plan.credits) : plan.credits,
        totalCredits: user.credit,
        plan: user.plan,
        paymentId: razorpay_payment_id
      }
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Razorpay Webhook handler
 * POST /api/payment/webhook
 * This is called by Razorpay server directly
 */
const handleWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    // Verify webhook signature
    const signature = req.headers['x-razorpay-signature'];
    
    if (!signature) {
      console.error('Webhook: Missing signature');
      return res.status(400).json({ success: false, message: 'Missing signature' });
    }

    // Handle both raw body (Buffer) and parsed JSON body
    const body = Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('Webhook: Invalid signature');
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    // Parse body if it was raw
    const parsedBody = Buffer.isBuffer(req.body) ? JSON.parse(body) : req.body;
    const event = parsedBody.event;
    const payload = parsedBody.payload;

    console.log('Webhook event received:', event);

    // Handle payment captured event
    if (event === 'payment.captured') {
      const payment = payload.payment.entity;
      const orderId = payment.order_id;
      
      // Fetch order to get notes (userId, planId)
      const order = await getRazorpayInstance().orders.fetch(orderId);
      const { userId, planId } = order.notes;

      if (!userId || !planId) {
        console.error('Webhook: Missing user or plan info in order notes');
        return res.status(200).json({ success: true, message: 'Acknowledged but no action needed' });
      }

      const plan = PLANS[planId];
      if (!plan) {
        console.error('Webhook: Invalid plan in order notes');
        return res.status(200).json({ success: true, message: 'Acknowledged but invalid plan' });
      }

      // Update user
      const user = await User.findById(userId);
      if (!user) {
        console.error('Webhook: User not found');
        return res.status(200).json({ success: true, message: 'Acknowledged but user not found' });
      }

      // Check if this payment was already processed (idempotency)
      // You might want to store payment IDs in a separate collection to track this
      
      if (planId === 'recharge') {
        const creditsFromOrder = Number(order?.notes?.credits || plan.credits);
        user.credit = (user.credit || 0) + creditsFromOrder;
      } else {
        user.plan = plan.planNumber;
        user.credit = (user.credit || 0) + plan.credits;
        user.aiLimit = plan.aiLimit;
      }

      await user.save();
      console.log(`Webhook: Updated user ${userId} with plan ${planId}`);
    }

    // Handle payment failed event
    if (event === 'payment.failed') {
      const payment = payload.payment.entity;
      console.log('Payment failed:', payment.id, payment.error_description);
      // You can log this or notify admin
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ success: true, message: 'Webhook processed' });

  } catch (error) {
    console.error('Webhook error:', error);
    // Still return 200 to prevent Razorpay from retrying
    res.status(200).json({ success: true, message: 'Webhook acknowledged with error' });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  handleWebhook
};
