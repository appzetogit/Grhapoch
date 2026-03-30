import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button";
import { restaurantAPI } from "@/lib/api";
import { setAuthData as setRestaurantAuthData } from "@/lib/utils/auth";
import { checkOnboardingStatus } from "../../utils/onboardingUtils";

export default function RestaurantOTP() {
  const navigate = useNavigate();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [authData, setAuthData] = useState(null);
  const [contactInfo, setContactInfo] = useState(""); // Can be phone or email
  const [contactType, setContactType] = useState("phone"); // "phone" or "email"
  const [focusedIndex, setFocusedIndex] = useState(null);
  const inputRefs = useRef([]);

  useEffect(() => {
    // Get auth data from sessionStorage
    const stored = sessionStorage.getItem("restaurantAuthData");
    if (stored) {
      const data = JSON.parse(stored);
      setAuthData(data);

      // Handle both phone and email
      if (data.method === "email" && data.email) {
        setContactType("email");
        setContactInfo(data.email);
      } else if (data.phone) {
        setContactType("phone");
        // Extract and format phone number for display
        const phoneMatch = data.phone?.match(/(\+\d+)\s*(.+)/);
        if (phoneMatch) {
          const formattedPhone = `${phoneMatch[1]}-${phoneMatch[2].replace(/\D/g, "")}`;
          setContactInfo(formattedPhone);
        } else {
          setContactInfo(data.phone || "");
        }
      }
    } else {
      // No auth data, redirect to login
      navigate("/restaurant/login");
      return;
    }

    // Start resend timer (60 seconds)
    setResendTimer(60);
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  useEffect(() => {
    // Focus first input on mount with a small delay to ensure page transition is complete
    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Auto-clear error after 3 seconds
    if (error) {
      const timer = setTimeout(() => {
        setError("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (newOtp.every((digit) => digit !== "") && newOtp.length === 6) {
      handleVerify(newOtp.join(""));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (otp[index]) {
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
      }
    }
    // Handle paste
    if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, "").slice(0, 6).split("");
        const newOtp = [...otp];
        digits.forEach((digit, i) => {
          if (i < 6) {
            newOtp[i] = digit;
          }
        });
        setOtp(newOtp);
        if (digits.length === 6) {
          handleVerify(newOtp.join(""));
        } else {
          inputRefs.current[digits.length]?.focus();
        }
      });
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    const digits = pastedData.replace(/\D/g, "").slice(0, 6).split("");
    const newOtp = [...otp];
    digits.forEach((digit, i) => {
      if (i < 6) {
        newOtp[i] = digit;
      }
    });
    setOtp(newOtp);
    if (digits.length === 6) {
      handleVerify(newOtp.join(""));
      return;
    } else {
      inputRefs.current[digits.length]?.focus();
    }
  };

  const handleVerify = async (otpValue = null) => {
    const code = otpValue || otp.join("");

    if (code.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      if (!authData) {
        throw new Error("Session expired. Please try logging in again.");
      }

      const phone = authData.method === "phone" ? authData.phone : null;
      const email = authData.method === "email" ? authData.email : null;
      const purpose = authData.isSignUp ? "register" : "login";
      const rawName = authData?.name || authData?.restaurantName;
      const nameToSend = rawName ? rawName.toString().trim() : "";
      const normalizedName = nameToSend || null;
      const fallbackRegistrationName = "New Restaurant";
      // Always provide a fallback name so backend can auto-register new numbers
      // in a single OTP verification call (avoids OTP re-use on retry).
      const nameForRequest = normalizedName || fallbackRegistrationName;

      const response = await restaurantAPI.verifyOTP(
        phone,
        code,
        purpose,
        nameForRequest,
        email,
        authData?.businessModel || "Commission Base"
      );

      const data = response?.data?.data || response?.data;

      // Defensive fallback: backend asked for name unexpectedly.
      if (data?.needsName) {
        throw new Error("Unable to continue. Please request a new OTP and try again.");
      }

      const accessToken = data?.accessToken;
      const restaurant = data?.restaurant;

      if (accessToken && restaurant) {
        setRestaurantAuthData("restaurant", accessToken, restaurant);
        window.dispatchEvent(new Event("restaurantAuthChanged"));
        sessionStorage.removeItem("restaurantAuthData");
        localStorage.removeItem("pendingRestaurantRegistration");

        setTimeout(async () => {
          const onboardingCompleted =
            restaurant?.onboardingCompleted === true ||
            Number(restaurant?.onboarding?.completedSteps || 0) >= 5;
          const subscriptionStatus = String(restaurant?.subscription?.status || "").toLowerCase();
          const hasActiveSubscription = subscriptionStatus === "active";

          // Skip onboarding status API call when onboarding is already complete.
          if (onboardingCompleted || hasActiveSubscription) {
            navigate("/restaurant/to-hub", { replace: true });
            return;
          }

          try {
            const incompleteStep = await checkOnboardingStatus();
            if (incompleteStep) {
              navigate(`/restaurant/onboarding?step=${incompleteStep}`, { replace: true });
            } else {
              navigate("/restaurant/to-hub", { replace: true });
            }
          } catch {
            navigate("/restaurant/to-hub", { replace: true });
          }
        }, 500);
      }
    } catch (err) {
      const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      "Invalid OTP. Please try again.";
      setError(message);
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 50);
    } finally {
      setIsLoading(false);
    }
  };


  const handleResend = async () => {
    if (resendTimer > 0) return;

    setIsLoading(true);
    setError("");

    try {
      if (!authData) {
        throw new Error("Session expired. Please go back and try again.");
      }

      const purpose = authData.isSignUp ? "register" : "login";
      const phone = authData.method === "phone" ? authData.phone : null;
      const email = authData.method === "email" ? authData.email : null;

      const otpResponse = await restaurantAPI.sendOTP(phone, purpose, email);
      const expiresInRaw = otpResponse?.data?.data?.expiresIn ?? otpResponse?.data?.expiresIn;
      const otpExpiresIn = Number.isFinite(Number(expiresInRaw)) ? Number(expiresInRaw) : null;
      const otpExpiresInMs = otpExpiresIn ? otpExpiresIn * 1000 : null;
      const otpGeneratedAt = Date.now();

      const storedAuth = sessionStorage.getItem("restaurantAuthData");
      if (storedAuth) {
        try {
          const parsed = JSON.parse(storedAuth);
          const merged = {
            ...parsed,
            otpGeneratedAt,
            otpExpiresIn: otpExpiresIn || parsed.otpExpiresIn,
            otpExpiresInMs: otpExpiresInMs || parsed.otpExpiresInMs
          };
          sessionStorage.setItem("restaurantAuthData", JSON.stringify(merged));
        } catch {
          // Ignore storage errors
        }
      }

      const pendingRaw = localStorage.getItem("pendingRestaurantRegistration");
      if (pendingRaw) {
        try {
          const pending = JSON.parse(pendingRaw);
          const merged = {
            ...pending,
            otpGeneratedAt: pending.otpGeneratedAt ?? otpGeneratedAt,
            otpExpiresIn: pending.otpExpiresIn ?? otpExpiresIn,
            otpExpiresInMs: pending.otpExpiresInMs ?? otpExpiresInMs
          };
          localStorage.setItem("pendingRestaurantRegistration", JSON.stringify(merged));
        } catch {
          // Ignore storage errors
        }
      }
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to resend OTP. Please try again.";
      setError(message);
    }

    setResendTimer(60);
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setIsLoading(false);
    setOtp(["", "", "", "", "", ""]);
    inputRefs.current[0]?.focus();
  };

  const isOtpComplete = otp.every((digit) => digit !== "");

  if (!authData) {
    return null;
  }

  return (
    <div className="max-h-screen h-screen bg-white flex flex-col">
      {/* Header with Back Button and Title */}
      <div className="relative flex items-center justify-center py-4 px-4">
        <button
          onClick={() => navigate("/restaurant/login")}
          className="absolute left-4 top-1/2 -translate-y-1/2"
          aria-label="Go back">
          
          <ArrowLeft className="h-5 w-5 text-black" />
        </button>
        <h2 className="text-lg font-bold text-black">Verify details</h2>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col px-6 overflow-y-auto">
        <div className="w-full max-w-md mx-auto space-y-8 py-8">
          {/* Instruction Text */}
          <div className="text-center">
            <p className="text-base text-gray-900 leading-relaxed">
              Enter OTP sent on <span className="font-semibold">{contactInfo}</span>. Do not share OTP with anyone.
            </p>
          </div>

          {/* OTP Input Fields */}
          <div className="flex justify-center gap-2 sm:gap-4">
            {otp.map((digit, index) => (
              <Input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                disabled={isLoading}
                autoComplete="off"
                autoFocus={index === 0}
                className={`w-12 h-12 text-center text-lg font-semibold p-0 border border-gray-300 rounded-lg focus-visible:ring-2 focus-visible:ring-blue-600 bg-white transition-opacity ${
                  isLoading ? "opacity-50" : "opacity-100"
                }`}
              />
            ))}
          </div>

          {/* Error Message */}
          {error &&
          <div className="text-center">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          }

          {/* Resend OTP Timer */}
          <div className="text-center">
            {resendTimer > 0 ? (
              <p className="text-sm text-gray-900">
                Resend OTP in <span className="font-semibold">{resendTimer} secs</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isLoading}
                className="text-sm text-blue-600 hover:underline font-medium disabled:opacity-50"
              >
                Resend OTP
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section - Continue Button */}
          <div className="px-6 pb-8 pt-4">
            <div className="w-full max-w-md mx-auto">
              <Button
                onClick={() => handleVerify()}
                disabled={isLoading || !isOtpComplete}
                className={`w-full h-12 rounded-lg font-bold text-base transition-colors ${
                  !isLoading && isOtpComplete
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}>
                
                {isLoading ? "Verifying..." : "Continue"}
              </Button>
            </div>
          </div>
    </div>);

}
