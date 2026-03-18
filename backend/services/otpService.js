import Otp from '../models/Otp.js';
import prpSmsService from './prpSmsService.js';
import emailService from './emailService.js';
import { normalizePhoneNumber } from '../utils/phoneUtils.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const parseBooleanEnv = (value, fallback = false) => {
  if (typeof value !== 'string') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const parseIntEnv = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// Configurable OTP validity (defaults to 5 minutes)
const OTP_EXPIRY_MINUTES = parseIntEnv(process.env.OTP_EXPIRY_MINUTES, 5);
// Grace window to accept already-verified OTPs (defaults to 5 minutes)
const OTP_VERIFIED_GRACE_MINUTES = parseIntEnv(process.env.OTP_VERIFIED_GRACE_MINUTES, 5);

const getMockOTPValue = () => {
  const envOtp = process.env.MOCK_OTP_CODE?.trim();
  return envOtp && envOtp.length === 6 ? envOtp : '110211';
};

const isGlobalMockOTPEnabled = () => {
  // Safety: never allow global mock OTP in production
  if (process.env.NODE_ENV === 'production') return false;
  return parseBooleanEnv(process.env.ENABLE_MOCK_OTP, false);
};

/**
 * Generate a random 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * OTP Service
 * Handles OTP generation, storage, and verification
 * Supports both phone and email OTP
 */
