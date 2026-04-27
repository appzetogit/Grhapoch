import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Mail, Phone, AlertCircle, Loader2 } from "lucide-react";
import AnimatedPage from "../../components/AnimatedPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { authAPI } from "@/lib/api";
import { firebaseAuth, googleProvider, ensureFirebaseInitialized } from "@/lib/firebase";
import { FlutterGoogleSignInError, isFlutterInAppWebView, signInWithFlutterGoogle } from "@/lib/flutterGoogleSignIn";
import { setAuthData } from "@/lib/utils/auth";
import loginBanner from "@/assets/loginbanner.png";

const GOOGLE_AUTH_PENDING_KEY = "user_google_auth_pending";
const SIGNIN_PREFILL_ONCE_KEY = "userSignInPrefillOnce";
let googleAuthPendingFallback = false;

// India is the only supported country code
const countryCodeDetails = { code: "+91", country: "IN", fullName: "India", flag: "🇮🇳", length: 10 };

export default function SignIn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSignUp = searchParams.get("mode") === "signup";

  const [authMethod, setAuthMethod] = useState("phone"); // "phone" or "email"
  const [formData, setFormData] = useState({
    phone: "",
    countryCode: "+91",
    email: "",
    name: "",
    rememberMe: false
  });
  const [errors, setErrors] = useState({
    phone: "",
    email: "",
    name: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const redirectHandledRef = useRef(false);

  const markGoogleAuthPending = () => {
    googleAuthPendingFallback = true;
    try {
      sessionStorage.setItem(GOOGLE_AUTH_PENDING_KEY, "1");
    } catch (storageError) {
      // storage unavailable
    }
  };
  const clearGoogleAuthPending = () => {
    googleAuthPendingFallback = false;
    try {
      sessionStorage.removeItem(GOOGLE_AUTH_PENDING_KEY);
    } catch (storageError) {
      // storage unavailable
    }
  };
  const isGoogleAuthPending = () => {
    try {
      return sessionStorage.getItem(GOOGLE_AUTH_PENDING_KEY) === "1";
    } catch (storageError) {
      return googleAuthPendingFallback;
    }
  };

  // Helper function to process signed-in user
  const processSignedInUser = useCallback(async (user, source = "unknown") => {
    if (redirectHandledRef.current) {
      return;
    }

    redirectHandledRef.current = true;
    setIsLoading(true);
    setApiError("");

    try {
      if (!user) {
        throw new Error("Google user not available");
      }

      // Get Firebase ID token for backend verification.
      const idToken = await user.getIdToken();
      if (!idToken) {
        throw new Error("Failed to get Firebase ID token");
      }

      const response = await authAPI.firebaseGoogleLogin(idToken, "user");
      const data = response?.data?.data || {};

      const accessToken = data.accessToken;
      const appUser = data.user;

      if (accessToken && appUser) {
        clearGoogleAuthPending();
        setAuthData("user", accessToken, appUser);
        window.dispatchEvent(new Event("userAuthChanged"));

        // Clear any URL hash or params
        const hasHash = window.location.hash.length > 0;
        const hasQueryParams = window.location.search.length > 0;
        if (hasHash || hasQueryParams) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        navigate("/user", { replace: true });
      } else {
        console.error(`❌ Invalid backend response from ${source}`);
        redirectHandledRef.current = false;
        setIsLoading(false);
        setApiError("Invalid response from server. Please try again.");
      }
    } catch (error) {
      console.error(`❌ Error processing user from ${source}:`, error);
      redirectHandledRef.current = false;
      setIsLoading(false);

      let errorMessage = "Failed to complete sign-in. Please try again.";
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      setApiError(errorMessage);
      clearGoogleAuthPending();
    }
  }, [navigate]);

  // Handle Firebase redirect result in a single deterministic flow.
  useEffect(() => {
    if (redirectHandledRef.current) return;

    let isCancelled = false;
    let unsubscribeAuthState;

    const handleRedirectResult = async () => {
      try {
        ensureFirebaseInitialized();
        const { onAuthStateChanged } = await import("firebase/auth");

        // Only process an existing Firebase user when Google auth was explicitly initiated.
        if (isGoogleAuthPending()) {
          const signedInUser = firebaseAuth.currentUser;
          if (signedInUser && !redirectHandledRef.current && !isCancelled) {
            await processSignedInUser(signedInUser, "current-user-check");
            return;
          }
        }

        if (!isCancelled) {
          unsubscribeAuthState = onAuthStateChanged(firebaseAuth, async (authUser) => {
            if (isCancelled || redirectHandledRef.current || !authUser || !isGoogleAuthPending()) return;
            await processSignedInUser(authUser, "auth-state-fallback");
          });
          setIsLoading(false);
        }
      } catch (error) {
        if (isCancelled) return;
        console.error("❌ Google sign-in auth state error:", error);
        redirectHandledRef.current = false;
        clearGoogleAuthPending();
        setApiError(error?.message || "Google sign-in failed. Please try again.");
        setIsLoading(false);
      }
    };

    handleRedirectResult();

    const prefillOnce = sessionStorage.getItem(SIGNIN_PREFILL_ONCE_KEY);
    if (prefillOnce) {
      try {
        const parsedPrefill = JSON.parse(prefillOnce);
        if (parsedPrefill?.method === "phone" && parsedPrefill?.phone) {
          const parts = parsedPrefill.phone.split(" ");
          if (parts.length >= 2) {
            setFormData(prev => ({
              ...prev,
              countryCode: parts[0],
              phone: parts[1]
            }));
            setAuthMethod("phone");
          }
        }
      } catch (err) {
        console.error("Error parsing one-time sign-in prefill:", err);
      } finally {
        sessionStorage.removeItem(SIGNIN_PREFILL_ONCE_KEY);
      }
    }

    const storedData = sessionStorage.getItem("userAuthData");
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);
        if (parsedData.method === "phone" && parsedData.phone) {
          const parts = parsedData.phone.split(" ");
          if (parts.length >= 2) {
            setFormData(prev => ({
              ...prev,
              countryCode: parts[0],
              phone: parts[1],
              name: parsedData.name || prev.name
            }));
          }
          setAuthMethod("phone");
        } else if (parsedData.method === "email" && parsedData.email) {
          setFormData(prev => ({
            ...prev,
            email: parsedData.email,
            name: parsedData.name || prev.name
          }));
          setAuthMethod("email");
        }
      } catch (err) {
        console.error("Error parsing stored auth data:", err);
      } finally {
        sessionStorage.removeItem("userAuthData");
      }
    }

    return () => {
      isCancelled = true;
      if (typeof unsubscribeAuthState === "function") {
        unsubscribeAuthState();
      }
    };
  }, [processSignedInUser]);

  const selectedCountry = countryCodeDetails;

  const validateEmail = (email) => {
    if (!email.trim()) {
      return "Email is required";
    }
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(email.trim())) {
      return "Please enter a valid email address";
    }
    return "";
  };

  const validatePhone = (phone, countryCode) => {
    if (!phone || phone.trim() === "") {
      return "Phone number is required";
    }
    const digitsOnly = phone.replace(/\D/g, "");
    const requiredLength = selectedCountry.length || 10;
    if (digitsOnly.length < requiredLength) {
      return `Phone number must be exactly ${requiredLength} digits`;
    }
    if (digitsOnly.length > requiredLength) {
      return `Phone number cannot exceed ${requiredLength} digits`;
    }
    if (countryCode === "+91") {
      const firstDigit = digitsOnly[0];
      if (!["6", "7", "8", "9"].includes(firstDigit)) {
        return "Invalid Indian mobile number";
      }
    }
    return "";
  };

  const validateName = (name) => {
    if (!name.trim()) {
      return "Name is required";
    }
    if (name.trim().length < 2) {
      return "Name must be at least 2 characters";
    }
    if (name.trim().length > 50) {
      return "Name must be less than 50 characters";
    }
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (!nameRegex.test(name.trim())) {
      return "Name can only contain letters, spaces, hyphens, and apostrophes";
    }
    return "";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "phone") {
      const requiredLength = selectedCountry.length || 10;
      const numericValue = value.replace(/\D/g, "").slice(0, requiredLength);
      setFormData({ ...formData, [name]: numericValue });
      if (errors.phone && numericValue.length === requiredLength) {
        const error = validatePhone(numericValue, formData.countryCode);
        setErrors({ ...errors, phone: error });
      }
      return;
    }
    setFormData({ ...formData, [name]: value });
    if (name === "email") {
      setErrors({ ...errors, email: validateEmail(value) });
    } else if (name === "name") {
      setErrors({ ...errors, name: validateName(value) });
    }
  };

  const isPhoneValid = !validatePhone(formData.phone, formData.countryCode);
  const isEmailValid = !validateEmail(formData.email);
  const isNameValid = !isSignUp || !validateName(formData.name);
  const canContinue = authMethod === "phone" ? isPhoneValid : (isEmailValid && isNameValid);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setApiError("");

    let hasErrors = false;
    const newErrors = { phone: "", email: "", name: "" };

    if (authMethod === "phone") {
      const phoneError = validatePhone(formData.phone, formData.countryCode);
      newErrors.phone = phoneError;
      if (phoneError) hasErrors = true;
    } else {
      const emailError = validateEmail(formData.email);
      newErrors.email = emailError;
      if (emailError) hasErrors = true;
    }

    if (isSignUp) {
      const nameError = validateName(formData.name);
      newErrors.name = nameError;
      if (nameError) hasErrors = true;
    }

    setErrors(newErrors);
    if (hasErrors) {
      setIsLoading(false);
      return;
    }

    try {
      const purpose = isSignUp ? "register" : "login";
      const fullPhone = authMethod === "phone" ? `${formData.countryCode} ${formData.phone}`.trim() : null;
      const email = authMethod === "email" ? formData.email.trim() : null;

      await authAPI.sendOTP(fullPhone, purpose, email);

      const authData = {
        method: authMethod,
        phone: fullPhone,
        email: email,
        name: isSignUp ? formData.name.trim() : null,
        isSignUp,
        module: "user"
      };
      sessionStorage.setItem("userAuthData", JSON.stringify(authData));
      navigate("/user/auth/otp");
    } catch (error) {
      const message = error?.response?.data?.message || "Failed to send OTP. Please try again.";
      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setApiError("");
    setIsLoading(true);
    redirectHandledRef.current = false;
    markGoogleAuthPending();

    try {
      ensureFirebaseInitialized();
      if (!firebaseAuth) {
        throw new Error("Firebase Auth is not initialized.");
      }
      const { signInWithPopup } = await import("firebase/auth");
      if (isFlutterInAppWebView()) {
        try {
          const flutterUser = await signInWithFlutterGoogle(firebaseAuth);
          if (flutterUser) {
            await processSignedInUser(flutterUser, "flutter-native-bridge");
            return;
          }
        } catch (flutterError) {
          if (flutterError?.code === "missing_token") {
            throw new Error("Google sign-in failed. Please try again.");
          }
        }
      }
      const popupResult = await signInWithPopup(firebaseAuth, googleProvider);
      const popupUser = popupResult?.user || firebaseAuth.currentUser;
      if (popupUser) {
        await processSignedInUser(popupUser, "popup-result");
      }
    } catch (error) {
      setIsLoading(false);
      redirectHandledRef.current = false;
      let message = "Google sign-in failed. Please try again.";
      if (error?.code === "auth/popup-blocked") {
        message = "Popup was blocked. Please allow popups.";
      } else if (error?.code === "auth/popup-closed-by-user") {
        message = "Sign-in was cancelled.";
      }
      setApiError(message);
      clearGoogleAuthPending();
    }
  };

  const handleLoginMethodChange = () => {
    setAuthMethod(authMethod === "email" ? "phone" : "email");
    setApiError("");
  };

  return (
    <AnimatedPage className="min-h-screen flex flex-col bg-white dark:bg-[#0a0a0a] !pb-0 md:flex-row">
      <div className="relative md:hidden w-full shrink-0 bg-[#cb202d]" style={{ height: "42vh", minHeight: "320px" }}>
        <img src={loginBanner} alt="Food Banner" className="w-full h-full object-cover object-center" />
      </div>

      <div className="relative hidden md:block w-full shrink-0 md:w-1/2 md:h-screen md:sticky md:top-0">
        <img src={loginBanner} alt="Food Banner" className="w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-transparent" />
      </div>

      <div className="bg-white dark:bg-[#1a1a1a] -mt-10 rounded-t-[2.5rem] md:rounded-t-none relative z-10 p-5 sm:p-6 md:p-8 lg:p-10 md:w-1/2 md:flex md:items-center md:justify-center md:min-h-screen">
        <div className="max-w-md lg:max-w-lg xl:max-w-xl mx-auto space-y-6 md:space-y-8 lg:space-y-10 w-full pt-2 md:pt-0">
          <div className="text-center space-y-2 md:space-y-3">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-black dark:text-white leading-tight">
              India's #1 Food Delivery and Dining App
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-400">Log in or sign up</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
            {isSignUp && (
              <div className="space-y-2">
                <Input
                  id="name"
                  name="name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`text-base md:text-lg h-12 md:h-14 bg-white dark:bg-[#1a1a1a] text-black dark:text-white ${errors.name ? "border-red-500" : "border-gray-300 dark:border-gray-700"}`}
                />
                {errors.name && <div className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-3 w-3" /><span>{errors.name}</span></div>}
              </div>
            )}

            {authMethod === "phone" ? (
              <div className="space-y-2">
                <div className="flex gap-2 items-stretch">
                  <div className="w-[100px] md:w-[120px] h-12 md:h-14 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] rounded-lg flex items-center justify-center gap-2 select-none">
                    <span className="flex items-center gap-2 text-sm md:text-base"><span>{selectedCountry.flag}</span><span>{selectedCountry.code}</span></span>
                  </div>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="Enter Phone Number"
                    value={formData.phone}
                    onChange={handleChange}
                    className={`flex-1 h-12 md:h-14 text-base md:text-lg bg-white dark:bg-[#1a1a1a] text-black dark:text-white border-gray-300 dark:border-gray-700 rounded-lg ${errors.phone ? "border-red-500" : ""}`}
                  />
                </div>
                {errors.phone && <div className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-3 w-3" /><span>{errors.phone}</span></div>}
                {apiError && authMethod === "phone" && <div className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-3 w-3" /><span>{apiError}</span></div>}
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full h-12 md:h-14 text-base md:text-lg bg-white dark:bg-[#1a1a1a] text-black dark:text-white border-gray-300 dark:border-gray-700 rounded-lg ${errors.email ? "border-red-500" : ""}`}
                />
                {errors.email && <div className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-3 w-3" /><span>{errors.email}</span></div>}
                {apiError && authMethod === "email" && <div className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-3 w-3" /><span>{apiError}</span></div>}
                <button type="button" onClick={() => setAuthMethod("phone")} className="text-xs text-[#E23744] hover:underline text-left">Use phone instead</button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="rememberMe"
                checked={formData.rememberMe}
                onCheckedChange={(checked) => setFormData({ ...formData, rememberMe: checked })}
                className="w-4 h-4 border-2 border-gray-300 rounded data-[state=checked]:bg-[#E23744] data-[state=checked]:border-[#E23744]"
              />
              <label htmlFor="rememberMe" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">Remember my login for faster sign-in</label>
            </div>

            <Button
              type="submit"
              className={`w-full h-12 md:h-14 font-bold text-base md:text-lg rounded-lg ${canContinue && !isLoading ? "bg-[#E23744] hover:bg-[#d32f3d] text-white" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}
              disabled={!canContinue || isLoading}
            >
              {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isSignUp ? "Creating Account..." : "Signing In..."}</> : "Continue"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-300" /></div>
            <div className="relative flex justify-center"><span className="bg-white dark:bg-[#1a1a1a] px-2 text-sm text-gray-500 dark:text-gray-400">or</span></div>
          </div>

          <div className="flex justify-center gap-4 md:gap-6">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-12 h-12 md:w-14 md:h-14 rounded-full border border-gray-300 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-all shadow-sm active:scale-95"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleLoginMethodChange}
              className="w-12 h-12 md:w-14 md:h-14 rounded-full border border-[#E23744] flex items-center justify-center hover:bg-[#d32f3d] transition-all bg-[#E23744] active:scale-95 shadow-sm"
            >
              {authMethod === "phone" ? <Mail className="h-5 w-5 md:h-6 md:w-6 text-white" /> : <Phone className="h-5 w-5 md:h-6 md:w-6 text-white" />}
            </button>
          </div>

          <div className="text-center text-xs md:text-sm text-gray-500 dark:text-gray-400 pt-4 md:pt-6">
            <p className="mb-1 md:mb-2">By continuing, you agree to our</p>
            <div className="flex justify-center gap-2 flex-wrap text-black dark:text-white">
              <Link to="/user/terms" className="underline hover:text-gray-700 dark:hover:text-gray-300">Terms of Service</Link>
              <span className="text-gray-500">•</span>
              <Link to="/user/privacy" className="underline hover:text-gray-700 dark:hover:text-gray-300">Privacy Policy</Link>
              <span className="text-gray-500">•</span>
              <Link to="/user/code-of-conduct" className="underline hover:text-gray-700 dark:hover:text-gray-300">Code of Conduct</Link>
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
