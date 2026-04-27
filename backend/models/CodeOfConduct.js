import mongoose from 'mongoose';

const codeOfConductSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: 'Code of Conduct',
      trim: true
    },
    content: {
      type: String,
      required: true,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },
    role: {
      type: String,
      enum: ['user', 'restaurant', 'delivery'],
      default: 'restaurant',
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
codeOfConductSchema.index({ isActive: 1 });
codeOfConductSchema.index({ role: 1 });

export default mongoose.model('CodeOfConduct', codeOfConductSchema);
