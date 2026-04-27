import mongoose from 'mongoose';

const oneTimeCouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
      trim: true
    },
    discountType: {
      type: String,
      enum: ['FIXED'],
      default: 'FIXED'
    },
    value: {
      type: Number,
      required: true,
      min: 1
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    usageLimit: {
      type: Number,
      default: 1,
      min: 1
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    expiryDate: {
      type: Date,
      required: true,
      index: true
    },
    source: {
      type: String,
      default: 'mismatch',
      index: true
    },
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RestaurantComplaint',
      default: null,
      index: true
    },
    // Reservation (used for Razorpay pending checkouts)
    reservedByCheckoutId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PendingOrderCheckout',
      default: null,
      index: true
    },
    reservedAt: {
      type: Date,
      default: null
    },
    reservationExpiresAt: {
      type: Date,
      default: null,
      index: true
    },
    usedAt: {
      type: Date,
      default: null
    },
    usedOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true
    }
  },
  { timestamps: true }
);

oneTimeCouponSchema.index({ userId: 1, isActive: 1, expiryDate: 1 });

export default mongoose.model('OneTimeCoupon', oneTimeCouponSchema);
