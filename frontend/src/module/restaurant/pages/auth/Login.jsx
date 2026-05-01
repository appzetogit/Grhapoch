import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { setAuthData } from "@/lib/utils/auth"
import { Button } from "@/components/ui/button"
import { restaurantAPI } from "@/lib/api"
import { firebaseAuth, googleProvider, ensureFirebaseInitialized } from "@/lib/firebase"
import { FlutterGoogleSignInError, isFlutterInAppWebView, signInWithFlutterGoogle } from "@/lib/flutterGoogleSignIn"
import { checkOnboardingStatus } from "../../utils/onboardingUtils"

const countryCodeDetails = { code: "+91", country: "IN", flag: "🇮🇳" };

export default function RestaurantLogin() {
  const navigate = useNavigate()
  const [loginMethod, setLoginMethod] = useState("phone") // "phone" or "email"
  const [formData, setFormData] = useState({
    phone: "",
    countryCode: "+91",
    email: "",
  })
  const [errors, setErrors] = useState({
    phone: "",
    email: "",
  })
  const [touched, setTouched] = useState({
    phone: false,
    email: false,
  })
  const [isSending, setIsSending] = useState(false)
  const [apiError, setApiError] = useState("")

  // Pre-fill data if user comes back from OTP screen
  useEffect(() => {
    const stored = sessionStorage.getItem("restaurantAuthData");
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.method === "phone" && data.phone) {
          setLoginMethod("phone");
          const phoneNum = data.phone.split(" ").slice(1).join("") || data.phone.replace(/^\+\d+\s?/, "");
          const countryCode = data.phone.split(" ")[0] || "+91";

          setFormData(prev => ({
            ...prev,
            phone: phoneNum,
            countryCode: countryCode === "+91" ? countryCode : "+91"
          }));
        } else if (data.method === "email" && data.email) {
          setLoginMethod("email");
          setFormData(prev => ({
            ...prev,
            email: data.email
          }));
        }
      } catch (e) {
        console.error("Failed to parse stored auth data:", e);
      }
    }
  }, []);

  const selectedCountry = countryCodeDetails;

  const validatePhone = (phone, countryCode) => {
    if (!phone || phone.trim() === "") {
      return "Phone number is required"
    }
    const digitsOnly = phone.replace(/\D/g, "")
    const requiredLength = 10;
    if (digitsOnly.length < requiredLength) {
      return `Phone number must be exactly ${requiredLength} digits`
    }
    if (digitsOnly.length > requiredLength) {
      return `Phone number cannot exceed ${requiredLength} digits`
    }
    if (countryCode === "+91") {
      const firstDigit = digitsOnly[0]
      if (!["6", "7", "8", "9"].includes(firstDigit)) {
        return "Invalid Indian mobile number"
      }
    }
    return ""
  }

  const handleSendOTP = async () => {
    setTouched({ phone: true })
    setApiError("")
    const phoneError = validatePhone(formData.phone, formData.countryCode)
    if (phoneError) {
      setErrors({ phone: phoneError })
      return
    }
    setErrors({ phone: "" })
    const fullPhone = `${formData.countryCode} ${formData.phone}`.trim()

    try {
      setIsSending(true)
      const otpResponse = await restaurantAPI.sendOTP(fullPhone, "login")
      const expiresInRaw = otpResponse?.data?.data?.expiresIn ?? otpResponse?.data?.expiresIn
      const otpExpiresIn = Number.isFinite(Number(expiresInRaw)) ? Number(expiresInRaw) : null
      const otpExpiresInMs = otpExpiresIn ? otpExpiresIn * 1000 : null
      const otpGeneratedAt = Date.now()

      const authData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        module: "restaurant",
        otpGeneratedAt,
        otpExpiresIn: otpExpiresIn || undefined,
        otpExpiresInMs: otpExpiresInMs || undefined
      }
      sessionStorage.setItem("restaurantAuthData", JSON.stringify(authData))
      localStorage.setItem("restaurantAuthData", JSON.stringify(authData))
      navigate("/restaurant/otp")
    } catch (error) {
      const message = error?.response?.data?.message || "Failed to send OTP. Please try again."
      setApiError(message)
    } finally {
      setIsSending(false)
    }
  }

  const validateEmail = (email) => {
    if (!email || email.trim() === "") {
      return "Email is required"
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address"
    }
    return ""
  }

  const handleEmailChange = (e) => {
    const value = e.target.value
    setFormData({ ...formData, email: value })
    if (touched.email) {
      setErrors({ ...errors, email: validateEmail(value) })
    }
  }

  const handleEmailBlur = () => {
    setTouched({ ...touched, email: true })
    setErrors({ ...errors, email: validateEmail(formData.email) })
  }

  const handleSendEmailOTP = async () => {
    setTouched({ ...touched, email: true })
    setApiError("")
    const emailError = validateEmail(formData.email)
    if (emailError) {
      setErrors({ ...errors, email: emailError })
      return
    }
    setErrors({ ...errors, email: "" })

    try {
      setIsSending(true)
      const otpResponse = await restaurantAPI.sendOTP(null, "login", formData.email)
      const expiresInRaw = otpResponse?.data?.data?.expiresIn ?? otpResponse?.data?.expiresIn
      const otpExpiresIn = Number.isFinite(Number(expiresInRaw)) ? Number(expiresInRaw) : null
      const otpExpiresInMs = otpExpiresIn ? otpExpiresIn * 1000 : null
      const otpGeneratedAt = Date.now()

      const authData = {
        method: "email",
        email: formData.email,
        isSignUp: false,
        module: "restaurant",
        otpGeneratedAt,
        otpExpiresIn: otpExpiresIn || undefined,
        otpExpiresInMs: otpExpiresInMs || undefined
      }
      sessionStorage.setItem("restaurantAuthData", JSON.stringify(authData))
      localStorage.setItem("restaurantAuthData", JSON.stringify(authData))
      navigate("/restaurant/otp")
    } catch (error) {
      const message = error?.response?.data?.message || "Failed to send OTP. Please try again."
      setApiError(message)
    } finally {
      setIsSending(false)
    }
  }

  const handleGoogleLogin = async () => {
    setApiError("")
    setIsSending(true)

    try {
      ensureFirebaseInitialized()
      const { signInWithPopup } = await import("firebase/auth")
      let user = null
      if (isFlutterInAppWebView()) {
        try {
          user = await signInWithFlutterGoogle(firebaseAuth)
        } catch (flutterError) {
          if (flutterError?.code === "missing_token") {
            throw new Error("Google sign-in failed. Please try again.")
          }
        }
      }
      if (!user) {
        const result = await signInWithPopup(firebaseAuth, googleProvider)
        user = result?.user || null
      }
      if (!user) {
        throw new Error("Google user not available")
      }

      const idToken = await user.getIdToken()
      const response = await restaurantAPI.firebaseGoogleLogin(idToken)
      const data = response?.data?.data || {}
      const accessToken = data.accessToken
      const restaurant = data.restaurant || data.user

      if (!accessToken || !restaurant) {
        throw new Error("Invalid response from server")
      }

      setAuthData("restaurant", accessToken, restaurant)
      window.dispatchEvent(new Event("restaurantAuthChanged"))

      // Check if onboarding is needed
      const incompleteStep = await checkOnboardingStatus()
      console.log("[Login] Onboarding check result:", incompleteStep)
      
      if (incompleteStep !== null && incompleteStep !== undefined) {
        console.log(`[Login] Redirecting to onboarding step ${incompleteStep}`)
        navigate(`/restaurant/onboarding?step=${incompleteStep}`, { replace: true })
      } else {
        console.log("[Login] Onboarding complete, redirecting to hub")
        navigate("/restaurant/to-hub", { replace: true })
      }
    } catch (error) {
      console.error("Firebase Google login error:", error)
      let message = error?.response?.data?.message || error?.message || "Failed to login with Google."
      if (error?.response?.data?.errors?.code === "RESTAURANT_NOT_REGISTERED") {
        message = "This Google email is not registered in the restaurant panel."
      }
      setApiError(message)
    } finally {
      setIsSending(false)
    }
  }

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10)
    setFormData({ ...formData, phone: value })
    if (value.length === 10) {
      setErrors({ ...errors, phone: validatePhone(value, formData.countryCode) })
    } else {
      setErrors({ ...errors, phone: "" })
    }
    if (!touched.phone && value.length > 0) {
      setTouched({ ...touched, phone: true })
    }
  }

  const handlePhoneBlur = () => {
    setTouched({ ...touched, phone: true })
    setErrors({ ...errors, phone: validatePhone(formData.phone, formData.countryCode) })
  }

  const isValidPhone = formData.phone.replace(/\D/g, "").length === 10 && !errors.phone
  const isValidEmail = !errors.email && formData.email.trim().length > 0

  return (
    <div className="max-h-screen h-screen bg-white flex flex-col">
      <div className="flex flex-col items-center pt-8 pb-8 px-6">
        <div>
          <h1 className="text-3xl italic md:text-4xl tracking-wide font-extrabold text-black" style={{ WebkitTextStroke: "0.5px black", textStroke: "0.5px black" }}>GrhaPoch</h1>
        </div>
        <div className="">
          <span className="text-gray-600 font-light text-sm tracking-wide block text-center">— restaurant partner —</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-6 overflow-y-auto">
        <div className="w-full max-w-md mx-auto space-y-6 py-4">
          <div className="text-center">
            <p className="text-base text-gray-700 leading-relaxed">
              {loginMethod === "email" ? "Enter your registered email and we will send an OTP to continue" : "Enter your registered phone number and we will send an OTP to continue"}
            </p>
          </div>

          {loginMethod === "phone" ? (
            <div className="space-y-4">
              <div className="flex gap-2 items-stretch w-full">
                <div className="w-[100px] h-12 border border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  <span className="flex items-center gap-1.5">
                    <span className="text-base">{selectedCountry.flag}</span>
                    <span className="text-sm font-medium text-gray-900">{selectedCountry.code}</span>
                  </span>
                </div>
                <div className="flex-1 flex flex-col">
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Enter phone number"
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    onBlur={handlePhoneBlur}
                    className={`w-full h-12 px-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 text-base border rounded-lg bg-white ${errors.phone && formData.phone.length > 0 ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"}`}
                  />
                  {errors.phone && formData.phone.length > 0 && <p className="text-red-500 text-xs mt-1 ml-1">{errors.phone}</p>}
                </div>
              </div>
              {apiError && <p className="text-red-500 text-xs mt-1 ml-1">{apiError}</p>}
              <Button type="button" onClick={handleSendOTP} disabled={!isValidPhone || isSending} className={`w-full h-12 rounded-lg font-bold text-base transition-colors ${isValidPhone && !isSending ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}>
                {isSending ? "Sending OTP..." : "Send OTP"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col">
                <input
                  type="email"
                  inputMode="email"
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={handleEmailChange}
                  onBlur={handleEmailBlur}
                  className={`w-full h-12 px-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 text-base border rounded-lg bg-white ${errors.email && formData.email.length > 0 ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"}`}
                />
                {errors.email && formData.email.length > 0 && <p className="text-red-500 text-xs mt-1 ml-1">{errors.email}</p>}
              </div>
              {apiError && <p className="text-red-500 text-xs mt-1 ml-1">{apiError}</p>}
              <Button type="button" onClick={handleSendEmailOTP} disabled={!isValidEmail || isSending} className={`w-full h-12 rounded-lg font-bold text-base transition-colors ${isValidEmail && !isSending ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}>
                {isSending ? "Sending OTP..." : "Send OTP"}
              </Button>
            </div>
          )}

          <div className="relative flex items-center py-4">
            <div className="flex-1 border-t border-gray-500"></div>
            <span className="px-4 text-sm font-medium text-gray-600">OR</span>
            <div className="flex-1 border-t border-gray-500"></div>
          </div>

          <div className="space-y-3">
            <Button type="button" onClick={handleGoogleLogin} variant="outline" className="w-14 h-14 rounded-full border border-gray-300 hover:border-gray-400 hover:bg-gray-50 mx-auto flex items-center justify-center p-0">
              <svg className="w-7 h-7" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 pb-8 pt-4">
        <div className="w-full max-w-md mx-auto text-center">
          <p className="text-xs text-gray-600 leading-relaxed">By continuing, you agree to our</p>
          <div className="flex justify-center gap-2 flex-wrap text-black/80 mt-1 font-medium">
            <Link to="/restaurant/terms" className="text-xs underline hover:text-gray-900 transition-colors">Terms of Service</Link>
            <span className="text-gray-400 text-xs">•</span>
            <Link to="/restaurant/privacy" className="text-xs underline hover:text-gray-900 transition-colors">Privacy Policy</Link>
            <span className="text-gray-400 text-xs">•</span>
            <Link to="/restaurant/code-of-conduct" className="text-xs underline hover:text-gray-900 transition-colors">Code of Conduct</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
