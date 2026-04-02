import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, User } from "lucide-react"
import AnimatedPage from "../../components/AnimatedPage"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { authAPI } from "@/lib/api"
import { setAuthData as setUserAuthData } from "@/lib/utils/auth"

export default function OTP() {
  const navigate = useNavigate()
  const otpGuardPushedRef = useRef(false)
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [authData, setAuthData] = useState(null)
  const [showNameInput, setShowNameInput] = useState(false)
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState("")
  const [verifiedOtp, setVerifiedOtp] = useState("")
  const [contactInfo, setContactInfo] = useState("")
  const [contactType, setContactType] = useState("phone")
  const [showExitDialog, setShowExitDialog] = useState(false)
  const inputRefs = useRef([])

  const exitOtpFlow = useCallback(() => {
    const phone = authData?.method === "phone" ? authData?.phone : null
    if (phone) {
      sessionStorage.setItem(
        "userSignInPrefillOnce",
        JSON.stringify({ method: "phone", phone })
      )
    }
    sessionStorage.removeItem("userAuthData")
    navigate("/user/auth/sign-in", { replace: true })
  }, [authData, navigate])

  const openExitDialog = useCallback(() => {
    if (success) return
    setShowExitDialog(true)
  }, [success])

  useEffect(() => {
    // Redirect to home if already authenticated
    const isAuthenticated = localStorage.getItem("user_authenticated") === "true"
    if (isAuthenticated) {
      navigate("/user", { replace: true })
      return
    }

    // Get auth data from sessionStorage
    const stored = sessionStorage.getItem("userAuthData")
    if (!stored) {
      // No auth data, redirect to sign in
      navigate("/user/auth/sign-in", { replace: true })
      return
    }
    const data = JSON.parse(stored)
    setAuthData(data)

    // Handle both phone and email
    if (data.method === "email" && data.email) {
      setContactType("email")
      setContactInfo(data.email)
    } else if (data.phone) {
      setContactType("phone")
      // Extract and format phone number for display
      const phoneMatch = data.phone?.match(/(\+\d+)\s*(.+)/)
      if (phoneMatch) {
        const formattedPhone = `${phoneMatch[1]}-${phoneMatch[2].replace(/\D/g, "")}`
        setContactInfo(formattedPhone)
      } else {
        setContactInfo(data.phone || "")
      }

      // OTP auto-fill removed - user must manually enter OTP
    }

    // Start resend timer (60 seconds)
    setResendTimer(60)
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [navigate])

  useEffect(() => {
    // Focus first input on mount with a small delay to ensure page transition is complete
    if (!showNameInput) {
      const timer = setTimeout(() => {
        inputRefs.current[0]?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [showNameInput])

  useEffect(() => {
    // Auto-clear error after 3 seconds
    if (error) {
      const timer = setTimeout(() => {
        setError("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (!authData || success || !showNameInput) {
      otpGuardPushedRef.current = false
      return
    }

    if (!otpGuardPushedRef.current) {
      window.history.pushState({ userOtpGuard: true }, "", window.location.href)
      otpGuardPushedRef.current = true
    }

    const handlePopState = () => {
      setShowExitDialog(true)
      window.history.pushState({ userOtpGuard: true }, "", window.location.href)
    }

    window.addEventListener("popstate", handlePopState)
    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [authData, success, showNameInput])

  const handleChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) {
      return
    }

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setError("")

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 digits are entered and we are in OTP step
    if (!showNameInput && newOtp.every((digit) => digit !== "") && newOtp.length === 6) {
      handleVerify(newOtp.join(""))
    }
  }

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === "Backspace") {
      if (otp[index]) {
        // If current input has value, clear it
        const newOtp = [...otp]
        newOtp[index] = ""
        setOtp(newOtp)
      } else if (index > 0) {
        // If current input is empty, move to previous and clear it
        inputRefs.current[index - 1]?.focus()
        const newOtp = [...otp]
        newOtp[index - 1] = ""
        setOtp(newOtp)
      }
    }
    // Handle paste
    if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, "").slice(0, 6).split("")
        const newOtp = [...otp]
        digits.forEach((digit, i) => {
          if (i < 6) {
            newOtp[i] = digit
          }
        })
        setOtp(newOtp)
        if (!showNameInput && digits.length === 6) {
          handleVerify(newOtp.join(""))
        } else {
          inputRefs.current[digits.length]?.focus()
        }
      })
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text")
    const digits = pastedData.replace(/\D/g, "").slice(0, 6).split("")
    const newOtp = [...otp]
    digits.forEach((digit, i) => {
      if (i < 6) {
        newOtp[i] = digit
      }
    })
    setOtp(newOtp)
    if (!showNameInput && digits.length === 6) {
      handleVerify(newOtp.join(""))
    } else {
      inputRefs.current[digits.length]?.focus()
    }
  }

  const handleVerify = async (otpValue = null) => {
    if (showNameInput) {
      // In name collection step, ignore OTP auto-submit
      return
    }

    const code = otpValue || otp.join("")

    if (code.length !== 6) {
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const phone = authData?.method === "phone" ? authData.phone : null
      const email = authData?.method === "email" ? authData.email : null
      const purpose = authData?.isSignUp ? "register" : "login"
      const signupName = authData?.isSignUp ? (authData?.name || null) : null

      // First attempt: verify OTP for login/register with user role
      const response = await authAPI.verifyOTP(phone, code, purpose, signupName, email, "user")
      const data = response?.data?.data || {}

      // If backend tells us this is a new user, ask for name
      if (data.needsName) {
        setShowNameInput(true)
        setVerifiedOtp(code)
        setOtp(["", "", "", "", "", ""])
        setSuccess(false)
        setIsLoading(false)
        return
      }

      // Otherwise, OTP verified and user logged in/registered
      const accessToken = data.accessToken
      const user = data.user

      if (!accessToken || !user) {
        throw new Error("Invalid response from server")
      }

      // Clear auth data from sessionStorage
      sessionStorage.removeItem("userAuthData")

      // Replace old token with new one (handles cross-module login)
      setUserAuthData("user", accessToken, user)

      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new Event("userAuthChanged"))

      setSuccess(true)

      // Redirect to user home after short delay
      setTimeout(() => {
        navigate("/user")
      }, 500)
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to verify OTP. Please try again."
      setError(message)
      // Clear OTP on error so user can re-try
      setOtp(["", "", "", "", "", ""])
      setTimeout(() => {
        inputRefs.current[0]?.focus()
      }, 50)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmitName = async () => {
    const trimmedName = name.trim()

    if (!trimmedName) {
      setNameError("Name is required")
      return
    }

    if (trimmedName.length < 2) {
      setNameError("Name must be at least 2 characters")
      return
    }

    if (!verifiedOtp) {
      setError("OTP verification step missing. Please request a new OTP.")
      return
    }

    setIsLoading(true)
    setError("")
    setNameError("")

    try {
      const phone = authData?.method === "phone" ? authData.phone : null
      const currentEmail = authData?.method === "email" ? authData.email : null
      const purpose = authData?.isSignUp ? "register" : "login"
      const verificationEmail = authData?.method === "email" ? currentEmail : null

      // Second call with name to auto-register and login.
      // For phone OTP flow, don't send optional email from this step.
      // authAPI.verifyOTP takes: phone, otp, purpose, name, email, role, password
      const response = await authAPI.verifyOTP(
        phone,
        verifiedOtp,
        purpose,
        trimmedName,
        verificationEmail,
        "user"
      )
      const data = response?.data?.data || {}

      const accessToken = data.accessToken
      const user = data.user

      if (!accessToken || !user) {
        throw new Error("Invalid response from server")
      }

      // Clear auth data from sessionStorage
      sessionStorage.removeItem("userAuthData")

      // Replace old token with new one (handles cross-module login)
      setUserAuthData("user", accessToken, user)

      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new Event("userAuthChanged"))

      setSuccess(true)

      // Redirect to user home after short delay
      setTimeout(() => {
        navigate("/user")
      }, 500)
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to complete registration. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return

    setIsLoading(true)
    setError("")

    try {
      const phone = authData?.method === "phone" ? authData.phone : null
      const email = authData?.method === "email" ? authData.email : null
      const purpose = authData?.isSignUp ? "register" : "login"

      // Call backend to resend OTP
      await authAPI.sendOTP(phone, purpose, email)
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to resend OTP. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
    }

    // Reset timer to 60 seconds
    setResendTimer(60)
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    setOtp(["", "", "", "", "", ""])
    setShowNameInput(false)
    setName("")
    setNameError("")
    setVerifiedOtp("")
    inputRefs.current[0]?.focus()
  }

  if (!authData) {
    return null
  }

  return (
    <AnimatedPage className="min-h-screen bg-white dark:bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <div className="relative flex items-center justify-center py-4 px-4 md:py-6 md:px-6 lg:px-8 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => {
            if (showNameInput) {
              openExitDialog()
              return
            }
            navigate("/user/auth/sign-in")
          }}
          className="absolute left-4 md:left-6 lg:left-8 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 md:h-6 md:w-6 text-black dark:text-white" />
        </button>
        <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-black dark:text-white">
          {showNameInput ? "Complete Your Profile" : "OTP Verification"}
        </h1>
      </div>

      {/* Main Content */}
      <div className="flex flex-col justify-center px-6 sm:px-8 md:px-12 lg:px-16 xl:px-20 pt-8 sm:pt-12 md:pt-16 lg:pt-20 pb-12 sm:pb-16 md:pb-20">
        <div className="max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl mx-auto w-full space-y-8 md:space-y-10 lg:space-y-12">
          {/* Message */}
          {!showNameInput && (
            <div className="text-center space-y-2 md:space-y-3">
              <p className="text-base md:text-lg lg:text-xl text-black dark:text-white">
                We have sent a verification code to
              </p>
              <p className="text-base md:text-lg lg:text-xl text-black dark:text-white font-medium">
                {contactInfo}
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-500 text-center">
              {error}
            </p>
          )}

          {/* OTP Input Fields */}
          {!showNameInput && (
            <div className="space-y-8">
              <div className="flex justify-center gap-2 sm:gap-3 md:gap-4 lg:gap-5">
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
                    autoFocus={index === 0}
                    className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-18 lg:h-18 text-center text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold p-0 border-2 border-black dark:border-gray-600 rounded-lg focus-visible:ring-2 focus-visible:ring-[#E23744] focus-visible:border-[#E23744] dark:focus-visible:border-[#E23744] bg-white dark:bg-[#1a1a1a] text-black dark:text-white transition-all"
                  />
                ))}
              </div>

              {/* Resend Section */}
              <div className="text-center space-y-1 md:space-y-2">
                <p className="text-sm md:text-base text-black dark:text-white">
                  Didn't get the {contactType === "email" ? "email" : "SMS"}?
                </p>
                {resendTimer > 0 ? (
                  <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">
                    Resend {contactType === "email" ? "email" : "SMS"} in {resendTimer}s
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isLoading}
                    className="text-sm md:text-base text-[#E23744] hover:text-[#d32f3d] dark:text-[#E23744] dark:hover:text-[#d32f3d] disabled:opacity-50 transition-colors font-medium"
                  >
                    Resend {contactType === "email" ? "email" : "SMS"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Name Input (shown only after OTP verified and user is new) */}
          <AnimatePresence mode="wait">
            {showNameInput && (
              <motion.div 
                key="profile-completion"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-3xl font-extrabold text-black dark:text-white tracking-tight">
                    Welcome!
                  </h2>
                </div>

                <div className="space-y-6 bg-white dark:bg-gray-900/40 p-6 md:p-8 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">
                      Full Name
                    </label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-[#E23744] transition-colors" />
                      <Input
                        type="text"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value)
                          if (nameError) setNameError("")
                        }}
                        disabled={isLoading}
                        placeholder="e.g. John Doe"
                        className={`h-12 pl-12 text-base border-2 ${nameError ? "border-red-500" : "border-gray-200 dark:border-gray-700"} bg-white dark:bg-[#1a1a1a] text-black dark:text-white rounded-xl transition-all focus-visible:ring-0 focus-visible:border-[#E23744]`}
                      />
                    </div>
                    {nameError && <p className="text-xs text-red-500 ml-1">{nameError}</p>}
                  </div>

                  <div className="pt-1">
                    <Button
                      onClick={handleSubmitName}
                      disabled={isLoading || !name.trim()}
                      className="w-full h-12 bg-[#E23744] hover:bg-[#d32f3d] text-white font-bold text-base rounded-xl transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Finalizing...
                        </>
                      ) : (
                        "Complete Profile"
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading Spinner */}
          {isLoading && !showNameInput && (
            <div className="flex justify-center pt-4">
              <Loader2 className="h-6 w-6 text-[#E23744] animate-spin" />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showExitDialog && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowExitDialog(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92%] max-w-sm rounded-2xl bg-white dark:bg-[#171717] p-6 border border-gray-200 dark:border-gray-800 shadow-xl"
            >
              <p className="text-center text-lg font-medium text-black dark:text-white leading-relaxed">
                Are you sure you want to go back without completing the signup process?
              </p>
              <div className="mt-5 flex gap-3">
                <Button
                  type="button"
                  onClick={() => setShowExitDialog(false)}
                  className="flex-1 h-11 bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white"
                >
                  Stay Here
                </Button>
                <Button
                  type="button"
                  onClick={exitOtpFlow}
                  className="flex-1 h-11 bg-[#E23744] hover:bg-[#d32f3d] text-white"
                >
                  Exit
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AnimatedPage>
  )
}
