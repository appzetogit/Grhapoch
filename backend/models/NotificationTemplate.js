import mongoose from 'mongoose';

const notificationTemplateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true
    },
    audience: {
      type: String,
      enum: ['user', 'restaurant', 'delivery'],
      required: true
    },
    channel: {
      type: String,
      enum: ['push'],
      default: 'push'
    },
    language: {
      type: String,
      default: 'default',
      trim: true
    },
    title: {
      type: String,
      required: true
    },
    body: {
      type: String,
      required: true
    },
    enabled: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    }
  },
  { timestamps: true }
);

notificationTemplateSchema.index(
  { key: 1, audience: 1, channel: 1, language: 1 },
  { unique: true }
);

const NotificationTemplate = mongoose.model('NotificationTemplate', notificationTemplateSchema);

export default NotificationTemplate;
