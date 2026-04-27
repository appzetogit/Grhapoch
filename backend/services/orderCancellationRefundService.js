import Payment from '../models/Payment.js';
import User from '../models/User.js';
import UserWallet from '../models/UserWallet.js';
import RefundLog from '../models/RefundLog.js';
import { createRefund } from './razorpayService.js';

const PAYMENT_TYPES = {
  COD: 'COD',
  ONLINE: 'ONLINE',
  WALLET: 'WALLET'
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizePaymentMethod = (method) => String(method || '').trim().toLowerCase();

const resolvePaymentType = (method) => {
  const normalized = normalizePaymentMethod(method);
  if (['cash', 'cod', 'cash_on_delivery', 'cash on delivery'].includes(normalized)) {
    return PAYMENT_TYPES.COD;
  }
  if (normalized === 'wallet') {
    return PAYMENT_TYPES.WALLET;
  }
  return PAYMENT_TYPES.ONLINE;
};

const isStatusAtOrBeyondReady = (order) => {
  const status = String(order?.status || '').toLowerCase();
  if (['ready', 'out_for_delivery', 'delivered'].includes(status)) return true;
  return Boolean(order?.tracking?.ready?.status);
};

const getOrderAmount = (order) => toNumber(order?.pricing?.total ?? order?.totalAmount, 0);

const createRefundLog = async ({
  order,
  paymentMethod,
  amount,
  status,
  cancelledBy,
  reason,
  refundId = null,
  message = '',
  metadata = {}
}) => {
  try {
    await RefundLog.create({
      orderId: order?._id,
      orderNumber: order?.orderId,
      userId: order?.userId,
      paymentMethod: normalizePaymentMethod(paymentMethod) || 'unknown',
      amount: toNumber(amount),
      refundId,
      status,
      cancelledBy: cancelledBy || null,
      reason: reason || '',
      message: message || '',
      metadata
    });
  } catch (error) {
    console.error('Failed to create refund log:', error.message);
  }
};

export const resolveOrderPaymentContext = async (order) => {
  const payment = await Payment.findOne({ orderId: order._id }).sort({ createdAt: -1 });
  const paymentMethod = normalizePaymentMethod(
    order?.payment?.method || payment?.method || payment?.paymentMethod
  );

  const paymentId =
    order?.paymentId ||
    order?.payment?.razorpayPaymentId ||
    payment?.razorpay?.paymentId ||
    payment?.transactionId ||
    '';

  return {
    payment,
    paymentMethod,
    paymentType: resolvePaymentType(paymentMethod),
    paymentId
  };
};

export const validateUserCancellationPolicy = ({ order, paymentType }) => {
  const status = String(order?.status || '').toLowerCase();

  if (status === 'cancelled') {
    return { allowed: false, message: 'Order is already cancelled' };
  }

  if (status === 'delivered') {
    return { allowed: false, message: 'Cannot cancel a delivered order' };
  }

  if (paymentType === PAYMENT_TYPES.COD) {
    if (status !== 'pending') {
      return {
        allowed: false,
        message: 'COD order can only be cancelled before restaurant accepts it'
      };
    }
    return { allowed: true };
  }

  if (isStatusAtOrBeyondReady(order)) {
    return {
      allowed: false,
      message: 'Order cannot be cancelled once it is marked ready or beyond'
    };
  }

  return { allowed: true };
};

const processWalletRefund = async ({ order, amount, reason }) => {
  const userId = order?.userId?._id || order?.userId;
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found for wallet refund');
  }

  const refundAmount = toNumber(amount);
  if (refundAmount <= 0) {
    throw new Error('Refund amount must be greater than 0');
  }

  user.wallet = user.wallet || {};
  const updatedWalletBalance = toNumber(user.wallet.balance) + refundAmount;
  user.wallet.balance = updatedWalletBalance;
  user.walletBalance = updatedWalletBalance;
  await user.save();

  const wallet = await UserWallet.findOrCreateByUserId(userId);
  const existingRefund = wallet.transactions.find(
    (t) => t.type === 'refund' && t.orderId && t.orderId.toString() === order._id.toString()
  );

  if (!existingRefund) {
    wallet.addTransaction({
      amount: refundAmount,
      type: 'refund',
      status: 'Completed',
      description: `Refund for cancelled order ${order.orderId}. Reason: ${reason || 'Order cancelled'}`,
      orderId: order._id,
      paymentMethod: 'wallet',
      paymentGateway: 'internal_wallet',
      metadata: {
        source: 'order_cancel_refund'
      }
    });
    await wallet.save();
  }

  const walletRefundId = `wallet_refund_${order._id}_${Date.now()}`;
  return {
    refundProcessed: true,
    refundId: walletRefundId,
    refundAmount: refundAmount,
    mode: 'wallet'
  };
};

