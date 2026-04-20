import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Building2, Info, Tag, Upload, Calendar, FileText, MapPin, CheckCircle2, X, Image as ImageIcon, Clock, Loader2, ChevronDown, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { adminAPI, uploadAPI } from "@/lib/api"
import { toast } from "sonner"

const cuisinesOptions = [
  "North Indian",
  "South Indian",
  "Chinese",
  "Pizza",
  "Burgers",
  "Bakery",
  "Cafe",
]

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export default function AddRestaurant() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [createdRestaurantData, setCreatedRestaurantData] = useState(null)

  // Step 1: Basic Info
  const [step1, setStep1] = useState({
    restaurantName: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    primaryContactNumber: "",
    location: {
      addressLine1: "",
      addressLine2: "",
      area: "",
      city: "",
      state: "",
      pincode: "",
      landmark: "",
    },
  })

  // Step 2: Images & Operational
  const [step2, setStep2] = useState({
    menuImages: [],
    profileImage: null,
    cuisines: [],
    openingTime: "09:00",
    closingTime: "22:00",
    openDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  })

  // Step 3: Documents
  const [step3, setStep3] = useState({
    panNumber: "",
    nameOnPan: "",
    panImage: null,
    gstRegistered: false,
    gstNumber: "",
    gstLegalName: "",
    gstAddress: "",
    gstImage: null,
    fssaiNumber: "",
    fssaiExpiry: "",
    fssaiImage: null,
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
    accountHolderName: "",
    accountType: "",
  })

  // Step 4: Display Info
  const [step4, setStep4] = useState({
    estimatedDeliveryTime: "25-30 mins",
    featuredDish: "",
    featuredPrice: "249",
    offer: "",
  })



  const languageTabs = [
    { key: "default", label: "Default" },
    { key: "en", label: "English(EN)" },
    { key: "bn", label: "Bengali - বাংলা(BN)" },
    { key: "ar", label: "Arabic - العربية (AR)" },
    { key: "es", label: "Spanish - español(ES)" },
  ]

  // Time helpers
  const parse24To12 = (time24) => {
    if (!time24) return { hour: "09", minute: "00", period: "AM" }
    const [h, m] = time24.split(":")
    const hour24 = parseInt(h)
    const period = hour24 >= 12 ? "PM" : "AM"
    const hour12 = hour24 % 12 || 12
    return { hour: hour12.toString().padStart(2, "0"), minute: m, period }
  }

  const format12To24 = (h, m, period) => {
    let hour = parseInt(h)
    if (period === "PM" && hour !== 12) hour += 12
    if (period === "AM" && hour === 12) hour = 0
    return `${hour.toString().padStart(2, "0")}:${m}`
  }

  // Upload handler for images
  const handleUpload = async (file, folder) => {
    try {
      const res = await uploadAPI.uploadMedia(file, { folder })
      const d = res?.data?.data || res?.data
      return { url: d.url, publicId: d.publicId }
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to upload image"
      console.error("Upload error:", errorMsg, err)
      throw new Error(`Image upload failed: ${errorMsg}`)
    }
  }

  // Validation functions
  const validateStep1 = () => {
    const errors = {}
    const nameRegex = /^[a-zA-Z0-9\s&'()-.]+$/
    const textOnlyRegex = /^[a-zA-Z\s]+$/

    if (!step1.restaurantName?.trim()) {
      errors.restaurantName = "Restaurant name is required"
    } else if (!nameRegex.test(step1.restaurantName)) {
      errors.restaurantName = "Please enter a valid restaurant name (letters, numbers, spaces & symbols like &, -, () allowed)"
    }

    if (!step1.ownerName?.trim()) {
      errors.ownerName = "Owner name is required"
    } else if (!/^[a-zA-Z\s.]+$/.test(step1.ownerName)) {
      errors.ownerName = "Owner name should contain only letters"
    }

    if (!step1.ownerEmail?.trim()) {
      errors.ownerEmail = "Owner email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(step1.ownerEmail)) {
      errors.ownerEmail = "Please enter a valid email address"
    }

    if (!step1.ownerPhone?.trim()) {
      errors.ownerPhone = "Owner phone number is required"
    } else if (!/^\d{10}$/.test(step1.ownerPhone.replace(/\s/g, ""))) {
      errors.ownerPhone = "Please enter a valid 10-digit phone number"
    }

    if (!step1.primaryContactNumber?.trim()) {
      errors.primaryContactNumber = "Primary contact number is required"
    } else if (!/^\d{10}$/.test(step1.primaryContactNumber.replace(/\s/g, ""))) {
      errors.primaryContactNumber = "Please enter a valid 10-digit phone number"
    }

    if (!step1.location?.area?.trim()) errors.area = "Area/Sector/Locality is required"

    if (!step1.location?.city?.trim()) {
      errors.city = "City is required"
    } else if (!textOnlyRegex.test(step1.location.city)) {
      errors.city = "City name should contain only letters"
    }

    if (!step1.location?.state?.trim()) {
      errors.state = "State is required"
    } else if (step1.location.state.trim().length < 2) {
      errors.state = "State name is too short"
    } else if (!textOnlyRegex.test(step1.location.state)) {
      errors.state = "State name should contain only letters"
    }

    if (!step1.location?.pincode?.trim()) {
      errors.pincode = "Pin code is required"
    } else if (!/^\d{6}$/.test(step1.location.pincode)) {
      errors.pincode = "Please enter a valid 6-digit pin code"
    }

    return errors
  }

  const validateStep2 = () => {
    const errors = {}
    if (!step2.menuImages || step2.menuImages.length === 0) errors.menuImages = "At least one menu image is required"
    if (!step2.profileImage) errors.profileImage = "Restaurant profile image is required"
    if (!step2.cuisines || step2.cuisines.length === 0) errors.cuisines = "Please select at least one cuisine"
    if (!step2.openingTime?.trim()) errors.openingTime = "Opening time is required"
    if (!step2.closingTime?.trim()) errors.closingTime = "Closing time is required"
    if (!step2.openDays || step2.openDays.length === 0) errors.openDays = "Please select at least one open day"
    return errors
  }

  const validateStep3 = () => {
    const errors = {}
    const personNameRegex = /^[a-zA-Z\s.]+$/
    const businessNameRegex = /^[a-zA-Z0-9\s&'()-.]+$/

    if (!step3.panNumber?.trim()) {
      errors.panNumber = "PAN number is required"
    } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(step3.panNumber.toUpperCase())) {
      errors.panNumber = "Invalid PAN format (e.g., ABCDE1234F)"
    }

    if (!step3.nameOnPan?.trim()) {
      errors.nameOnPan = "Name on PAN is required"
    } else if (!personNameRegex.test(step3.nameOnPan)) {
      errors.nameOnPan = "Name should contain only letters"
    }

    if (!step3.panImage) errors.panImage = "PAN image is required"

    if (!step3.fssaiNumber?.trim()) {
      errors.fssaiNumber = "FSSAI number is required"
    } else if (!/^\d{14}$/.test(step3.fssaiNumber)) {
      errors.fssaiNumber = "FSSAI number must be exactly 14 digits"
    }

    if (!step3.fssaiExpiry?.trim()) {
      errors.fssaiExpiry = "FSSAI expiry date is required"
    } else {
      const selectedDate = new Date(step3.fssaiExpiry)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (selectedDate < today) {
        errors.fssaiExpiry = "FSSAI expiry date cannot be in the past"
      }
    }

    if (!step3.fssaiImage) errors.fssaiImage = "FSSAI image is required"

    if (step3.gstRegistered) {
      if (!step3.gstNumber?.trim()) {
        errors.gstNumber = "GST number is required"
      } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(step3.gstNumber.toUpperCase())) {
        errors.gstNumber = "Invalid GST format"
      }
      if (!step3.gstLegalName?.trim()) {
        errors.gstLegalName = "GST legal name is required"
      } else if (!businessNameRegex.test(step3.gstLegalName)) {
        errors.gstLegalName = "Please enter a valid legal name"
      }
      if (!step3.gstAddress?.trim()) errors.gstAddress = "GST registered address is required"
      if (!step3.gstImage) errors.gstImage = "GST image is required"
    }

    if (!step3.accountNumber?.trim()) {
      errors.accountNumber = "Account number is required"
    } else if (!/^\d{9,20}$/.test(step3.accountNumber)) {
      errors.accountNumber = "Please enter a valid bank account number (9-20 digits)"
    }

    if (step3.accountNumber !== step3.confirmAccountNumber) {
      errors.confirmAccountNumber = "Account numbers do not match"
    }

    if (!step3.ifscCode?.trim()) {
      errors.ifscCode = "IFSC code is required"
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(step3.ifscCode.toUpperCase())) {
      errors.ifscCode = "Invalid IFSC format (e.g., SBIN0001234)"
    }

    if (!step3.accountHolderName?.trim()) {
      errors.accountHolderName = "Account holder name is required"
    } else if (!personNameRegex.test(step3.accountHolderName)) {
      errors.accountHolderName = "Account holder name should contain only letters"
    }

    if (!step3.accountType?.trim()) errors.accountType = "Account type is required"
    return errors
  }

  const validateStep4 = () => {
    const errors = {}
    if (!step4.estimatedDeliveryTime?.trim()) errors.estimatedDeliveryTime = "Estimated delivery time is required"
    if (!step4.featuredDish?.trim()) {
      errors.featuredDish = "Featured dish name is required"
    } else if (!/^[a-zA-Z0-9\s()&'-]+$/.test(step4.featuredDish)) {
      errors.featuredDish = "Please enter a valid dish name"
    }
    if (!step4.featuredPrice || isNaN(parseFloat(step4.featuredPrice)) || parseFloat(step4.featuredPrice) <= 0) {
      errors.featuredPrice = "Valid price > 0 is required"
    }
    if (!step4.offer?.trim()) {
      errors.offer = "Special offer or promotion text is required"
    }
    return errors
  }

  const handleNext = () => {
    setFormErrors({})
    let validationErrors = {}

    if (step === 1) {
      validationErrors = validateStep1()
    } else if (step === 2) {
      validationErrors = validateStep2()
    } else if (step === 3) {
      validationErrors = validateStep3()
    } else if (step === 4) {
      validationErrors = validateStep4()
    }

    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors)
      toast.error("Please fill all required fields correctly")
      return
    }

    if (step < 4) {
      setStep(step + 1)
      window.scrollTo(0, 0)
    } else {
      handleSubmit()
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setFormErrors({})

    try {
      // Upload all images first
      let profileImageData = null
      if (step2.profileImage instanceof File) {
        profileImageData = await handleUpload(step2.profileImage, "appzeto/restaurant/profile")
      } else if (step2.profileImage?.url) {
        profileImageData = step2.profileImage
      }

      let menuImagesData = []
      for (const file of step2.menuImages.filter(f => f instanceof File)) {
        const uploaded = await handleUpload(file, "appzeto/restaurant/menu")
        menuImagesData.push(uploaded)
      }
      const existingMenuUrls = step2.menuImages.filter(img => !(img instanceof File) && (img?.url || (typeof img === 'string' && img.startsWith('http'))))
      menuImagesData = [...existingMenuUrls, ...menuImagesData]

      let panImageData = null
      if (step3.panImage instanceof File) {
        panImageData = await handleUpload(step3.panImage, "appzeto/restaurant/pan")
      } else if (step3.panImage?.url) {
        panImageData = step3.panImage
      }

      let gstImageData = null
      if (step3.gstRegistered && step3.gstImage) {
        if (step3.gstImage instanceof File) {
          gstImageData = await handleUpload(step3.gstImage, "appzeto/restaurant/gst")
        } else if (step3.gstImage?.url) {
          gstImageData = step3.gstImage
        }
      }

      let fssaiImageData = null
      if (step3.fssaiImage instanceof File) {
        fssaiImageData = await handleUpload(step3.fssaiImage, "appzeto/restaurant/fssai")
      } else if (step3.fssaiImage?.url) {
        fssaiImageData = step3.fssaiImage
      }

      // Prepare payload
      const payload = {
        // Step 1
        restaurantName: step1.restaurantName,
        ownerName: step1.ownerName,
        ownerEmail: step1.ownerEmail,
        ownerPhone: step1.ownerPhone,
        primaryContactNumber: step1.primaryContactNumber,
        location: step1.location,
        // Step 2
        menuImages: menuImagesData,
        profileImage: profileImageData,
        cuisines: step2.cuisines,
        openingTime: step2.openingTime,
        closingTime: step2.closingTime,
        openDays: step2.openDays,
        // Step 3
        panNumber: step3.panNumber,
        nameOnPan: step3.nameOnPan,
        panImage: panImageData,
        gstRegistered: step3.gstRegistered,
        gstNumber: step3.gstNumber,
        gstLegalName: step3.gstLegalName,
        gstAddress: step3.gstAddress,
        gstImage: gstImageData,
        fssaiNumber: step3.fssaiNumber,
        fssaiExpiry: step3.fssaiExpiry,
        fssaiImage: fssaiImageData,
        accountNumber: step3.accountNumber,
        ifscCode: step3.ifscCode,
        accountHolderName: step3.accountHolderName,
        accountType: step3.accountType,
        // Step 4
        estimatedDeliveryTime: step4.estimatedDeliveryTime,
        featuredDish: step4.featuredDish,
        featuredPrice: parseFloat(step4.featuredPrice) || 249,
        offer: step4.offer,
        // Auth
        email: step1.ownerEmail || null,
        phone: step1.ownerPhone || null,
        signupMethod: step1.ownerEmail ? 'email' : 'phone',
        businessModel: 'Commission Base',
      }

      // Call backend API
      const response = await adminAPI.createRestaurant(payload)

      if (response.data.success) {
        toast.success("Restaurant created successfully!")
        setCreatedRestaurantData(response.data.data)
        setShowSuccessDialog(true)
      } else {
        throw new Error(response.data.message || "Failed to create restaurant")
      }
    } catch (error) {
      console.error("Error creating restaurant:", error)
      const errorMsg = error?.response?.data?.message || error?.message || "Failed to create restaurant. Please try again."
      toast.error(errorMsg)
      setFormErrors({ submit: errorMsg })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Render functions for each step
  const renderStep1 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md">
        <h2 className="text-lg font-semibold text-black mb-4">Restaurant information</h2>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-700">Restaurant name*</Label>
            <Input
              value={step1.restaurantName || ""}
              onChange={(e) => setStep1({ ...step1, restaurantName: e.target.value.replace(/[^a-zA-Z0-9\s&'()-.]/g, "") })}
              className={`mt-1 bg-white text-sm text-black placeholder-gray-400 ${formErrors.restaurantName ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"}`}
              placeholder="e.g., The Grand Kitchen"
              maxLength={100}
            />
            {formErrors.restaurantName && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.restaurantName}</p>}
          </div>
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md">
        <h2 className="text-lg font-semibold text-black mb-4">Owner details</h2>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-gray-700">Full name*</Label>
            <Input
              value={step1.ownerName || ""}
              onChange={(e) => setStep1({ ...step1, ownerName: e.target.value.replace(/[^a-zA-Z\s.]/g, "") })}
              className={`mt-1 bg-white text-sm text-black placeholder-gray-400 ${formErrors.ownerName ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"}`}
              placeholder="Owner full name"
            />
            {formErrors.ownerName && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.ownerName}</p>}
          </div>
          <div>
            <Label className="text-xs text-gray-700">Email address*</Label>
            <Input
              type="email"
              value={step1.ownerEmail || ""}
              onChange={(e) => setStep1({ ...step1, ownerEmail: e.target.value.trim() })}
              className={`mt-1 bg-white text-sm text-black placeholder-gray-400 ${formErrors.ownerEmail ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"}`}
              placeholder="owner@example.com"
            />
            {formErrors.ownerEmail && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.ownerEmail}</p>}
          </div>
          <div>
            <Label className="text-xs text-gray-700">Phone number*</Label>
            <Input
              value={step1.ownerPhone || ""}
              onChange={(e) => setStep1({ ...step1, ownerPhone: e.target.value.replace(/[^0-9]/g, "").slice(0, 10) })}
              className={`mt-1 bg-white text-sm text-black placeholder-gray-400 ${formErrors.ownerPhone ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"}`}
              placeholder="10-digit mobile number"
              maxLength={10}
            />
            {formErrors.ownerPhone && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.ownerPhone}</p>}
          </div>
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">Restaurant contact & location</h2>
        <div>
          <Label className="text-xs text-gray-700">Primary contact number*</Label>
          <Input
            value={step1.primaryContactNumber || ""}
            onChange={(e) => setStep1({ ...step1, primaryContactNumber: e.target.value.replace(/[^0-9]/g, "").slice(0, 10) })}
            className={`mt-1 bg-white text-sm text-black placeholder-gray-400 ${formErrors.primaryContactNumber ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"}`}
            placeholder="Restaurant's 10-digit number"
            maxLength={10}
          />
          {formErrors.primaryContactNumber && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.primaryContactNumber}</p>}
        </div>
        <div className="space-y-3">
          <div>
            <Input
              value={step1.location?.area || ""}
              onChange={(e) => setStep1({ ...step1, location: { ...step1.location, area: e.target.value } })}
              className={`bg-white text-sm placeholder-gray-400 ${formErrors.area ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"}`}
              placeholder="Area / Sector / Locality*"
            />
            {formErrors.area && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.area}</p>}
          </div>
          <div>
            <Input
              value={step1.location?.city || ""}
              onChange={(e) => setStep1({ ...step1, location: { ...step1.location, city: e.target.value.replace(/[^a-zA-Z\s]/g, "") } })}
              className={`bg-white text-sm placeholder-gray-400 ${formErrors.city ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"}`}
              placeholder="City*"
            />
            {formErrors.city && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.city}</p>}
          </div>
          <Input
            value={step1.location?.addressLine1 || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, addressLine1: e.target.value } })}
            className="bg-white text-sm border-gray-300 placeholder-gray-400"
            placeholder="Shop no. / building no. (optional)"
          />
          <Input
            value={step1.location?.addressLine2 || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, addressLine2: e.target.value } })}
            className="bg-white text-sm border-gray-300 placeholder-gray-400"
            placeholder="Floor / tower (optional)"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-700">State*</Label>
              <Input
                value={step1.location?.state || ""}
                onChange={(e) => setStep1({ ...step1, location: { ...step1.location, state: e.target.value.replace(/[^a-zA-Z\s]/g, "") } })}
                className={`bg-white text-sm placeholder-gray-400 ${formErrors.state ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"}`}
                placeholder="e.g., Madhya Pradesh"
                maxLength={30}
              />
              {formErrors.state && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.state}</p>}
            </div>
            <div>
              <Label className="text-xs text-gray-700">Pin code*</Label>
              <Input
                value={step1.location?.pincode || ""}
                onChange={(e) => setStep1({ ...step1, location: { ...step1.location, pincode: e.target.value.replace(/[^0-9]/g, "").slice(0, 6) } })}
                className={`bg-white text-sm placeholder-gray-400 ${formErrors.pincode ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"}`}
                placeholder="6-digit pin code"
                maxLength={6}
              />
              {formErrors.pincode && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.pincode}</p>}
            </div>
          </div>
          <Input
            value={step1.location?.landmark || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, landmark: e.target.value } })}
            className="bg-white text-sm"
            placeholder="Nearby landmark (optional)"
          />
        </div>
      </section>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md space-y-5">
        <h2 className="text-lg font-semibold text-black">Menu & photos</h2>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-700">Menu images*</Label>
          <div className={`mt-1 border border-dashed rounded-md bg-gray-50/70 px-4 py-3 ${formErrors.menuImages ? "border-red-500" : "border-gray-300"}`}>
            <label htmlFor="menuImagesInput" className="inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white text-black border-black text-xs font-medium cursor-pointer w-full items-center">
              <Upload className="w-4.5 h-4.5" />
              <span>Choose files</span>
            </label>
            <input
              id="menuImagesInput"
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || [])
                if (files.length) {
                  setStep2((prev) => ({ ...prev, menuImages: [...(prev.menuImages || []), ...files] }))
                  e.target.value = ''
                }
              }}
            />
          </div>
          {formErrors.menuImages && <p className="text-[10px] text-red-500">{formErrors.menuImages}</p>}
          {step2.menuImages.length > 0 && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {step2.menuImages.map((file, idx) => {
                const imageUrl = file instanceof File ? URL.createObjectURL(file) : (file?.url || file)
                return (
                  <div key={idx} className="relative aspect-[4/5] rounded-md overflow-hidden bg-gray-100">
                    {imageUrl && <img src={imageUrl} alt={`Menu ${idx + 1}`} className="w-full h-full object-cover" />}
                    <button
                      type="button"
                      onClick={() => setStep2((prev) => ({ ...prev, menuImages: prev.menuImages.filter((_, i) => i !== idx) }))}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-700">Restaurant profile image*</Label>
          <div className="flex items-center gap-4">
            <div className={`h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-2 ${formErrors.profileImage ? "border-red-500" : "border-transparent"}`}>
              {step2.profileImage ? (
                (() => {
                  const imageSrc = step2.profileImage instanceof File ? URL.createObjectURL(step2.profileImage) : (step2.profileImage?.url || step2.profileImage)
                  return imageSrc ? <img src={imageSrc} alt="Profile" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-gray-500" />
                })()
              ) : (
                <ImageIcon className="w-6 h-6 text-gray-500" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <label htmlFor="profileImageInput" className="inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white text-black border border-black text-xs font-medium cursor-pointer hover:bg-gray-50">
                  <Upload className="w-4 h-4" />
                  <span>Upload</span>
                </label>
                {step2.profileImage && (
                  <button
                    type="button"
                    onClick={() => setStep2((prev) => ({ ...prev, profileImage: null }))}
                    className="inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-red-50 text-red-600 border border-red-200 text-xs font-medium cursor-pointer hover:bg-red-100"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
              {formErrors.profileImage && <p className="text-[10px] text-red-500 font-medium">{formErrors.profileImage}</p>}
            </div>
            <input
              id="profileImageInput"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] || null
                if (file) setStep2((prev) => ({ ...prev, profileImage: file }))
                e.target.value = ''
              }}
            />
          </div>
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-5">
        <div>
          <Label className="text-xs text-gray-700">Select cuisines (up to 3)*</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {cuisinesOptions.map((cuisine) => {
              const active = step2.cuisines.includes(cuisine)
              return (
                <button
                  key={cuisine}
                  type="button"
                  onClick={() => {
                    setStep2((prev) => {
                      const exists = prev.cuisines.includes(cuisine)
                      if (exists) return { ...prev, cuisines: prev.cuisines.filter((c) => c !== cuisine) }
                      if (prev.cuisines.length >= 3) return prev
                      return { ...prev, cuisines: [...prev.cuisines, cuisine] }
                    })
                  }}
                  className={`px-3 py-1.5 text-xs rounded-full border ${active ? "bg-black text-white border-black" : "bg-gray-100 text-gray-800 border-transparent"} ${formErrors.cuisines ? "border-red-500" : ""}`}
                >
                  {cuisine}
                </button>
              )
            })}
          </div>
          {formErrors.cuisines && <p className="text-[10px] text-red-500 mt-1">{formErrors.cuisines}</p>}
        </div>

        <div className="space-y-4">
          <Label className="text-xs text-gray-700 font-medium flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            Delivery timings*
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 bg-gray-50/50 rounded-lg border border-gray-100">
            {/* Opening Time */}
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Opening time</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={parse24To12(step2.openingTime).hour}
                  onValueChange={(h) => {
                    const { minute, period } = parse24To12(step2.openingTime)
                    setStep2({ ...step2, openingTime: format12To24(h, minute, period) })
                  }}
                >
                  <SelectTrigger className="w-20 bg-white border-gray-200">
                    <SelectValue placeholder="HH" />
                  </SelectTrigger>
                  <SelectContent className="bg-white max-h-48">
                    {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <span className="text-gray-400 font-bold">:</span>

                <Select
                  value={parse24To12(step2.openingTime).minute}
                  onValueChange={(m) => {
                    const { hour, period } = parse24To12(step2.openingTime)
                    setStep2({ ...step2, openingTime: format12To24(hour, m, period) })
                  }}
                >
                  <SelectTrigger className="w-20 bg-white border-gray-200">
                    <SelectValue placeholder="MM" />
                  </SelectTrigger>
                  <SelectContent className="bg-white max-h-48">
                    {Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')).map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={parse24To12(step2.openingTime).period}
                  onValueChange={(p) => {
                    const { hour, minute } = parse24To12(step2.openingTime)
                    setStep2({ ...step2, openingTime: format12To24(hour, minute, p) })
                  }}
                >
                  <SelectTrigger className="w-24 bg-white border-gray-200">
                    <SelectValue placeholder="AM/PM" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formErrors.openingTime && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.openingTime}</p>}
            </div>

            {/* Closing Time */}
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Closing time</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={parse24To12(step2.closingTime).hour}
                  onValueChange={(h) => {
                    const { minute, period } = parse24To12(step2.closingTime)
                    setStep2({ ...step2, closingTime: format12To24(h, minute, period) })
                  }}
                >
                  <SelectTrigger className="w-20 bg-white border-gray-200">
                    <SelectValue placeholder="HH" />
                  </SelectTrigger>
                  <SelectContent className="bg-white max-h-48">
                    {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <span className="text-gray-400 font-bold">:</span>

                <Select
                  value={parse24To12(step2.closingTime).minute}
                  onValueChange={(m) => {
                    const { hour, period } = parse24To12(step2.closingTime)
                    setStep2({ ...step2, closingTime: format12To24(hour, m, period) })
                  }}
                >
                  <SelectTrigger className="w-20 bg-white border-gray-200">
                    <SelectValue placeholder="MM" />
                  </SelectTrigger>
                  <SelectContent className="bg-white max-h-48">
                    {Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')).map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={parse24To12(step2.closingTime).period}
                  onValueChange={(p) => {
                    const { hour, minute } = parse24To12(step2.closingTime)
                    setStep2({ ...step2, closingTime: format12To24(hour, minute, p) })
                  }}
                >
                  <SelectTrigger className="w-24 bg-white border-gray-200">
                    <SelectValue placeholder="AM/PM" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formErrors.closingTime && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.closingTime}</p>}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-gray-700 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-800" />
            <span>Open days*</span>
          </Label>
          <div className="mt-1 grid grid-cols-7 gap-1.5 sm:gap-2">
            {daysOfWeek.map((day) => {
              const active = step2.openDays.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setStep2((prev) => {
                      const exists = prev.openDays.includes(day)
                      if (exists) return { ...prev, openDays: prev.openDays.filter((d) => d !== day) }
                      return { ...prev, openDays: [...prev.openDays, day] }
                    })
                  }}
                  className={`aspect-square flex items-center justify-center rounded-md text-[11px] font-medium border ${active ? "bg-black text-white border-black" : "bg-gray-100 text-gray-800 border-transparent"} ${formErrors.openDays ? "border-red-500" : ""}`}
                >
                  {day.charAt(0)}
                </button>
              )
            })}
          </div>
          {formErrors.openDays && <p className="text-[10px] text-red-500 mt-1">{formErrors.openDays}</p>}
        </div>
      </section>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">PAN details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-gray-700">PAN number*</Label>
            <Input
              value={step3.panNumber || ""}
              onChange={(e) => setStep3({ ...step3, panNumber: e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10) })}
              className={`mt-1 bg-white text-sm text-black placeholder-gray-400 ${formErrors.panNumber ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"}`}
              placeholder="e.g., ABCDE1234F"
              maxLength={10}
            />
            {formErrors.panNumber && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.panNumber}</p>}
          </div>
          <div>
            <Label className="text-xs text-gray-700">Name on PAN*</Label>
            <Input
              value={step3.nameOnPan || ""}
              onChange={(e) => setStep3({ ...step3, nameOnPan: e.target.value.replace(/[^a-zA-Z\s.]/g, "") })}
              className={`mt-1 bg-white text-sm text-black placeholder-gray-400 ${formErrors.nameOnPan ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"}`}
              placeholder="Name on PAN card"
            />
            {formErrors.nameOnPan && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.nameOnPan}</p>}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-gray-700">PAN image*</Label>
          <div className="flex items-center gap-4">
            {step3.panImage && (
              <div className="h-16 w-16 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden border">
                <img
                  src={step3.panImage instanceof File ? URL.createObjectURL(step3.panImage) : (step3.panImage?.url || step3.panImage)}
                  alt="PAN Preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex gap-2">
              <label htmlFor="panImageInput" className="inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white text-black border border-black text-xs font-medium cursor-pointer hover:bg-gray-50">
                <Upload className="w-4 h-4" />
                <span>Upload PAN</span>
              </label>
              {step3.panImage && (
                <button
                  type="button"
                  onClick={() => setStep3((prev) => ({ ...prev, panImage: null }))}
                  className="inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-red-50 text-red-600 border border-red-200 text-xs font-medium cursor-pointer hover:bg-red-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <input
              id="panImageInput"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setStep3({ ...step3, panImage: e.target.files?.[0] || null })}
            />
          </div>
          {formErrors.panImage && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.panImage}</p>}
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">GST details</h2>
        <div className="flex gap-4 items-center text-sm">
          <span className="text-gray-700">GST registered?</span>
          <button
            type="button"
            onClick={() => setStep3({ ...step3, gstRegistered: true })}
            className={`px-3 py-1.5 text-xs rounded-full ${step3.gstRegistered ? "bg-black text-white" : "bg-gray-100 text-gray-800"}`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setStep3({ ...step3, gstRegistered: false })}
            className={`px-3 py-1.5 text-xs rounded-full ${!step3.gstRegistered ? "bg-black text-white" : "bg-gray-100 text-gray-800"}`}
          >
            No
          </button>
        </div>
        {step3.gstRegistered && (
          <div className="space-y-3">
            <div>
              <Input
                value={step3.gstNumber || ""}
                onChange={(e) => setStep3({ ...step3, gstNumber: e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 15) })}
                className={`bg-white text-sm placeholder-gray-400 ${formErrors.gstNumber ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"}`}
                placeholder="15-digit GST number*"
                maxLength={15}
              />
              {formErrors.gstNumber && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.gstNumber}</p>}
            </div>
            <div>
              <Input
                value={step3.gstLegalName || ""}
                onChange={(e) => setStep3({ ...step3, gstLegalName: e.target.value })}
                className={`bg-white text-sm placeholder-gray-400 ${formErrors.gstLegalName ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"}`}
                placeholder="GST Legal name*"
              />
              {formErrors.gstLegalName && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.gstLegalName}</p>}
            </div>
            <div>
              <Input
                value={step3.gstAddress || ""}
                onChange={(e) => setStep3({ ...step3, gstAddress: e.target.value })}
                className={`bg-white text-sm placeholder-gray-400 ${formErrors.gstAddress ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"}`}
                placeholder="GST Registered address*"
              />
              {formErrors.gstAddress && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.gstAddress}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-gray-700">GST certificate*</Label>
              <div className="flex items-center gap-4">
                {step3.gstImage && (
                  <div className="h-16 w-16 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden border">
                    <img
                      src={step3.gstImage instanceof File ? URL.createObjectURL(step3.gstImage) : (step3.gstImage?.url || step3.gstImage)}
                      alt="GST Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <label htmlFor="gstImageInput" className="inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white text-black border border-black text-xs font-medium cursor-pointer hover:bg-gray-50">
                    <Upload className="w-4 h-4" />
                    <span>Upload GST</span>
                  </label>
                  {step3.gstImage && (
                    <button
                      type="button"
                      onClick={() => setStep3((prev) => ({ ...prev, gstImage: null }))}
                      className="inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-red-50 text-red-600 border border-red-200 text-xs font-medium cursor-pointer hover:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <input
                  id="gstImageInput"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setStep3({ ...step3, gstImage: e.target.files?.[0] || null })}
                />
              </div>
              {formErrors.gstImage && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.gstImage}</p>}
            </div>
          </div>
        )}
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">FSSAI details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input
              value={step3.fssaiNumber || ""}
              onChange={(e) => setStep3({ ...step3, fssaiNumber: e.target.value.replace(/[^0-9]/g, "").slice(0, 14) })}
              className={`bg-white text-sm placeholder-gray-400 ${formErrors.fssaiNumber ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"}`}
              placeholder="14-digit FSSAI number*"
              maxLength={14}
            />
            {formErrors.fssaiNumber && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.fssaiNumber}</p>}
          </div>
          <div>
            <Label className="text-xs text-gray-700 mb-1 block">FSSAI expiry date*</Label>
            <Input
              type="date"
              value={step3.fssaiExpiry || ""}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setStep3({ ...step3, fssaiExpiry: e.target.value })}
              className={`bg-white text-sm ${formErrors.fssaiExpiry ? "border-red-500 ring-1 ring-red-500" : "border-gray-200"}`}
            />
            {formErrors.fssaiExpiry && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.fssaiExpiry}</p>}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-gray-700">FSSAI certificate*</Label>
          <div className="flex items-center gap-4">
            {step3.fssaiImage && (
              <div className="h-16 w-16 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden border">
                <img
                  src={step3.fssaiImage instanceof File ? URL.createObjectURL(step3.fssaiImage) : (step3.fssaiImage?.url || step3.fssaiImage)}
                  alt="FSSAI Preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex gap-2">
              <label htmlFor="fssaiImageInput" className="inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white text-black border border-black text-xs font-medium cursor-pointer hover:bg-gray-50">
                <Upload className="w-4 h-4" />
                <span>Upload FSSAI</span>
              </label>
              {step3.fssaiImage && (
                <button
                  type="button"
                  onClick={() => setStep3((prev) => ({ ...prev, fssaiImage: null }))}
                  className="inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-red-50 text-red-600 border border-red-200 text-xs font-medium cursor-pointer hover:bg-red-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <input
              id="fssaiImageInput"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setStep3({ ...step3, fssaiImage: e.target.files?.[0] || null })}
            />
          </div>
          {formErrors.fssaiImage && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.fssaiImage}</p>}
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">Bank account details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input
              value={step3.accountNumber || ""}
              onChange={(e) => setStep3({ ...step3, accountNumber: e.target.value.replace(/[^0-9]/g, "") })}
              className={`bg-white text-sm placeholder-gray-400 ${formErrors.accountNumber ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"}`}
              placeholder="Enter account number*"
              maxLength={20}
            />
            {formErrors.accountNumber && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.accountNumber}</p>}
          </div>
          <div>
            <Input
              value={step3.confirmAccountNumber || ""}
              onChange={(e) => setStep3({ ...step3, confirmAccountNumber: e.target.value.replace(/[^0-9]/g, "") })}
              onPaste={(e) => e.preventDefault()}
              className={`bg-white text-sm placeholder-gray-400 ${formErrors.confirmAccountNumber ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"}`}
              placeholder="Confirm account number*"
              maxLength={20}
            />
            {formErrors.confirmAccountNumber && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.confirmAccountNumber}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input
              value={step3.ifscCode || ""}
              onChange={(e) => setStep3({ ...step3, ifscCode: e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 11) })}
              className={`bg-white text-sm placeholder-gray-400 ${formErrors.ifscCode ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"}`}
              placeholder="IFSC code*"
              maxLength={11}
            />
            {formErrors.ifscCode && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.ifscCode}</p>}
          </div>
          <div>
            <Label className="text-xs text-gray-700 mb-1 block">Account type*</Label>
            <Select
              value={step3.accountType}
              onValueChange={(val) => setStep3({ ...step3, accountType: val })}
            >
              <SelectTrigger className={`bg-white text-sm ${formErrors.accountType ? "border-red-500" : ""}`}>
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="Saving">Saving</SelectItem>
                <SelectItem value="Current">Current</SelectItem>
              </SelectContent>
            </Select>
            {formErrors.accountType && <p className="text-[10px] text-red-500 mt-1">{formErrors.accountType}</p>}
          </div>
        </div>
        <div>
          <Label className="text-xs text-gray-700">Account holder name*</Label>
          <Input
            value={step3.accountHolderName || ""}
            onChange={(e) => setStep3({ ...step3, accountHolderName: e.target.value.replace(/[^a-zA-Z\s.]/g, "") })}
            className={`bg-white text-sm placeholder-gray-400 ${formErrors.accountHolderName ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"}`}
            placeholder="Account holder name*"
          />
          {formErrors.accountHolderName && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.accountHolderName}</p>}
        </div>
      </section>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">Restaurant Display Information</h2>
        <div>
          <Label className="text-xs text-gray-700">Estimated Delivery Time*</Label>
          <Input 
            value={step4.estimatedDeliveryTime || ""} 
            onChange={(e) => setStep4({ ...step4, estimatedDeliveryTime: e.target.value })} 
            className={`mt-1 bg-white text-sm border-gray-300 placeholder-gray-400 ${formErrors.estimatedDeliveryTime ? "border-red-500 ring-1 ring-red-500" : ""}`} 
            placeholder="e.g., 25-30 mins" 
          />
          {formErrors.estimatedDeliveryTime && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.estimatedDeliveryTime}</p>}
        </div>
        <div>
          <Label className="text-xs text-gray-700">Featured Dish Name*</Label>
          <Input 
            value={step4.featuredDish || ""} 
            onChange={(e) => setStep4({ ...step4, featuredDish: e.target.value.replace(/[^a-zA-Z0-9\s()&'-]/g, "") })} 
            className={`mt-1 bg-white text-sm border-gray-300 placeholder-gray-400 ${formErrors.featuredDish ? "border-red-500 ring-1 ring-red-500" : ""}`} 
            placeholder="e.g., Butter Chicken Special" 
          />
          {formErrors.featuredDish && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.featuredDish}</p>}
        </div>
        <div>
          <Label className="text-xs text-gray-700">Featured Dish Price (₹)*</Label>
          <Input 
            type="text" 
            value={step4.featuredPrice || ""} 
            onChange={(e) => setStep4({ ...step4, featuredPrice: e.target.value.replace(/[^0-9]/g, "") })} 
            className={`mt-1 bg-white text-sm border-gray-300 placeholder-gray-400 ${formErrors.featuredPrice ? "border-red-500 ring-1 ring-red-500" : ""}`} 
            placeholder="e.g., 249" 
          />
          {formErrors.featuredPrice && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.featuredPrice}</p>}
        </div>
        <div>
          <Label className="text-xs text-gray-700">Special Offer/Promotion*</Label>
          <Input 
            value={step4.offer || ""} 
            onChange={(e) => setStep4({ ...step4, offer: e.target.value })} 
            className={`mt-1 bg-white text-sm border-gray-300 placeholder-gray-400 ${formErrors.offer ? "border-red-500 ring-1 ring-red-500" : ""}`} 
            placeholder="e.g., Flat ₹50 OFF above ₹199" 
          />
          {formErrors.offer && <p className="text-[10px] text-red-500 mt-1 font-medium">{formErrors.offer}</p>}
        </div>
      </section>
    </div>
  )



  const renderStep = () => {
    if (step === 1) return renderStep1()
    if (step === 2) return renderStep2()
    if (step === 3) return renderStep3()
    return renderStep4()
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="px-4 py-4 sm:px-6 sm:py-5 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-blue-600" />
          <div className="text-sm font-semibold text-black">Add New Restaurant</div>
        </div>
        <div className="text-xs text-gray-600">Step {step} of 4</div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-4 space-y-4">
        {renderStep()}
      </main>

      {formErrors.submit && (
        <div className="px-4 sm:px-6 pb-2 text-xs text-red-600">{formErrors.submit}</div>
      )}

      <footer className="px-4 sm:px-6 py-3 bg-white">
        <div className="flex justify-between items-center">
          <Button
            variant="ghost"
            disabled={step === 1 || isSubmitting}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="text-sm text-gray-700 bg-transparent"
          >
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={isSubmitting}
            className="text-sm bg-black text-white px-6"
          >
            {step === 4 ? (isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating... </> : "Create Restaurant") : isSubmitting ? "Saving..." : "Continue"}
          </Button>
        </div>
      </footer>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={(open) => {
        setShowSuccessDialog(open);
        if (!open) navigate("/admin/restaurants");
      }}>
        <DialogContent className="max-w-md bg-white p-0">
          <div className="p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-75"></div>
                <div className="relative bg-emerald-500 rounded-full p-4">
                  <CheckCircle2 className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-slate-900 mb-2">Restaurant Created Successfully!</DialogTitle>
              <DialogDescription className="text-sm text-slate-600">
                "The restaurant has been created successfully and can now login using their phone number or email via OTP."
              </DialogDescription>
            </DialogHeader>
            <div className="mt-8">
              <Button onClick={() => navigate("/admin/restaurants")} className="w-full bg-black text-white">
                Go to Restaurant List
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
