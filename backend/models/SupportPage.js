import mongoose from 'mongoose';

const supportPageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: 'Support & FAQ',
      trim: true
    },
    description: {
      type: String,
      default: 'Welcome to support.',
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    footerText: {
      type: String,
      default: 'Our Support Team is available 24/7 to assist you.',
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes
supportPageSchema.index({ isActive: 1 });

export default mongoose.model('SupportPage', supportPageSchema);
