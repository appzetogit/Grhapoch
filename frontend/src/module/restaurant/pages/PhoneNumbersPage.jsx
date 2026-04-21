import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Edit, Phone, Users, ChevronDown, X, ArrowRight } from "lucide-react"

export default function PhoneNumbersPage() {
  const navigate = useNavigate()
  const [editingNumber, setEditingNumber] = useState(null) // { type: 'orderReminder1' | 'orderReminder2' | 'restaurantPage' }
  const [countryCode, setCountryCode] = useState("+91")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [isCountryCodeOpen, setIsCountryCodeOpen] = useState(false)
  const [showOtpPopup, setShowOtpPopup] = useState(false)
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [pendingPhoneData, setPendingPhoneData] = useState(null) // Store phone data to save after OTP verification

  // Phone numbers data - only mobile now
  const [phoneData, setPhoneData] = useState(() => {
    const user = JSON.parse(localStorage.getItem("restaurant_user") || "{}");
    const basePhone = user?.phone || "9981127415"; // fallback to old hardcoded for legacy
    // Ensure format is +91-XXXXXXXXXX
    const formatted = basePhone.startsWith("+91") ?
      (basePhone.includes("-") ? basePhone : `+91-${basePhone.slice(3)}`) :
      `+91-${basePhone.replace(/^91/, "")}`;

    return {
      orderReminder1: formatted,
      orderReminder2: formatted,
      restaurantPage: formatted
    }
  })

  const countryCodeDetails = { code: "+91", country: "India", flag: "🇮🇳" }

  const handleEditClick = (type) => {
    const currentNumber = phoneData[type]
    const parts = currentNumber.split('-')
    setCountryCode(parts[0] || "+91")
    setPhoneNumber(parts[1] || "")
    setEditingNumber(type)
  }

  const handleSaveEdit = () => {
    if (!editingNumber || !phoneNumber.trim()) return

    // Validate 10 digits
    if (phoneNumber.replace(/\D/g, "").length !== 10) {
      // In a real app we'd show an error state, here we just return
      return
    }

    // Store the data to save after OTP verification
    setPendingPhoneData({
      type: editingNumber,
      value: `+91-${phoneNumber.trim()}`,
      countryCode: "+91",
      phoneNumber: phoneNumber.trim()
    })

    // Close edit popup and show OTP popup
    setEditingNumber(null)
    setShowOtpPopup(true)
    setOtp(["", "", "", "", "", ""])
  }

  const handleCancelEdit = () => {
    setEditingNumber(null)
    setCountryCode("+91")
    setPhoneNumber("")
  }

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return // Only allow digits

    const newOtp = [...otp]
    newOtp[index] = value.slice(-1) // Only take last character

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`)
      if (nextInput) nextInput.focus()
    }

    setOtp(newOtp)
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      if (prevInput) prevInput.focus()
    }
  }

  const handleVerifyOtp = () => {
    const otpString = otp.join("")

    // For demo purposes, accept any 6-digit OTP
    // In production, this would verify against the backend
    if (otpString.length === 6) {
      // Save the phone number
      if (pendingPhoneData) {
        setPhoneData(prev => ({
          ...prev,
          [pendingPhoneData.type]: pendingPhoneData.value
        }))
      }

      // Close OTP popup and reset
      setShowOtpPopup(false)
      setPendingPhoneData(null)
      setOtp(["", "", "", "", "", ""])
      setCountryCode("+91")
      setPhoneNumber("")
    }
  }

  const handleResendOtp = () => {
    // Reset OTP input
    setOtp(["", "", "", "", "", ""])
    // In production, this would trigger a new OTP to be sent
  }

  const handleCancelOtp = () => {
    setShowOtpPopup(false)
    setPendingPhoneData(null)
    setOtp(["", "", "", "", "", ""])
  }

  const getDisplayNumber = (type) => {
    return phoneData[type] || ""
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Important contacts</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">

        {/* Order reminder numbers */}
        <div className="bg-white rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-gray-700" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-gray-900">Order reminder numbers</h2>
              <p className="text-xs text-gray-600 mt-1">
                Should always be available for Grha Poch to reach out for live order support and order reminders.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {/* Order reminder number #1 */}
            <div className="flex items-center justify-between py-2">
              <div className="flex-1">
                <p className="text-sm text-gray-700 mb-1">Order reminder number #1</p>
                <p className="text-base font-semibold text-gray-900">{getDisplayNumber("orderReminder1")}</p>
              </div>
              <button
                onClick={() => handleEditClick("orderReminder1")}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Edit className="w-4 h-4 text-blue-600" />
              </button>
            </div>

            {/* Order reminder number #2 */}
            <div className="flex items-center justify-between py-2 border-t border-gray-100">
              <div className="flex-1">
                <p className="text-sm text-gray-700 mb-1">Order reminder number #2</p>
                <p className="text-base font-semibold text-gray-900">{getDisplayNumber("orderReminder2")}</p>
              </div>
              <button
                onClick={() => handleEditClick("orderReminder2")}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Edit className="w-4 h-4 text-blue-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Restaurant page number */}
        <div className="bg-white rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
              <Phone className="w-5 h-5 text-gray-700" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-gray-900">Restaurant page number</h2>
              <p className="text-xs text-gray-600 mt-1">
                Number for Grha Poch customers to call your restaurant.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between py-2">
              <div className="flex-1">
                <p className="text-base font-semibold text-gray-900">{getDisplayNumber("restaurantPage")}</p>
              </div>
              <button
                onClick={() => handleEditClick("restaurantPage")}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Edit className="w-4 h-4 text-blue-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Manage contact details link */}
        <button
          onClick={() => navigate("/restaurant/contact-details")}
          className="w-full flex items-center justify-between p-4 bg-slate-900 rounded-2xl text-white shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.98]"
        >
          <div className="flex flex-col items-start px-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Settings</span>
            <span className="text-sm font-bold">Manage staff contact details</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* Edit Phone Number Popup */}
      <AnimatePresence>
        {editingNumber && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelEdit}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[2.5rem] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-50 max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1" />
              <div className="flex items-center justify-between px-6 py-6 ring-1 ring-slate-50">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Edit Contact</h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Update your registered phone number</p>
                </div>
                <button
                  onClick={handleCancelEdit}
                  className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto px-6 py-8">
                <div className="space-y-8">
                  {/* Country Code Selector */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 block">
                      Region
                    </label>
                    <div className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 flex items-center justify-between select-none">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{countryCodeDetails.flag}</span>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-900">{countryCodeDetails.country}</span>
                          <span className="text-[10px] font-bold text-slate-500">{countryCodeDetails.code}</span>
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-300" />
                    </div>
                  </div>

                  {/* Phone Number Input */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 block">
                      New phone number
                    </label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-300">+91</span>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="00000 00000"
                        className="w-full pl-16 pr-5 py-5 bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white rounded-2xl text-lg font-extrabold text-slate-900 outline-none transition-all placeholder:text-slate-200"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-3 px-1 leading-relaxed">
                      We'll send a one-time verification code to this number to ensure it's yours.
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 bg-slate-50/50 flex gap-4">
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 py-4 px-6 border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-white hover:shadow-sm transition-all active:scale-[0.98]"
                >
                  Discard
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={phoneNumber.replace(/\D/g, "").length !== 10}
                  className={`flex-[1.5] py-4 px-6 rounded-2xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-slate-200 ${
                    phoneNumber.replace(/\D/g, "").length === 10
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  Send Verification
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>


      {/* OTP Verification Popup */}
      <AnimatePresence>
        {showOtpPopup && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelOtp}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[2.5rem] shadow-2xl z-50 max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1" />
              <div className="flex items-center justify-between px-6 py-6 border-b border-slate-50">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Security Check</h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Verification code sent</p>
                </div>
                <button
                  onClick={handleCancelOtp}
                  className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-10">
                <div className="space-y-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                      <Phone className="w-8 h-8 text-slate-900" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">
                      Please enter the 6-digit code sent to
                    </p>
                    <p className="text-lg font-extrabold text-slate-900 tracking-tight">
                      {pendingPhoneData ? `${pendingPhoneData.countryCode} ${pendingPhoneData.phoneNumber}` : ""}
                    </p>
                  </div>

                  {/* OTP Input Fields */}
                  <div className="flex items-center justify-center gap-2 md:gap-3">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        className="w-12 h-16 text-center text-2xl font-extrabold border-2 border-slate-100 rounded-xl bg-slate-50 focus:bg-white focus:border-slate-900 outline-none transition-all"
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>

                  <div className="pt-4">
                    <p className="text-xs text-slate-500 font-medium mb-3">Didn't receive the code?</p>
                    <button
                      onClick={handleResendOtp}
                      className="px-6 py-2 rounded-full border border-slate-200 text-xs font-bold text-slate-900 hover:bg-slate-50 transition-all active:scale-95"
                    >
                      Resend Code
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 bg-slate-50/50 flex gap-4">
                <button
                  onClick={handleCancelOtp}
                  className="flex-1 py-4 px-6 border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-white transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerifyOtp}
                  disabled={otp.join("").length !== 6}
                  className={`flex-[1.5] py-4 px-6 rounded-2xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-slate-200 ${
                    otp.join("").length === 6
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  Verify Code
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
