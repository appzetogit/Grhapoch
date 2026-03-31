import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { deleteUserAdvertisements } from '../services/userAdvertisementCleanupService.js';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    // Phone is required only if email and googleId are not provided
    required: function () {
      return !this.email && !this.googleId;
    },
    trim: true
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  password: {
    type: String,
    select: false // Don't return password by default
  },
  googleId: {
    type: String
  },
  googleEmail: {
    type: String,
    sparse: true
  },
  role: {
    type: String,
    enum: ['user', 'restaurant', 'delivery', 'admin'],
    default: 'user'
  },
  signupMethod: {
    type: String,
    enum: ['google', 'phone', 'email'],
    default: null
  },
  profileImage: {
    type: String
  },
  dateOfBirth: {
    type: Date
  },
  anniversary: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say']
  },
  addresses: [{
    label: {
      type: String,
      enum: ['Home', 'Office', 'Other', 'Current Location']
    },
    street: String,
    additionalDetails: String,
    city: String,
    state: String,
    zipCode: String,
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0]
      }
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  }],
  paymentMethods: [{
    type: {
      type: String,
      enum: ['card', 'upi', 'netbanking', 'wallet']
    },
    details: mongoose.Schema.Types.Mixed, // Encrypted
    isDefault: {
      type: Boolean,
      default: false
    }
  }],
  preferences: {
    vegMode: {
      type: Boolean,
      default: false
    },
    language: {
      type: String,
      default: 'en'
    },
    notifications: {
      orders: {
        type: Boolean,
        default: true
      },
      offers: {
        type: Boolean,
        default: true
      },
      updates: {
        type: Boolean,
        default: true
      }
    }
  },
  collections: {
    restaurants: [{
      restaurantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant'
      },
      name: String,
      image: String,
      slug: String,
      cuisine: String,
      rating: Number,
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    dishes: [{
      dishId: String,
      restaurantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant'
      },
      name: String,
      price: Number,
      image: String,
      foodType: String,
      restaurantName: String,
      restaurantSlug: String,
      addedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  wallet: {
    balance: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'INR'
    }
  },
  goldMembership: {
    isActive: {
      type: Boolean,
      default: false
    },
    startDate: Date,
    endDate: Date
  },
  currentLocation: {
    latitude: {
      type: Number
    },
    longitude: {
      type: Number
    },
    address: {
      type: String
    },
    city: {
      type: String
    },
    state: {
      type: String
    },
    area: {
      type: String
    },
    formattedAddress: {
      type: String
    },
    accuracy: {
      type: Number // GPS accuracy in meters
    },
    postalCode: {
      type: String // Pincode
    },
    street: {
      type: String
    },
    streetNumber: {
      type: String
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude] for GeoJSON
        default: [0, 0]
      }
    }
  },
  // FCM push notification token (web browser)
  fcmTokenWeb: {
    type: String,
    default: ''
  },
  // FCM push notification token (android app)
  fcmTokenAndroid: {
    type: String,
    default: ''
  },
  // FCM push notification token (ios app)
  fcmTokenIos: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
// Compound unique indexes to allow same email/phone for different roles
// But prevent duplicate email+role or phone+role combinations
// Use partial index to only index non-null emails to avoid duplicate key errors with null emails
userSchema.index(
  { email: 1, role: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $exists: true, $type: 'string' } }
  }
);
userSchema.index(
  { phone: 1, role: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $exists: true, $type: 'string' } }
  }
);
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
userSchema.index({ 'addresses.location': '2dsphere' });
userSchema.index({ 'currentLocation.location': '2dsphere' }); // GeoJSON index for current location queries
// Note: Single-field indexes on email/phone removed - compound indexes {email:1,role:1} and {phone:1,role:1} can serve as prefixes
userSchema.index({ role: 1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

const safeCleanupUserAdvertisements = async (userId) => {
  if (!userId) return;
  try {
    await deleteUserAdvertisements(userId);
  } catch (error) {
    console.warn(`[User Model] Failed to cleanup advertisements for user ${userId}:`, error.message);
  }
};

userSchema.pre('findOneAndDelete', async function (next) {
  this._userToDelete = await this.model.findOne(this.getFilter()).select('_id').lean();
  next();
});

userSchema.post('findOneAndDelete', async function (doc) {
  const targetUserId = doc?._id || this._userToDelete?._id;
  if (!targetUserId) return;
  await safeCleanupUserAdvertisements(targetUserId);
});

userSchema.post('deleteOne', { document: true, query: false }, async function () {
  if (!this?._id) return;
  await safeCleanupUserAdvertisements(this._id);
});

userSchema.pre('deleteOne', { document: false, query: true }, async function (next) {
  this._usersToDelete = await this.model.find(this.getFilter()).select('_id').lean();
  next();
});

userSchema.post('deleteOne', { document: false, query: true }, async function () {
  const users = Array.isArray(this._usersToDelete) ? this._usersToDelete : [];
  for (const user of users) {
    await safeCleanupUserAdvertisements(user._id);
  }
});

userSchema.pre('deleteMany', async function (next) {
  this._usersToDelete = await this.model.find(this.getFilter()).select('_id').lean();
  next();
});

userSchema.post('deleteMany', async function () {
  const users = Array.isArray(this._usersToDelete) ? this._usersToDelete : [];
  for (const user of users) {
    await safeCleanupUserAdvertisements(user._id);
  }
});

const User = mongoose.model('User', userSchema);

export default User;

