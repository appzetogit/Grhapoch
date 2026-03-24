import mongoose from 'mongoose';

const serviceSettingsSchema = new mongoose.Schema(
  {
    serviceRadiusKm: {
      type: Number,
      default: 10,
      min: 0
    },
    baseDistance: {
      // Distance (km) covered by base fee
      type: Number,
      default: 2,
      min: 0
    },
    baseFee: {
      type: Number,
      default: 30,
      min: 0
    },
    perKmCharge: {
      type: Number,
      default: 5,
      min: 0
    },
    maxServiceDistance: {
      // Optional hard cap for delivery fee calculation (km)
      type: Number,
      default: null,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

serviceSettingsSchema.index({ createdAt: -1 });

// Ensure only one settings document exists
serviceSettingsSchema.statics.getSettings = async function () {
  try {
    let settings = await this.findOne();
    if (!settings) {
      settings = await this.create({
        serviceRadiusKm: 10,
        baseDistance: 2,
        baseFee: 30,
        perKmCharge: 5,
        maxServiceDistance: null
      });
    }

    let changed = false;
    const radiusNumber = Number(settings.serviceRadiusKm);
    if (!Number.isFinite(radiusNumber) || radiusNumber < 0) {
      settings.serviceRadiusKm = 10;
      changed = true;
    }
    const baseDistance = Number(settings.baseDistance);
    if (!Number.isFinite(baseDistance) || baseDistance < 0) {
      settings.baseDistance = 2;
      changed = true;
    }
    const baseFee = Number(settings.baseFee);
    if (!Number.isFinite(baseFee) || baseFee < 0) {
      settings.baseFee = 30;
      changed = true;
    }
    const perKmCharge = Number(settings.perKmCharge);
    if (!Number.isFinite(perKmCharge) || perKmCharge < 0) {
      settings.perKmCharge = 5;
      changed = true;
    }
    if (settings.maxServiceDistance !== null && settings.maxServiceDistance !== undefined) {
      const maxDistance = Number(settings.maxServiceDistance);
      if (!Number.isFinite(maxDistance) || maxDistance < 0) {
        settings.maxServiceDistance = null;
        changed = true;
      }
    }
    if (changed) {
      await settings.save();
    }

    return settings;
  } catch (error) {
    console.error('Error in ServiceSettings.getSettings:', error);
    let settings = await this.findOne();
    if (!settings) {
      settings = new this({
        serviceRadiusKm: 10,
        baseDistance: 2,
        baseFee: 30,
        perKmCharge: 5,
        maxServiceDistance: null
      });
      await settings.save();
    }
    return settings;
  }
};

export default mongoose.model('ServiceSettings', serviceSettingsSchema);
