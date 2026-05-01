import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { deliveryAPI } from "@/lib/api"

const countryCodeDetails = { code: "+91", country: "IN", flag: "🇮🇳" };

export default function DeliverySignIn() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState(() => {
    try {
      const stored = sessionStorage.getItem("deliveryAuthData")
      if (stored) {
        const data = JSON.parse(stored)
        if (data && data.phone && data.method === "phone") {
          const parts = data.phone.split(" ")
          if (parts.length >= 2) {
            return {
              countryCode: parts[0],
              phone: parts.slice(1).join("").replace(/\D/g, "")
            }
          }
        }
      }
    } catch (e) {
      // Ignore error
    }
    return {
      phone: "",
      countryCode: "+91",
    }
  })
  const [error, setError] = useState("")
  const [isSending, setIsSending] = useState(false)

  const selectedCountry = countryCodeDetails;

  const validatePhone = (phone, countryCode) => {
    if (!phone || phone.trim() === "") {
      return "Phone number is required"
    }
    const digitsOnly = phone.replace(/\D/g, "")
    if (digitsOnly.length < 10) {
      return "Phone number must be exactly 10 digits"
    }
    if (digitsOnly.length > 10) {
      return "Phone number cannot exceed 10 digits"
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
    setError("")
    const phoneError = validatePhone(formData.phone, formData.countryCode)
    if (phoneError) {
      setError(phoneError)
      return
    }
    const fullPhone = `${formData.countryCode} ${formData.phone}`.trim()

    try {
      setIsSending(true)
      await deliveryAPI.sendOTP(fullPhone, "login")
      const authData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        module: "delivery",
      }
      sessionStorage.setItem("deliveryAuthData", JSON.stringify(authData))
      navigate("/delivery/otp")
    } catch (err) {
      console.error("Send OTP Error:", err)
      const message = err?.response?.data?.message || "Failed to send OTP. Please try again."
      setError(message)
      setIsSending(false)
    }
  }

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10)
    setFormData({ ...formData, phone: value })
    if (error && value.length === 10) {
      const phoneError = validatePhone(value, formData.countryCode)
      if (!phoneError) setError("")
    }
  }

  const handlePhoneBlur = () => {
    if (formData.phone.length > 0) {
      setError(validatePhone(formData.phone, formData.countryCode))
    }
  }

  const isValid = !validatePhone(formData.phone, formData.countryCode)

  return (
    <div className="max-h-screen h-screen bg-white flex flex-col">
      <div className="relative flex items-center justify-center py-4 px-4 mt-2"></div>

      <div className="flex flex-col items-center pt-8 pb-8 px-6">
        <div>
          <h1 className="text-3xl italic md:text-4xl tracking-wide font-extrabold text-black" style={{ WebkitTextStroke: "0.5px black", textStroke: "0.5px black" }}>GrhaPoch</h1>
        </div>
        <div className="">
          <span className="text-gray-600 font-light text-sm tracking-wide block text-center">— delivery partner —</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-6 overflow-y-auto">
        <div className="w-full max-w-md mx-auto space-y-6 py-4">
          <div className="text-center">
            <p className="text-base text-gray-700 leading-relaxed">Enter your registered phone number and we will send an OTP to continue</p>
          </div>

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
                  autoComplete="off"
                  className={`w-full h-12 px-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 text-base border rounded-lg min-w-0 bg-white ${error && formData.phone.length > 0 ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"}`}
                />
                {error && formData.phone.length > 0 && <p className="text-red-500 text-[11px] md:text-xs mt-1 ml-1 font-medium">{error}</p>}
              </div>
            </div>
            <button onClick={handleSendOTP} disabled={!isValid || isSending} className={`w-full h-12 rounded-lg font-bold text-base transition-colors ${isValid && !isSending ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}>
              {isSending ? "Sending OTP..." : "Send OTP"}
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 pb-8 pt-4">
        <div className="w-full max-w-md mx-auto">
          <p className="text-xs text-center text-gray-600 leading-relaxed">By continuing, you agree to our</p>
          <div className="text-xs text-center text-gray-600 mt-1 flex justify-center gap-2 flex-wrap font-medium text-black/80">
            <Link to="/delivery/terms" className="underline hover:text-black">Terms of Service</Link>
            <span className="text-gray-400">•</span>
            <Link to="/delivery/privacy" className="underline hover:text-black">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
