import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    couponCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    discountPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    minOrderValue: {
      type: Number,
      required: true,
      default: 0
    },
    maxDiscountLimit: {
      type: Number,
      required: true,
      default: 0
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    restaurantScope: {
      type: String,
      enum: ["all", "specific"],
      default: "all"
    },
    restaurantIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant'
      }
    ],
    userScope: {
      type: String,
      enum: ["all", "first-time", "shared"],
      default: "all"
    },
    visibility: {
      showOnCheckout: {
        type: Boolean,
        default: true
      }
    },
    status: {
      type: String,
      enum: ["active", "expired", "disabled"],
      default: "active"
    }
  },
  {
    timestamps: true
  }
);

// Middleware to auto-mark expired coupons
couponSchema.pre('find', function() {
  const now = new Date();
  // This is a bit tricky with pre-find, usually better to handle in a background job 
  // or check during validation. But for a simple implementation, we can update status
  // when queried if we use a specific method or just check dates in logic.
});

const Coupon = mongoose.model('Coupon', couponSchema);
export default Coupon;
