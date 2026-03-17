import axios from "axios";
import dotenv from "dotenv";

// Load environment variables if not already loaded
dotenv.config();

/**
 * PRP SMS Service (OTP)
 * Uses template-based API.
 */
class PRPSMSService {
  constructor() {
    this.baseUrl = "https://api.bulksmsadmin.com/BulkSMSapi/keyApiSendSMS/SendSmsTemplateName";
  }

  isConfigured() {
    const apiKey = process.env.PRPSMS_API_KEY?.trim();
    const senderId = process.env.PRPSMS_SENDER_ID?.trim();
    const templateName = process.env.PRPSMS_OTP_TEMPLATE?.trim();
    return Boolean(apiKey && senderId && templateName);
  }

  normalizePhoneNumber(phone) {
    if (!phone) return "";
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.length >= 10) {
      return digits.slice(-10);
    }
    return digits;
  }

  async sendOTP(phone, otp, purpose = "login") {
    // Dynamic import to avoid potential circular dependency with EnvironmentVariable model
    const { getPRPSMSCredentials } = await import('../utils/envService.js');
    const { apiKey, senderId, templateName } = await getPRPSMSCredentials();

    if (!apiKey || !senderId || !templateName) {
      throw new Error(
        "PRP SMS not configured. Please set PRPSMS_API_KEY, PRPSMS_SENDER_ID, PRPSMS_OTP_TEMPLATE in Admin Panel or .env"
      );
    }

    const normalizedPhone = this.normalizePhoneNumber(phone);
    if (!normalizedPhone || normalizedPhone.length !== 10) {
      throw new Error(`Invalid phone number: ${phone}`);
    }

    const payload = {
      sender: senderId,
      templateName,
      smsReciever: [
        {
          mobileNo: normalizedPhone,
          templateParams: String(otp)
        }
      ]
    };

    try {
      console.info("[PRPSMS] Sending OTP", {
        to: normalizedPhone,
        senderId,
        templateName,
        purpose
      });

      const response = await axios.post(this.baseUrl, payload, {
        headers: {
          apikey: apiKey,
          "Content-Type": "application/json"
        },
        timeout: 20000
      });

      const success = response.status >= 200 && response.status < 300;
      console.info("[PRPSMS] Response", {
        status: response.status,
        data: response.data
      });

      if (response.data && typeof response.data === "object") {
        const data = response.data;
        const hasExplicitFailure =
          data.success === false ||
          data.error ||
          data.errors ||
          (typeof data.status === "string" && data.status.toLowerCase().includes("fail"));

        if (hasExplicitFailure) {
          throw new Error(`PRPSMS rejected: ${JSON.stringify(data)}`);
        }
      }

      return {
        success,
        status: response.status,
        to: normalizedPhone,
        provider: "PRPSMS",
        response: response.data
      };
    } catch (error) {
      const status = error?.response?.status;
      const data = error?.response?.data;
      const message = error?.message || "PRPSMS error";
      console.error("[PRPSMS] Error", {
        status,
        message,
        data
      });
      throw new Error(
        `PRPSMS API error${status ? ` (${status})` : ""}: ${message}${data ? ` - ${JSON.stringify(data)}` : ""}`
      );
    }
  }
}

const prpSmsService = new PRPSMSService();
export default prpSmsService;
