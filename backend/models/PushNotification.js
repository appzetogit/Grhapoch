import mongoose from 'mongoose';

const pushNotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Zone',
      default: null // null means "All"
    },
    zoneName: {
      type: String,
      default: 'All'
    },
    sendTo: {
      type: String,
      enum: ['Customer', 'Delivery Man', 'Restaurant'],
      required: true
    },
    banner: {
      type: String,
      default: null
    },
    description: {
      type: String,
      required: true
    },
    status: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    }
  },
  {
    timestamps: true
  }
);

const PushNotification = mongoose.model('PushNotification', pushNotificationSchema);

export default PushNotification;
