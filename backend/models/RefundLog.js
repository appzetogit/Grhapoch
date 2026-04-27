import mongoose from 'mongoose';

const refundLogSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true
    },
    orderNumber: {
      type: String,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'cash', 'razorpay', 'upi', 'card', 'wallet', 'unknown'],
      default: 'unknown'
    },
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    refundId: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['SKIPPED', 'PROCESSED', 'FAILED'],
      required: true
    },
    cancelledBy: {
      type: String,
      enum: ['user', 'restaurant', 'admin', 'USER', 'RESTAURANT', 'ADMIN', null],
      default: null
    },
    reason: {
      type: String,
      default: ''
    },
    message: {
      type: String,
      default: ''
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  { timestamps: true }
);

refundLogSchema.index({ createdAt: -1 });
refundLogSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('RefundLog', refundLogSchema);
