import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Edit2, Camera, Eye, X, AlertCircle, UploadCloud, RefreshCw, Check } from "lucide-react"
import BottomPopup from "../components/BottomPopup"
import { toast } from "sonner"
import { deliveryAPI, uploadAPI } from "@/lib/api"

/**
 * Utility to compress image before upload to speed up network transfer
 */
const compressImage = async (file, maxWidth = 700, maxHeight = 700, quality = 0.6) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          }));
        }, 'image/jpeg', quality);
      };
    };
  });
};

export default function ProfileDetails() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [showVehiclePopup, setShowVehiclePopup] = useState(false)
  const [vehicleInput, setVehicleInput] = useState("")
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [showDocumentModal, setShowDocumentModal] = useState(false)
  const [showBankDetailsPopup, setShowBankDetailsPopup] = useState(false)
  const [bankDetails, setBankDetails] = useState({
    accountHolderName: "",
    accountNumber: "",
    ifscCode: "",
    bankName: ""
  })
  const [bankDetailsErrors, setBankDetailsErrors] = useState({})
  const [isUpdatingBankDetails, setIsUpdatingBankDetails] = useState(false)
  const [showPayoutDetailsPopup, setShowPayoutDetailsPopup] = useState(false)
  const [payoutDetails, setPayoutDetails] = useState({
    upiId: "",
    qrCode: null
  })
  const [isUpdatingPayoutDetails, setIsUpdatingPayoutDetails] = useState(false)
  const [qrUploading, setQrUploading] = useState(false)
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false)
  const [showPhotoPopup, setShowPhotoPopup] = useState(false)
  const [tempPhotoFile, setTempPhotoFile] = useState(null)
  const [tempPhotoPreview, setTempPhotoPreview] = useState(null)
  const [vehicleError, setVehicleError] = useState("")



  const [showDocumentDetailsPopup, setShowDocumentDetailsPopup] = useState(false)
  const [documentDetails, setDocumentDetails] = useState({
    aadharNumber: "",
    panNumber: ""
  })
  const [documentDetailsErrors, setDocumentDetailsErrors] = useState({})
  const [documentTouched, setDocumentTouched] = useState({})
  const [isUpdatingDocuments, setIsUpdatingDocuments] = useState(false)

  const [showRiderDetailsPopup, setShowRiderDetailsPopup] = useState(false)
  const [riderDetails, setRiderDetails] = useState({
    vehicleType: "",
    vehicleNumber: "",
    city: ""
  })
  const [riderDetailsErrors, setRiderDetailsErrors] = useState({})
  const [riderTouched, setRiderTouched] = useState({})
  const [isUpdatingRider, setIsUpdatingRider] = useState(false)

  const [bankTouched, setBankTouched] = useState({})
  const [confirmCloseAction, setConfirmCloseAction] = useState(null) // { type, onSave }

  // Custom Camera States
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const videoRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [capturedImage, setCapturedImage] = useState(null)
  const [facingMode, setFacingMode] = useState("environment")
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)

  // Check for multiple cameras on mount
  useEffect(() => {
    const checkCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(device => device.kind === 'videoinput')
        setHasMultipleCameras(videoDevices.length > 1)
      } catch (err) {
      }
    }
    checkCameras()
  }, [])

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
  }

  const startCamera = async () => {
    stopCamera()
    try {
      const constraints = {
        video: { facingMode: facingMode },
        audio: false
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(mediaStream)
    } catch (err) {
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        setStream(fallbackStream)
      } catch (fallbackErr) {
        toast.error("Could not access camera. Please check permissions.")
        setIsCameraOpen(false)
      }
    }
  }

  useEffect(() => {
    if (isCameraOpen) startCamera()
    else stopCamera()
    return () => stopCamera()
  }, [isCameraOpen, facingMode])

  useEffect(() => {
    if (stream && videoRef.current && !capturedImage) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(e => {})
    }
  }, [stream, capturedImage])

  const takePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas")
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      const ctx = canvas.getContext("2d")
      ctx.drawImage(videoRef.current, 0, 0)
      const dataUrl = canvas.toDataURL("image/jpeg")
      setCapturedImage(dataUrl)
    }
  }

  const useCapturedPhoto = async () => {
    if (capturedImage) {
      const res = await fetch(capturedImage)
      const blob = await res.blob()
      const file = new File([blob], "profile_capture.jpg", { type: "image/jpeg" })
      
      setTempPhotoFile(file)
      setTempPhotoPreview(capturedImage)
      setIsCameraOpen(false)
      setCapturedImage(null)
      setShowPhotoPopup(true)
    }
  }

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        const response = await deliveryAPI.getProfile()
        if (response?.data?.success && response?.data?.data?.profile) {
          const profileData = response.data.data.profile
          setProfile(profileData)
          setVehicleNumber(profileData?.vehicle?.number || "")
          setVehicleInput(profileData?.vehicle?.number || "")
          // Set bank details
          setBankDetails({
            accountHolderName: profileData?.documents?.bankDetails?.accountHolderName || "",
            accountNumber: profileData?.documents?.bankDetails?.accountNumber || "",
            ifscCode: profileData?.documents?.bankDetails?.ifscCode || "",
            bankName: profileData?.documents?.bankDetails?.bankName || ""
          })
          setPayoutDetails({
            upiId: profileData?.documents?.upiId || "",
            qrCode: profileData?.documents?.qrCode || null
          })
        }
      } catch (error) {
        console.error("Error fetching profile:", error)

        // More detailed error handling
        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          toast.error("Cannot connect to server. Please check if backend is running.")
        } else if (error.response?.status === 401) {
          toast.error("Session expired. Please login again.")
          // Optionally redirect to login
          setTimeout(() => {
            navigate("/delivery/sign-in", { replace: true })
          }, 2000)
        } else {
          toast.error(error?.response?.data?.message || "Failed to load profile data")
        }
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [navigate])

  const handleQrUpload = async (file) => {
    if (!file) return
    if (!file.type?.startsWith("image/")) {
      toast.error("Please upload a valid image")
      return
    }
    setQrUploading(true)
    try {
      const res = await uploadAPI.uploadMedia(file, { folder: "delivery/qr-codes" })
      const data = res?.data?.data
      if (!data?.url) throw new Error("Upload failed")
      setPayoutDetails((prev) => ({
        ...prev,
        qrCode: { url: data.url, publicId: data.publicId }
      }))
      toast.success("QR code uploaded")
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || "Failed to upload QR code")
    } finally {
      setQrUploading(false)
    }
  }

  const savePayoutDetails = async () => {
    setIsUpdatingPayoutDetails(true)
    try {
      await deliveryAPI.updateProfile({
        documents: {
          upiId: payoutDetails.upiId?.trim() || "",
          qrCode: payoutDetails.qrCode || null
        }
      })
      toast.success("Payout details updated successfully")
      setShowPayoutDetailsPopup(false)
      const response = await deliveryAPI.getProfile()
      if (response?.data?.success && response?.data?.data?.profile) {
        setProfile(response.data.data.profile)
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update payout details")
    } finally {
      setIsUpdatingPayoutDetails(false)
    }
  }

  const handlePhotoSelection = (file) => {
    if (!file) return
    if (!file.type?.startsWith("image/")) {
      toast.error("Please upload a valid image")
      return
    }
    
    const reader = new FileReader()
    reader.onloadend = () => {
      setTempPhotoPreview(reader.result)
      setTempPhotoFile(file)
      // Ensure popup is open to show preview
      setShowPhotoPopup(true)
    }
    reader.onerror = () => {
      toast.error("Failed to read image")
    }
    reader.readAsDataURL(file)
  }

  const finalizePhotoUpload = async () => {
    if (!tempPhotoFile || !tempPhotoPreview) return
    
    // Save original for rollback if needed
    const originalProfile = { ...profile }
    
    // 1. Optimistic UI Update: Update the photo on screen immediately
    setProfile(prev => ({
      ...prev,
      profileImage: { 
        url: tempPhotoPreview, 
        publicId: prev?.profileImage?.publicId 
      }
    }))
    
    // 2. Clear temp states and Close popup immediately
    setShowPhotoPopup(false)
    const toastId = toast.loading("Saving changes...")
    
    try {
      // 3. Compress & Upload in the background
      const compressedFile = await compressImage(tempPhotoFile)
      const res = await uploadAPI.uploadMedia(compressedFile, { folder: "delivery/profile-photos" })
      const data = res?.data?.data
      if (!data?.url) throw new Error("Upload failed")
      
      // 4. Update profile in database
      const updateRes = await deliveryAPI.updateProfile({
        profileImage: { url: data.url, publicId: data.publicId }
      })
      
      if (updateRes?.data?.data?.profile) {
        setProfile(updateRes.data.data.profile)
      }
      
      toast.success("Profile photo updated!", { id: toastId })
      
      // Clean up backup states
      setTempPhotoFile(null)
      setTempPhotoPreview(null)
    } catch (error) {
      toast.error("Failed to save photo. Restoring original...", { id: toastId })
      
      // Rollback to original profile if upload failed
      setProfile(originalProfile)
    } finally {
      setIsUpdatingPhoto(false)
    }
  }



  const saveBankDetailsAction = async () => {
    // Validate
    const errors = {}
    if (!bankDetails.accountHolderName.trim()) {
      errors.accountHolderName = "Account holder name is required"
    } else if (bankDetails.accountHolderName.length < 3) {
      errors.accountHolderName = "Name must be at least 3 characters"
    }
    if (!bankDetails.accountNumber.trim()) {
      errors.accountNumber = "Account number is required"
    } else if (bankDetails.accountNumber.length < 9 || bankDetails.accountNumber.length > 18) {
      errors.accountNumber = "Account number must be between 9 and 18 digits"
    }
    if (!bankDetails.ifscCode.trim()) {
      errors.ifscCode = "IFSC code is required"
    } else if (bankDetails.ifscCode.length !== 11) {
      errors.ifscCode = "IFSC code must be 11 characters"
    }
    if (!bankDetails.bankName.trim()) {
      errors.bankName = "Bank name is required"
    } else if (bankDetails.bankName.length < 3) {
      errors.bankName = "Bank name must be at least 3 characters"
    }

    if (Object.keys(errors).length > 0) {
      setBankDetailsErrors(errors)
      setBankTouched({
        accountHolderName: true,
        accountNumber: true,
        ifscCode: true,
        bankName: true
      })
      toast.error("Please fill all required fields correctly")
      return false
    }

    setIsUpdatingBankDetails(true)
    try {
      await deliveryAPI.updateProfile({
        documents: {
          bankDetails: {
            accountHolderName: bankDetails.accountHolderName.trim(),
            accountNumber: bankDetails.accountNumber.trim(),
            ifscCode: bankDetails.ifscCode.trim(),
            bankName: bankDetails.bankName.trim()
          }
        }
      })
      toast.success("Bank details updated successfully")
      setShowBankDetailsPopup(false)
      const res = await deliveryAPI.getProfile()
      if (res?.data?.success) setProfile(res.data.data.profile)
      return true
    } catch (e) {
      toast.error("Update failed")
      return false
    } finally {
      setIsUpdatingBankDetails(false)
    }
  }


  const saveRiderDetailsAction = async () => {
    if (riderDetails.vehicleNumber.length < 5 || riderDetails.city.length < 3) {
      setRiderTouched({ vehicleNumber: true, city: true })
      toast.error("Please fill all fields correctly")
      return false
    }
    setIsUpdatingRider(true)
    try {
      await deliveryAPI.updateProfile({
        vehicle: {
          ...profile?.vehicle,
          type: riderDetails.vehicleType,
          number: riderDetails.vehicleNumber
        },
        location: {
          ...profile?.location,
          city: riderDetails.city
        }
      })
      toast.success("Rider details updated")
      setShowRiderDetailsPopup(false)
      const res = await deliveryAPI.getProfile()
      if (res?.data?.success) setProfile(res.data.data.profile)
      return true
    } catch (e) {
      toast.error("Update failed")
      return false
    } finally {
      setIsUpdatingRider(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-4 border-b border-gray-200">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-medium">Profile</h1>
      </div>

      {/* Profile Picture Area */}
      <div className="relative w-full bg-gray-200 overflow-hidden flex items-center justify-center">
        {(profile?.profileImage?.url || profile?.documents?.photo) ? (
          <img
            src={profile?.profileImage?.url || profile?.documents?.photo}
            alt="Profile"
            className="w-full h-auto max-h-96 object-contain"
          />
        ) : (
          <div className="w-full h-64 flex items-center justify-center bg-gray-100 italic text-gray-400">
            No profile image available
          </div>
        )}
        
        {/* Edit Button Overlay */}
        <button 
          onClick={() => setShowPhotoPopup(true)}
          disabled={isUpdatingPhoto}
          className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-xl hover:bg-white active:scale-95 transition-all border border-black/5"
        >
          <Edit2 className="w-5 h-5 text-black" />
        </button>
        
        {isUpdatingPhoto && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center">
             <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin shadow-lg" />
          </div>
        )}
      </div>

      <input
        type="file"
        id="profile-photo-input"
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handlePhotoSelection(e.target.files[0]);
            e.target.value = ""; // Clear for re-selection
          }
        }}
      />

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Rider Details Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">Rider details</h2>
            <button
              onClick={() => {
                setRiderDetails({
                  vehicleType: profile?.vehicle?.type || "",
                  vehicleNumber: profile?.vehicle?.number || "",
                  city: profile?.location?.city || ""
                })
                setRiderDetailsErrors({})
                setRiderTouched({})
                setShowRiderDetailsPopup(true)
              }}
              className="text-green-600 font-medium text-sm flex items-center gap-1 hover:text-green-700"
            >
              <Edit2 className="w-4 h-4" />
              <span>Edit</span>
            </button>
          </div>
          <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-200">
            <div className="p-2 px-3 flex items-center justify-between">
              <p className="text-base text-gray-900">
                {loading ? "Loading..." : `${profile?.name || ""} (${profile?.deliveryId || "N/A"})`}
              </p>
            </div>
            <div className="divide-y divide-gray-200">
              <div className="p-2 px-3 flex items-center justify-between">
                <p className="text-sm text-gray-900">Zone</p>
                <p className="text-base text-gray-900">
                  {profile?.availability?.zones?.length > 0 ? "Assigned" : "Not assigned"}
                </p>
              </div>
              <div className="p-2 px-3 flex items-center justify-between">
                <p className="text-sm text-gray-900">City</p>
                <p className="text-base text-gray-900">
                  {profile?.location?.city || "N/A"}
                </p>
              </div>
              <div className="p-2 px-3 flex items-center justify-between">
                <p className="text-sm text-gray-900">Vehicle type</p>
                <p className="text-base text-gray-900 capitalize">
                  {profile?.vehicle?.type || "N/A"}
                </p>
              </div>
              <div className="p-2 px-3 flex items-center justify-between">
                <p className="text-sm text-gray-900">Vehicle number</p>
                <p className="text-base text-gray-900">
                  {profile?.vehicle?.number || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Documents Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-medium text-gray-900">Documents</h2>
          </div>
          <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-200">
            {/* Aadhar Card */}
            <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900 leading-tight">Aadhaar Card</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${profile?.documents?.aadhar?.verified ? 'bg-green-500' : profile?.documents?.aadhar?.document ? 'bg-yellow-500' : 'bg-red-500'}`} />
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    {profile?.documents?.aadhar?.verified ? "Verified" : profile?.documents?.aadhar?.document ? "Pending" : "Not uploaded"}
                  </p>
                </div>
              </div>
              {profile?.documents?.aadhar?.document && (
                <button
                  onClick={() => {
                    setSelectedDocument({
                      name: "Aadhaar Card",
                      url: profile.documents.aadhar.document
                    })
                    setShowDocumentModal(true)
                  }}
                  className="p-2.5 bg-gray-50 hover:bg-green-50 rounded-xl transition-all group"
                >
                  <Eye className="w-5 h-5 text-gray-400 group-hover:text-green-600" />
                </button>
              )}
            </div>

            {/* PAN Card */}
            <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900 leading-tight">PAN Card</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${profile?.documents?.pan?.verified ? 'bg-green-500' : profile?.documents?.pan?.document ? 'bg-yellow-500' : 'bg-red-500'}`} />
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    {profile?.documents?.pan?.verified ? "Verified" : profile?.documents?.pan?.document ? "Pending" : "Not uploaded"}
                  </p>
                </div>
              </div>
              {profile?.documents?.pan?.document && (
                <button
                  onClick={() => {
                    setSelectedDocument({
                      name: "PAN Card",
                      url: profile.documents.pan.document
                    })
                    setShowDocumentModal(true)
                  }}
                  className="p-2.5 bg-gray-50 hover:bg-green-50 rounded-xl transition-all group"
                >
                  <Eye className="w-5 h-5 text-gray-400 group-hover:text-green-600" />
                </button>
              )}
            </div>

            {/* Driving License */}
            <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900 leading-tight">Driving License</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${profile?.documents?.drivingLicense?.verified ? 'bg-green-500' : profile?.documents?.drivingLicense?.document ? 'bg-yellow-500' : 'bg-red-500'}`} />
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    {profile?.documents?.drivingLicense?.verified ? "Verified" : profile?.documents?.drivingLicense?.document ? "Pending" : "Not uploaded"}
                  </p>
                </div>
              </div>
              {profile?.documents?.drivingLicense?.document && (
                <button
                  onClick={() => {
                    setSelectedDocument({
                      name: "Driving License",
                      url: profile.documents.drivingLicense.document
                    })
                    setShowDocumentModal(true)
                  }}
                  className="p-2.5 bg-gray-50 hover:bg-green-50 rounded-xl transition-all group"
                >
                  <Eye className="w-5 h-5 text-gray-400 group-hover:text-green-600" />
                </button>
              )}
            </div>


          </div>
        </div>

        {/* Personal Details Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-medium text-gray-900">Personal details</h2>
          </div>
          <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-200">
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Phone</p>
                <p className="text-base text-gray-900">
                  {profile?.phone || "N/A"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Email</p>
                <p className="text-base text-gray-900">{profile?.email || "-"}</p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Aadhaar Card Number</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.aadhar?.number || "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Pan Card Number</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.pan?.number || "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Rating</p>
                <p className="text-base text-gray-900">
                  {profile?.metrics?.rating ? `${profile.metrics.rating.toFixed(1)} (${profile.metrics.ratingCount || 0})` : "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Wallet Balance</p>
                <p className="text-base text-gray-900">
                  ₹{profile?.wallet?.balance?.toFixed(2) || "0.00"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Status</p>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${['active', 'approved'].includes(profile?.status) ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <p className="text-base text-gray-900 capitalize font-medium">
                    {profile?.status || "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">Bank details</h2>
            <button
              onClick={() => {
                setShowBankDetailsPopup(true)
                // Pre-fill form with existing data
                setBankDetails({
                  accountHolderName: profile?.documents?.bankDetails?.accountHolderName || "",
                  accountNumber: profile?.documents?.bankDetails?.accountNumber || "",
                  ifscCode: profile?.documents?.bankDetails?.ifscCode || "",
                  bankName: profile?.documents?.bankDetails?.bankName || ""
                })
                setBankDetailsErrors({})
                setBankTouched({})
              }}
              className="text-green-600 font-medium text-sm flex items-center gap-1 hover:text-green-700"
            >
              <Edit2 className="w-4 h-4" />
              <span>Edit</span>
            </button>
          </div>
          <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-200">
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Account Holder Name</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.bankDetails?.accountHolderName || "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Account Number</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.bankDetails?.accountNumber
                    ? `****${profile.documents.bankDetails.accountNumber.slice(-4)}`
                    : "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">IFSC Code</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.bankDetails?.ifscCode || "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Bank Name</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.bankDetails?.bankName || "-"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">Payout methods</h2>
            <button
              onClick={() => {
                setShowPayoutDetailsPopup(true)
                setPayoutDetails({
                  upiId: profile?.documents?.upiId || "",
                  qrCode: profile?.documents?.qrCode || null
                })
              }}
              className="text-green-600 font-medium text-sm flex items-center gap-1 hover:text-green-700"
            >
              <Edit2 className="w-4 h-4" />
              <span>Edit</span>
            </button>
          </div>
          <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-200">
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">UPI ID</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.upiId || "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">QR Code</p>
                {profile?.documents?.qrCode?.url ? (
                  <img
                    src={profile.documents.qrCode.url}
                    alt="QR Code"
                    className="h-16 w-16 object-contain rounded border border-gray-200"
                  />
                ) : (
                  <p className="text-base text-gray-900">-</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* Document Image Modal */}
      {
        showDocumentModal && selectedDocument && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto relative">
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowDocumentModal(false)
                  setSelectedDocument(null)
                }}
                className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>

              {/* Document Title */}
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">{selectedDocument.name}</h3>
              </div>

              {/* Document Image */}
              <div className="p-4">
                <img
                  src={selectedDocument.url}
                  alt={selectedDocument.name}
                  className="w-full h-auto rounded-lg"
                />
              </div>
            </div>
          </div>
        )
      }

      {/* Bank Details Edit Popup */}
      <BottomPopup
        isOpen={showBankDetailsPopup}
        onClose={() => {
          const isChanged =
            bankDetails.accountHolderName !== (profile?.documents?.bankDetails?.accountHolderName || "") ||
            bankDetails.accountNumber !== (profile?.documents?.bankDetails?.accountNumber || "") ||
            bankDetails.ifscCode !== (profile?.documents?.bankDetails?.ifscCode || "") ||
            bankDetails.bankName !== (profile?.documents?.bankDetails?.bankName || "");

          if (isChanged) {
            setConfirmCloseAction({
              type: 'bank',
              onSave: saveBankDetailsAction,
              onDiscard: () => {
                setShowBankDetailsPopup(false);
                setConfirmCloseAction(null);
              }
            });
          } else {
            setShowBankDetailsPopup(false);
          }
        }}
        title="Edit Bank Details"
        showCloseButton={true}
        closeOnBackdropClick={true}
        maxHeight="80vh"
      >
        <div className="space-y-4">          {/* Account Holder Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
            <input
              type="text"
              value={bankDetails.accountHolderName}
              onChange={(e) => {
                const val = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                setBankDetails(prev => ({ ...prev, accountHolderName: val }))
              }}
              onBlur={() => setBankTouched(p => ({ ...p, accountHolderName: true }))}
              placeholder="As per bank records"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-all ${bankTouched.accountHolderName && (bankDetails.accountHolderName.length < 3 || /[^a-zA-Z\s]/.test(bankDetails.accountHolderName)) ? "border-red-500 focus:ring-red-500" : "border-gray-300"}`}
            />
            {bankTouched.accountHolderName && bankDetails.accountHolderName.length < 3 && (
              <p className="text-red-500 text-sm mt-1 animate-in fade-in slide-in-from-top-1">Name must be at least 3 characters</p>
            )}
          </div>

          {/* Account Number */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
              <input
                type="text"
                value={bankDetails.accountNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setBankDetails(prev => ({ ...prev, accountNumber: val }))
                }}
                onBlur={() => setBankTouched(p => ({ ...p, accountNumber: true }))}
                placeholder="Enter account number"
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-all ${bankTouched.accountNumber && bankDetails.accountNumber.length < 9 ? "border-red-500 focus:ring-red-500" : "border-gray-300"}`}
              />
              {bankTouched.accountNumber && bankDetails.accountNumber.length < 9 && (
                <p className="text-red-500 text-sm mt-1 animate-in fade-in slide-in-from-top-1">Valid account number required (min 9 digits)</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
              <input
                type="text"
                value={bankDetails.ifscCode}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
                  setBankDetails(prev => ({ ...prev, ifscCode: val }))
                }}
                onBlur={() => setBankTouched(p => ({ ...p, ifscCode: true }))}
                placeholder="e.g. SBIN0001234"
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-all ${bankTouched.ifscCode && bankDetails.ifscCode.length !== 11 ? "border-red-500 focus:ring-red-500" : "border-gray-300"}`}
              />
              {bankTouched.ifscCode && bankDetails.ifscCode.length !== 11 && (
                <p className="text-red-500 text-sm mt-1 animate-in fade-in slide-in-from-top-1">Exactly 11 characters</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
              <input
                type="text"
                value={bankDetails.bankName}
                onChange={(e) => setBankDetails(prev => ({ ...prev, bankName: e.target.value }))}
                onBlur={() => setBankTouched(p => ({ ...p, bankName: true }))}
                placeholder="e.g. HDFC Bank"
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-all ${bankTouched.bankName && bankDetails.bankName.length < 3 ? "border-red-500 focus:ring-red-500" : "border-gray-300"}`}
              />
              {bankTouched.bankName && bankDetails.bankName.length < 3 && (
                <p className="text-red-500 text-sm mt-1 animate-in fade-in slide-in-from-top-1">Required</p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={saveBankDetailsAction}
            disabled={isUpdatingBankDetails}
            className={`w-full py-3 rounded-lg font-medium text-white transition-colors ${isUpdatingBankDetails
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#00B761] hover:bg-[#00A055]"
              }`}
          >
            {isUpdatingBankDetails ? "Updating..." : "Save Bank Details"}
          </button>
        </div>
      </BottomPopup>

      {/* Payout Details Popup */}
      <BottomPopup
        isOpen={showPayoutDetailsPopup}
        onClose={() => {
          const isChanged =
            (payoutDetails.upiId || "").trim() !== (profile?.documents?.upiId || "").trim() ||
            (payoutDetails.qrCode?.url || null) !== (profile?.documents?.qrCode?.url || null);

          if (isChanged) {
            setConfirmCloseAction({
              type: 'payout',
              onSave: savePayoutDetails
            });
          } else {
            setShowPayoutDetailsPopup(false);
          }
        }}
        title="Edit Payout Details"
        showCloseButton={true}
        closeOnBackdropClick={true}
        maxHeight="70vh"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID</label>
            <input
              type="text"
              value={payoutDetails.upiId}
              onChange={(e) => setPayoutDetails(prev => ({ ...prev, upiId: e.target.value }))}
              placeholder="Enter UPI ID"
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 border-gray-300"
            />
          </div>
          <div className="pt-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">QR Code</label>
            <div className="relative">
              <input
                type="file"
                id="qr-upload"
                accept="image/*"
                onChange={(e) => handleQrUpload(e.target.files?.[0])}
                className="hidden"
              />
              <label
                htmlFor="qr-upload"
                className="flex flex-col items-center justify-center w-full py-6 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-green-500 hover:bg-green-50/30 transition-all group"
              >
                <div className="flex flex-col items-center justify-center">
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-2 group-hover:bg-green-100 transition-colors">
                    <UploadCloud className="w-5 h-5 text-gray-400 group-hover:text-green-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-600">
                    {payoutDetails.qrCode?.url ? "Change QR Code" : "Upload QR Code"}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">PNG, JPG up to 3MB</p>
                </div>
              </label>
            </div>

            {qrUploading && (
              <div className="flex items-center gap-2 mt-2 px-1">
                <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-gray-500 font-medium">Uploading QR code...</p>
              </div>
            )}

            {payoutDetails.qrCode?.url && !qrUploading && (
              <div className="mt-4 p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-4">
                <img
                  src={payoutDetails.qrCode.url}
                  alt="QR Code"
                  className="h-16 w-16 object-contain rounded-lg border border-white shadow-sm"
                />
                <div>
                  <p className="text-xs font-bold text-gray-900 leading-tight">Current QR Code</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider font-bold">Ready to save</p>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={savePayoutDetails}
            disabled={isUpdatingPayoutDetails || qrUploading}
            className={`w-full py-3 rounded-lg font-medium text-white transition-colors ${isUpdatingPayoutDetails || qrUploading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#00B761] hover:bg-[#00A055]"
              }`}
          >
            {isUpdatingPayoutDetails ? "Updating..." : "Save Payout Details"}
          </button>
        </div>
      </BottomPopup>





      {/* Confirm Discard Dialog */}
      {confirmCloseAction && (
        <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-yellow-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Discard Changes?</h3>
            <p className="text-sm text-gray-500 mb-8 leading-relaxed">
              Are you sure you don't want to save these changes? Your changes will be lost.
            </p>
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={async () => {
                  const saved = await confirmCloseAction.onSave();
                  if (saved) setConfirmCloseAction(null);
                }}
                className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:bg-gray-900 active:scale-[0.98] transition-all"
              >
                Save Changes
              </button>
              <button
                onClick={() => {

                  if (confirmCloseAction.type === 'rider') setShowRiderDetailsPopup(false);
                  if (confirmCloseAction.type === 'bank') setShowBankDetailsPopup(false);
                  if (confirmCloseAction.type === 'payout') setShowPayoutDetailsPopup(false);
                  setConfirmCloseAction(null);
                }}
                className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 active:scale-[0.98] transition-all"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rider Details Edit Popup */}
      <BottomPopup
        isOpen={showRiderDetailsPopup}
        onClose={() => {
          const isChanged =
            riderDetails.vehicleType !== (profile?.vehicle?.type || "") ||
            riderDetails.vehicleNumber !== (profile?.vehicle?.number || "") ||
            riderDetails.city !== (profile?.location?.city || "");

          if (isChanged) {
            setConfirmCloseAction({
              type: 'rider',
              onSave: saveRiderDetailsAction
            });
          } else {
            setShowRiderDetailsPopup(false);
          }
        }}
        title="Edit Rider Details"
        showCloseButton={true}
        closeOnBackdropClick={true}
        maxHeight="60vh"
      >
        <div className="space-y-4 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
              <select
                value={riderDetails.vehicleType}
                onChange={(e) => setRiderDetails(prev => ({ ...prev, vehicleType: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="bike">Bike</option>
                <option value="scooter">Scooter</option>
                <option value="bicycle">Bicycle</option>
                <option value="car">Car</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={riderDetails.city}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                  setRiderDetails(prev => ({ ...prev, city: val }))
                }}
                onBlur={() => setRiderTouched(p => ({ ...p, city: true }))}
                placeholder="Enter city"
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-all ${riderTouched.city && riderDetails.city.length < 3 ? "border-red-500 focus:ring-red-500" : "border-gray-300"}`}
              />
              {riderTouched.city && riderDetails.city.length < 3 && (
                <p className="text-red-500 text-sm mt-1 animate-in fade-in slide-in-from-top-1">City must be at least 3 characters</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
            <input
              type="text"
              value={riderDetails.vehicleNumber}
              onChange={(e) => {
                const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
                setRiderDetails(prev => ({ ...prev, vehicleNumber: val }))
              }}
              onBlur={() => setRiderTouched(p => ({ ...p, vehicleNumber: true }))}
              maxLength={10}
              placeholder="e.g. MH12AB1234"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-all ${riderTouched.vehicleNumber && riderDetails.vehicleNumber.length < 5 ? "border-red-500 focus:ring-red-500" : "border-gray-300"}`}
            />
            {riderTouched.vehicleNumber && riderDetails.vehicleNumber.length < 5 && (
              <p className="text-red-500 text-sm mt-1 animate-in fade-in slide-in-from-top-1">Valid vehicle number required (min 5 chars)</p>
            )}
          </div>

          <button
            onClick={saveRiderDetailsAction}
            disabled={isUpdatingRider}
            className="w-full bg-black text-white py-4 rounded-xl font-bold mt-4"
          >
            {isUpdatingRider ? "Saving..." : "Save Rider Details"}
          </button>
        </div>
      </BottomPopup>

      {/* Custom Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[1100] flex flex-col bg-black">
          <div className="flex-shrink-0 flex items-center justify-between p-4 text-white z-[1001] bg-black">
            <h3 className="text-lg font-medium">Take Photo</h3>
            <div className="flex items-center gap-2">

              <button onClick={() => { setIsCameraOpen(false); setCapturedImage(null); }} className="p-2">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
            {capturedImage ? (
              <img src={capturedImage} className={`w-full h-full object-contain ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} alt="Captured" />
            ) : (
              <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-contain ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
            )}
          </div>
          <div className="flex-shrink-0 p-8 pb-12 bg-black flex items-center justify-center border-0 m-0">
            {capturedImage ? (
              <>
                <button onClick={() => setCapturedImage(null)} className="flex flex-col items-center gap-2 text-white">
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center"><X className="w-6 h-6" /></div>
                  <span className="text-xs font-medium">Retake</span>
                </button>
                <button onClick={useCapturedPhoto} className="flex flex-col items-center gap-2 text-white">
                  <div className="w-14 h-14 rounded-full bg-[#00B761] flex items-center justify-center"><Check className="w-6 h-6" /></div>
                  <span className="text-xs font-medium">Use Photo</span>
                </button>
              </>
            ) : (
              <div className="relative flex items-center justify-center w-full">
                <button
                  onClick={takePhoto}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center p-1">
                    <div className="w-full h-full rounded-full bg-white transition-transform active:scale-95 group-hover:scale-105"></div>
                  </div>
                </button>
                {!capturedImage && (
                  <button
                    onClick={() => setFacingMode(p => p === "environment" ? "user" : "environment")}
                    className="absolute right-0 w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors active:bg-white/30"
                    title="Switch Camera"
                  >
                    <RefreshCw className="w-6 h-6 text-white" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Change Photo Popup */}
      <BottomPopup
        isOpen={showPhotoPopup}
        onClose={() => {
          if (!isUpdatingPhoto) {
            setShowPhotoPopup(false)
            setTempPhotoFile(null)
            setTempPhotoPreview(null)
          }
        }}
        title={tempPhotoPreview ? "Confirm Photo" : "Update Profile Photo"}
      >
        <div className="space-y-4 pb-2">
          {tempPhotoPreview ? (
            <div className="flex flex-col items-center">
              <div className="w-48 h-48 rounded-3xl overflow-hidden border-4 border-green-50 shadow-inner mb-6 transition-all animate-in zoom-in-95 duration-300">
                <img src={tempPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  onClick={() => finalizePhotoUpload()}
                  disabled={isUpdatingPhoto}
                  className="py-4 bg-[#00B761] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#00A055] active:scale-[0.98] transition-all shadow-lg shadow-green-100"
                >
                  Select
                </button>
                <button
                  onClick={() => {
                    setTempPhotoFile(null)
                    setTempPhotoPreview(null)
                  }}
                  disabled={isUpdatingPhoto}
                  className="py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 active:scale-[0.98] transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => {
                  setShowPhotoPopup(false);
                  setIsCameraOpen(true);
                }}
                className="w-full py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-900 active:scale-[0.98] transition-all"
              >
                <Camera className="w-5 h-5 text-white" />
                Camera
              </button>
              <button
                onClick={() => document.getElementById("profile-photo-input").click()}
                className="w-full py-4 bg-gray-50 text-gray-900 border border-gray-200 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-100 active:scale-[0.98] transition-all"
              >
                <UploadCloud className="w-5 h-5 text-gray-600" />
                Upload Photo
              </button>
              <button
                onClick={() => setShowPhotoPopup(false)}
                className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </BottomPopup>
    </div>
  )
}