const processOnlineRefund = async ({ order, paymentId, amount, reason, cancelledBy }) => {
  if (!paymentId) {
    throw new Error('Payment ID missing for online refund');
  }

  const refundAmount = toNumber(amount);
  if (refundAmount <= 0) {
    throw new Error('Invalid refund amount for online refund');
  }

  const refundAmountInPaise = Math.round(refundAmount * 100);
  const razorpayRefund = await createRefund(paymentId, refundAmountInPaise, {
    orderId: order.orderId,
    cancelledBy: cancelledBy || 'system',
    reason: reason || 'Order cancelled'
  });

  return {
    refundProcessed: true,
    refundId: razorpayRefund?.id || null,
    refundAmount: refundAmount,
    mode: 'online',
    razorpayRefund
  };
};

export const processRefundByPolicy = async ({ order, paymentContext, reason, cancelledBy }) => {
  if (!order) throw new Error('Order is required for refund');

  if (String(order.refundStatus || '').toUpperCase() === 'PROCESSED') {
    throw new Error('Refund already processed for this order');
  }
  if (String(paymentContext?.payment?.status || '').toLowerCase() === 'refunded') {
    throw new Error('Refund already processed for this order');
  }

  const paymentType = paymentContext?.paymentType || PAYMENT_TYPES.ONLINE;
  const paymentMethod = paymentContext?.paymentMethod || order?.payment?.method || 'unknown';
  const paymentId = paymentContext?.paymentId || '';
  const amount = getOrderAmount(order);

  if (paymentType === PAYMENT_TYPES.COD) {
    const result = {
      refundProcessed: false,
      refundId: null,
      refundAmount: 0,
      mode: 'cod',
      message: 'No refund for COD orders'
    };
    await createRefundLog({
      order,
      paymentMethod,
      amount: 0,
      status: 'SKIPPED',
      cancelledBy,
      reason,
      message: result.message
    });
    return result;
  }

  if (paymentType === PAYMENT_TYPES.WALLET) {
    const result = await processWalletRefund({ order, amount, reason });
    await createRefundLog({
      order,
      paymentMethod,
      amount: result.refundAmount,
      status: 'PROCESSED',
      cancelledBy,
      reason,
      refundId: result.refundId,
      message: 'Wallet refund processed successfully'
    });
    return result;
  }

  const onlineResult = await processOnlineRefund({
    order,
    paymentId,
    amount,
    reason,
    cancelledBy
  });

  await createRefundLog({
    order,
    paymentMethod,
    amount: onlineResult.refundAmount,
    status: 'PROCESSED',
    cancelledBy,
    reason,
    refundId: onlineResult.refundId,
    message: 'Razorpay refund processed successfully'
  });
  return onlineResult;
};

export const applyCancellationAndRefundState = async ({
  order,
  reason,
  cancelledBy,
  paymentContext,
  refundResult
}) => {
  order.status = 'cancelled';
  order.cancellationReason = reason || 'Cancelled';
  order.cancelledBy = cancelledBy;
  order.cancelledAt = new Date();

  if (paymentContext?.paymentId && !order.paymentId) {
    order.paymentId = paymentContext.paymentId;
  }

  if (refundResult?.refundProcessed) {
    order.refundStatus = 'PROCESSED';
    order.refundId = refundResult.refundId || order.refundId || null;
    if (order.payment) {
      order.payment.status = 'refunded';
    }
  } else if (paymentContext?.paymentType === PAYMENT_TYPES.COD) {
    order.refundStatus = 'NONE';
    order.refundId = null;
  } else {
    order.refundStatus = 'NONE';
    order.refundId = null;
  }

  if (paymentContext?.paymentId && order.payment && !order.payment.razorpayPaymentId) {
    order.payment.razorpayPaymentId = paymentContext.paymentId;
  }

  await order.save();

  if (paymentContext?.payment && refundResult?.refundProcessed) {
    paymentContext.payment.status = 'refunded';
    paymentContext.payment.refund = {
      amount: refundResult.refundAmount || getOrderAmount(order),
      status:
        refundResult.refundAmount >= getOrderAmount(order) ? 'full' : 'partial',
      refundId: refundResult.refundId || null,
      refundedAt: new Date(),
      reason: reason || 'Order cancelled'
    };
    await paymentContext.payment.save();
  }
};

export { PAYMENT_TYPES, resolvePaymentType, normalizePaymentMethod, getOrderAmount };
