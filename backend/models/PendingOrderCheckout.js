import mongoose from 'mongoose';

const pendingOrderCheckoutSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    clientOrderRef: {
      type: String,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'cancelled'],
      default: 'pending',
      index: true
    },
    orderData: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    payment: {
      method: {
        type: String,
        enum: ['razorpay'],
        default: 'razorpay'
      },
      status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
        default: 'pending'
      },
      razorpayOrderId: {
        type: String,
        index: true
      },
      razorpayPaymentId: {
        type: String
      },
      razorpaySignature: {
        type: String
      }
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      index: { expireAfterSeconds: 0 }
    }
  },
  { timestamps: true }
);

pendingOrderCheckoutSchema.index({ userId: 1, clientOrderRef: 1, status: 1 });

export default mongoose.model('PendingOrderCheckout', pendingOrderCheckoutSchema);
