import crypto from 'crypto';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getEnvVar } from '../utils/envService.js';
import Order from '../models/Order.js';
import DeliveryWallet from '../models/DeliveryWallet.js';
import BusinessSettings from '../models/BusinessSettings.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })]
});

const getRazorpayWebhookSecret = async () => {
  const secretFromEnvStore = await getEnvVar('RAZORPAY_WEBHOOK_SECRET', '');
  return String(secretFromEnvStore || process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
};

const verifyWebhookSignature = (rawBody, signature, secret) => {
  if (!rawBody || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return expected === signature;
};

/**
 * Handle Razorpay webhook for QR-based COD payments
 * POST /api/razorpay/webhook
 */
export const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  const signature = String(req.headers['x-razorpay-signature'] || '');
  const rawBody = req.rawBody || JSON.stringify(req.body || {});

  const webhookSecret = await getRazorpayWebhookSecret();
  if (!webhookSecret) {
    return errorResponse(res, 500, 'Webhook secret not configured');
  }

  const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
  if (!isValid) {
    return errorResponse(res, 400, 'Invalid webhook signature');
  }

  const eventType = String(req.body?.event || '').trim();
  if (eventType !== 'payment.captured') {
    return successResponse(res, 200, 'Webhook ignored', { event: eventType });
  }

  const paymentEntity = req.body?.payload?.payment?.entity;
  const notes = paymentEntity?.notes || {};
  const amount = Number(paymentEntity?.amount) || 0;
  const paymentId = paymentEntity?.id;
  const razorpayOrderId = paymentEntity?.order_id;

  // 1. Handle Cash Limit Deposit (from Delivery Partner)
  if (notes.type === 'cash_limit_deposit') {
    const deliveryId = notes.deliveryId;
    if (!deliveryId) return successResponse(res, 200, 'No deliveryId in deposit notes');

    const wallet = await DeliveryWallet.findOrCreateByDeliveryId(deliveryId);
    
    // Check if already processed
    const existing = (wallet.transactions || []).find(
      (t) => t.type === 'deposit' && (t.metadata?.razorpayPaymentId === paymentId || t.metadata?.get?.('razorpayPaymentId') === paymentId)
    );
    if (existing) return successResponse(res, 200, 'Deposit already processed');

    const amt = amount / 100; // paise to rupees
    const meta = { razorpayOrderId, razorpayPaymentId: paymentId };

    wallet.addTransaction({
      amount: amt,
      type: 'deposit',
      status: 'Completed',
      description: `Cash limit deposit via Razorpay QR`,
      paymentMethod: 'other',
      metadata: meta,
      processedAt: new Date()
    });
    wallet.markModified('transactions');
    await wallet.save();

    logger.info('✅ Deposit processed via webhook', { deliveryId, amount: amt, paymentId });
    return successResponse(res, 200, 'Deposit processed successfully');
  }

  // 2. Handle Order Payment (COD via QR)
  const noteOrderId = notes.orderId || notes.order_id || notes.orderID || notes.order;
  const noteOrderMongoId = notes.orderMongoId || notes.order_mongo_id || notes.orderMongoID;

  if (!noteOrderId && !noteOrderMongoId) {
    return successResponse(res, 200, 'No order reference in webhook notes');
  }

  const orderQuery = [];
  if (noteOrderMongoId) orderQuery.push({ _id: noteOrderMongoId });
  if (noteOrderId) orderQuery.push({ orderId: noteOrderId });

  const order = await Order.findOne(orderQuery.length ? { $or: orderQuery } : {});
  if (!order) return successResponse(res, 200, 'Order not found for webhook');

  if (order.paymentStatus === 'paid') {
    return successResponse(res, 200, 'Order already marked as paid');
  }

  const updateData = {
    paymentStatus: 'paid',
    'payment.status': 'completed',
    'payment.method': 'upi',
    'payment.razorpayPaymentId': paymentId || order.payment?.razorpayPaymentId || '',
    'payment.razorpayOrderId': razorpayOrderId || order.payment?.razorpayOrderId || '',
    'payment.transactionId': paymentId || order.payment?.transactionId || ''
  };

  await Order.findByIdAndUpdate(order._id, { $set: updateData }, { new: true });
  logger.info('✅ Order payment processed via webhook', { orderId: order.orderId, paymentId });

  return successResponse(res, 200, 'Payment captured and marked as paid');
});