class OTPService {
  /**
   * Generate and send OTP via phone or email
   * @param {string} phone - Phone number (optional if email provided)
   * @param {string} email - Email address (optional if phone provided)
   * @param {string} purpose - Purpose of OTP (login, register, etc.)
   * @returns {Promise<Object>}
   */
  async generateAndSendOTP(phone = null, purpose = 'login', email = null) {
    try {
      // Validate that either phone or email is provided
      if (!phone && !email) {
        throw new Error('Either phone or email must be provided');
      }

      const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;

      const identifier = normalizedPhone || email;
      const identifierType = normalizedPhone ? 'phone' : 'email';

      // Check rate limiting (max 3 OTPs per identifier per hour) - using MongoDB
      if (process.env.NODE_ENV === 'production') {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const rateLimitQuery = {
          [identifierType]: identifier,
          purpose,
          createdAt: { $gte: oneHourAgo }
        };

        const recentOtpCount = await Otp.countDocuments(rateLimitQuery);
        if (recentOtpCount >= 3) {
          throw new Error('Too many OTP requests. Please try again after some time.');
        }
      }

      const useMockOTP = isGlobalMockOTPEnabled();
      let otp = generateOTP();
      if (useMockOTP) {
        otp = getMockOTPValue();
      }
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      // Store OTP in database
      const otpData = {
        otp,
        purpose,
        expiresAt
      };
      if (normalizedPhone) otpData.phone = normalizedPhone;
      if (email) otpData.email = email;

      const otpRecord = await Otp.create(otpData);

      // Send OTP via SMS or Email
      try {
        if (useMockOTP) {
          logger.info('Mock OTP enabled, skipping send', {
            identifierType,
            identifier
          });
        } else if (phone) {
          await prpSmsService.sendOTP(phone, otp, purpose);
        } else if (email) {
          await emailService.sendOTP(email, otp, purpose);
        }
      } catch (sendError) {
        logger.error(`Failed to send OTP via ${phone ? 'SMS' : 'email'}: ${sendError.message}`);
        throw sendError;
      }

      logger.info(`OTP generated and sent to ${identifier} (${identifierType})`, {
        [identifierType]: identifier,
        purpose,
        otp,
        otpId: otpRecord._id
      });

      return {
        success: true,
        message: `OTP sent successfully to ${identifierType === 'phone' ? 'phone' : 'email'}`,
        expiresIn: 300, // 5 minutes in seconds
        identifierType,
        isMockOTP: useMockOTP
      };
    } catch (error) {
      logger.error(`Error generating OTP: ${error.message}`, {
        phone,
        email,
        purpose,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Verify OTP
   * @param {string} phone - Phone number (optional if email provided)
   * @param {string} otp - OTP code
   * @param {string} purpose - Purpose of OTP
   * @param {string} email - Email address (optional if phone provided)
   * @returns {Promise<Object>}
   */
  async verifyOTP(phone = null, otp, purpose = 'login', email = null) {
    try {
      // Validate that either phone or email is provided
      if (!phone && !email) {
        throw new Error('Either phone or email must be provided');
      }

      const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;
      const rawDigitsPhone = phone ? phone.replace(/\D/g, '') : null;
      const phoneVariants = Array.from(
        new Set([normalizedPhone, rawDigitsPhone].filter(Boolean))
      );

      const identifier = normalizedPhone || email;
      const identifierType = normalizedPhone ? 'phone' : 'email';

      // Allow mock OTP validation when enabled (dev/test only)
      if (isGlobalMockOTPEnabled() && otp === getMockOTPValue()) {
        logger.info('Mock OTP verified', {
          identifierType,
          identifier,
          purpose
        });
        return {
          success: true,
          message: 'OTP verified successfully'
        };
      }

      // Verify OTP from database
      // For reset-password purpose, allow already-verified OTPs within 10 minutes
      let otpRecord;

      if (purpose === 'reset-password' || purpose === 'login' || purpose === 'register') {
        // First try to find unverified OTP
        const unverifiedQuery = {
          otp,
          purpose,
          verified: false,
          expiresAt: { $gt: new Date() }
        };
        if (phoneVariants.length) unverifiedQuery.phone = { $in: phoneVariants };
        if (email) unverifiedQuery.email = email;

        otpRecord = await Otp.findOne(unverifiedQuery);

        // If not found, check for already-verified OTP within last 5 minutes
        if (!otpRecord) {
          const graceWindow = new Date(Date.now() - OTP_VERIFIED_GRACE_MINUTES * 60 * 1000);
          const verifiedQuery = {
            otp,
            purpose,
            verified: true,
            expiresAt: { $gt: new Date() },
            updatedAt: { $gt: graceWindow }
          };
          if (phoneVariants.length) verifiedQuery.phone = { $in: phoneVariants };
          if (email) verifiedQuery.email = email;

          otpRecord = await Otp.findOne(verifiedQuery);

          if (otpRecord) {
            // OTP already verified and still valid (within 5 minutes)
            return {
              success: true,
              message: 'OTP verified successfully'
            };
          }
        }
      } else {
        // For other purposes, only check unverified OTPs
        const query = {
          otp,
          purpose,
          verified: false,
          expiresAt: { $gt: new Date() }
        };
        if (phone) query.phone = phone;
        if (email) query.email = email;

        otpRecord = await Otp.findOne(query);
      }

      if (!otpRecord) {
        // Increment attempts for security (only for unverified OTPs)
        const incrementQuery = { purpose, verified: false };
        if (phone) incrementQuery.phone = phone;
        if (email) incrementQuery.email = email;

        await Otp.updateMany(
          incrementQuery,
          { $inc: { attempts: 1 } }
        );

        throw new Error('Invalid or expired OTP');
      }

      // Check attempts
      if (otpRecord.attempts >= 5) {
        throw new Error('Too many failed attempts. Please request a new OTP.');
      }

      // Mark as verified
      otpRecord.verified = true;
      await otpRecord.save();

      logger.info(`OTP verified successfully for ${identifier} (${identifierType})`, {
        [identifierType]: identifier,
        purpose
      });

      return {
        success: true,
        message: 'OTP verified successfully'
      };
    } catch (error) {
      logger.error(`Error verifying OTP: ${error.message}`, {
        phone,
        email,
        purpose,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Resend OTP
   * @param {string} phone - Phone number (optional if email provided)
   * @param {string} purpose - Purpose of OTP
   * @param {string} email - Email address (optional if phone provided)
   * @returns {Promise<Object>}
   */
  async resendOTP(phone = null, purpose = 'login', email = null) {
    return await this.generateAndSendOTP(phone, purpose, email);
  }
}

export default new OTPService();
