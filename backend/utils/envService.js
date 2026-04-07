import EnvironmentVariable from '../models/EnvironmentVariable.js';
import { decrypt, isEncrypted } from './encryption.js';
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

// Cache for environment variables (cache for 5 minutes)
let envCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const normalize = (value) => String(value || '').trim();

const isLikelyRazorpayKeyId = (value) => {
  const key = normalize(value);
  // Razorpay key_id format examples: rzp_test_xxxxx / rzp_live_xxxxx
  return /^rzp_(test|live)_[A-Za-z0-9]{8,}$/.test(key);
};

/**
 * Get environment variable value from database
 * Falls back to process.env if not found in database
 * Automatically decrypts encrypted values
 * @param {string} key - Environment variable key
 * @param {string} defaultValue - Default value if not found
 * @returns {Promise<string>} Environment variable value (decrypted)
 */
export async function getEnvVar(key, defaultValue = '') {
  try {
    const envVars = await getAllEnvVars();
    let value = envVars[key] || process.env[key] || defaultValue;
    
    // Decrypt if encrypted (for direct access, toEnvObject already decrypts, but this is a safety check)
    if (value && isEncrypted(value)) {
      try {
        value = decrypt(value);
      } catch (error) {
        logger.warn(`Error decrypting ${key}: ${error.message}`);
        return defaultValue;
      }
    }
    
    return value;
  } catch (error) {
    logger.warn(`Error fetching env var ${key} from database, using process.env: ${error.message}`);
    return process.env[key] || defaultValue;
  }
}

/**
 * Get all environment variables from database
 * Uses caching to reduce database queries
 * @returns {Promise<Object>} Object containing all environment variables
 */
export async function getAllEnvVars() {
  try {
    // Check cache
    const now = Date.now();
    if (envCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
      return envCache;
    }

    // Fetch from database
    const envVars = await EnvironmentVariable.getOrCreate();
    const envData = envVars.toEnvObject();
    
    // Update cache
    envCache = envData;
    cacheTimestamp = now;
    
    return envData;
  } catch (error) {
    logger.error(`Error fetching environment variables from database: ${error.message}`);
    // Return empty object on error, will fallback to process.env in getEnvVar
    return {};
  }
}

/**
 * Clear environment variables cache
 * Call this after updating environment variables
 */
export function clearEnvCache() {
  envCache = null;
  cacheTimestamp = null;
  logger.info('Environment variables cache cleared');
}

/**
 * Get Razorpay credentials
 * @returns {Promise<Object>} { keyId, keySecret }
 */
export async function getRazorpayCredentials() {
  const dbApiKey = normalize(await getEnvVar('RAZORPAY_API_KEY'));
  const dbSecretKey = normalize(await getEnvVar('RAZORPAY_SECRET_KEY'));
  const envApiKey = normalize(process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_API_KEY || '');
  const envSecretKey = normalize(process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET_KEY || '');

  let keyId = '';
  if (isLikelyRazorpayKeyId(dbApiKey)) {
    keyId = dbApiKey;
  } else if (isLikelyRazorpayKeyId(envApiKey)) {
    if (dbApiKey) {
      logger.warn('Ignoring invalid RAZORPAY_API_KEY from DB; falling back to process.env RAZORPAY_KEY_ID');
    }
    keyId = envApiKey;
  } else {
    keyId = dbApiKey || envApiKey || '';
  }

  const keySecret = dbSecretKey || envSecretKey || '';

  return {
    keyId,
    keySecret
  };
}

/**
 * Get Cloudinary credentials
 * @returns {Promise<Object>} { cloudName, apiKey, apiSecret }
 */
export async function getCloudinaryCredentials() {
  return {
    cloudName: await getEnvVar('CLOUDINARY_CLOUD_NAME'),
    apiKey: await getEnvVar('CLOUDINARY_API_KEY'),
    apiSecret: await getEnvVar('CLOUDINARY_API_SECRET')
  };
}

/**
 * Get Firebase credentials
 * @returns {Promise<Object>} Firebase credentials object
 */
export async function getFirebaseCredentials() {
  return {
    apiKey: await getEnvVar('FIREBASE_API_KEY'),
    authDomain: await getEnvVar('FIREBASE_AUTH_DOMAIN'),
    storageBucket: await getEnvVar('FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: await getEnvVar('FIREBASE_MESSAGING_SENDER_ID'),
    appId: await getEnvVar('FIREBASE_APP_ID'),
    measurementId: await getEnvVar('MEASUREMENT_ID'),
    projectId: await getEnvVar('FIREBASE_PROJECT_ID'),
    clientEmail: await getEnvVar('FIREBASE_CLIENT_EMAIL'),
    privateKey: await getEnvVar('FIREBASE_PRIVATE_KEY')
  };
}

/**
 * Get SMTP credentials
 * @returns {Promise<Object>} { host, port, user, pass }
 */
export async function getSMTPCredentials() {
  return {
    host: await getEnvVar('SMTP_HOST'),
    port: await getEnvVar('SMTP_PORT'),
    user: await getEnvVar('SMTP_USER'),
    pass: await getEnvVar('SMTP_PASS')
  };
}

/**
 * Get Google Maps API Key
 * @returns {Promise<string>} Google Maps API Key
 */
export async function getGoogleMapsApiKey() {
  return await getEnvVar('VITE_GOOGLE_MAPS_API_KEY');
}

/**
 * Get PRP SMS Credentials
 * @returns {Promise<Object>} { apiKey, senderId, templateName }
 */
export async function getPRPSMSCredentials() {
  return {
    apiKey: await getEnvVar('PRPSMS_API_KEY'),
    senderId: await getEnvVar('PRPSMS_SENDER_ID'),
    templateName: await getEnvVar('PRPSMS_OTP_TEMPLATE')
  };
}
