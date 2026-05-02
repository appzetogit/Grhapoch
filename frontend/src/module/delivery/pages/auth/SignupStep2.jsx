import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Upload, X, Check, Camera, Image, RefreshCw } from "lucide-react"
import { deliveryAPI } from "@/lib/api"
import apiClient from "@/lib/api/axios"
import { toast } from "sonner"
import { hasFlutterCameraBridge, requestImageFileFromFlutter } from "@/lib/utils/cameraBridge"

const DocumentUpload = ({ docType, label, required = true, uploadedDocs, uploading, handleRemove, setActiveCamera, handleFileSelect, localPreviews }) => {
  const displayUrl = localPreviews[docType] || uploadedDocs[docType]?.url
  const uploaded = uploadedDocs[docType]  // only truthy after cloudinary upload
  const isUploading = uploading[docType]
  const galleryInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <label className="block text-sm font-medium text-gray-700 mb-3">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {displayUrl ? (
        <div className="relative">
          <img
            src={displayUrl}
            alt={label}
            className="w-full h-48 object-cover rounded-lg"
          />
          {isUploading ? (
            // Centered spinner overlay on top of the preview image
            <div className="absolute inset-0 bg-black/50 rounded-lg flex flex-col items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
              <p className="text-white text-xs font-semibold tracking-wide">Uploading...</p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleRemove(docType)}
                className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors shadow-lg"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 bg-green-500 text-white px-3 py-1 rounded-full flex items-center gap-1 text-sm shadow-md">
                <Check className="w-4 h-4" />
                <span>Uploaded</span>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50/50 transition-all hover:border-gray-400">
          <div className="flex flex-col items-center w-full p-4">
            <p className="text-sm text-gray-500 mb-4">Select upload method</p>
            <div className="flex items-center justify-center gap-6 w-full">
              <button
                type="button"
                onClick={() => {
                  const triggerFallback = () => {
                    setActiveCamera(docType);
                  };

                  if (!hasFlutterCameraBridge()) {
                    triggerFallback();
                    return;
                  }

                  requestImageFileFromFlutter({ source: "camera", fileNamePrefix: docType })
                    .then(file => {
                      if (file) handleFileSelect(docType, file);
                    })
                    .catch(e => {
                      console.warn("Bridge camera failed, falling back to custom camera:", e);
                      triggerFallback();
                    });
                }}
                className="flex flex-col items-center justify-center gap-2 group"
              >
                <div className="w-16 h-16 bg-white border border-gray-200 rounded-2xl flex items-center justify-center shadow-sm group-hover:border-green-500 group-hover:bg-green-50 transition-all group-active:scale-95">
                  <Camera className="w-8 h-8 text-gray-600 group-hover:text-green-600" />
                </div>
                <span className="text-xs font-semibold text-gray-600 group-hover:text-green-600 uppercase tracking-wider">Camera</span>
              </button>

              <div className="h-10 w-[1px] bg-gray-200"></div>

              <button
                type="button"
                onClick={() => {
                  const triggerFallback = () => {
                    galleryInputRef.current?.click();
                  };

                  if (!hasFlutterCameraBridge()) {
                    triggerFallback();
                    return;
                  }

                  requestImageFileFromFlutter({ source: "gallery", fileNamePrefix: docType })
                    .then(file => {
                      if (file) handleFileSelect(docType, file);
                    })
                    .catch(e => {
                      console.warn("Bridge gallery failed, falling back to device picker:", e);
                      triggerFallback();
                    });
                }}
                className="flex flex-col items-center justify-center gap-2 group"
              >
                <div className="w-16 h-16 bg-white border border-gray-200 rounded-2xl flex items-center justify-center shadow-sm group-hover:border-green-500 group-hover:bg-green-50 transition-all group-active:scale-95">
                  <Image className="w-8 h-8 text-gray-600 group-hover:text-green-600" />
                </div>
                <span className="text-xs font-semibold text-gray-600 group-hover:text-green-600 uppercase tracking-wider">Gallery</span>
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-6 font-medium">MAX SIZE 3MB (PNG, JPG)</p>
          </div>

          {/* Hidden Input for Gallery */}
          <input
            type="file"
            ref={galleryInputRef}
            className="hidden"
            accept="image/*"
            onChange={(e) => {
              const selectedFile = e.target.files[0]
              if (selectedFile) handleFileSelect(docType, selectedFile)
              e.target.value = ''
            }}
            disabled={isUploading}
          />

          {/* Hidden Input for Native Camera Capture */}
          <input
            type="file"
            ref={cameraInputRef}
            className="hidden"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const selectedFile = e.target.files[0]
              if (selectedFile) handleFileSelect(docType, selectedFile)
              e.target.value = ''
            }}
            disabled={isUploading}
          />
        </div>
      )}
    </div>
  )
}

export default function SignupStep2() {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState(() => {
    const saved = localStorage.getItem("delivery_uploaded_docs")
    if (saved) {
      try {
        const docs = JSON.parse(saved)
        return {
          profilePhoto: docs.profilePhoto ? true : null,
          aadharPhoto: docs.aadharPhoto ? true : null,
          panPhoto: docs.panPhoto ? true : null,
          drivingLicensePhoto: docs.drivingLicensePhoto ? true : null
        }
      } catch (e) {
        console.error("Error parsing saved documents for UI:", e)
      }
    }
    return {
      profilePhoto: null,
      aadharPhoto: null,
      panPhoto: null,
      drivingLicensePhoto: null
    }
  })
  const [uploadedDocs, setUploadedDocs] = useState(() => {
    const saved = localStorage.getItem("delivery_uploaded_docs")
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error("Error parsing saved documents:", e)
      }
    }
    return {
      profilePhoto: null,
      aadharPhoto: null,
      panPhoto: null,
      drivingLicensePhoto: null
    }
  })
  const [uploading, setUploading] = useState({
    profilePhoto: false,
    aadharPhoto: false,
    panPhoto: false,
    drivingLicensePhoto: false
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Local blob previews for instant display before Cloudinary upload completes
  const [localPreviews, setLocalPreviews] = useState({
    profilePhoto: null,
    aadharPhoto: null,
    panPhoto: null,
    drivingLicensePhoto: null
  })

  // Scroll to top and fetch existing documents when page loads
  useEffect(() => {
    window.scrollTo(0, 0)

    const fetchExistingDocs = async () => {
      try {
        const response = await deliveryAPI.getProfile()
        if (response?.data?.success && response?.data?.data?.profile) {
          const profile = response.data.data.profile

          // Pre-fill uploadedDocs with existing documents from backend if localStorage is empty
          // OR if backend has more recent data (though usually localStorage is more recent during signup)
          const backendDocs = {
            profilePhoto: profile.profileImage?.url ? { url: profile.profileImage.url, publicId: profile.profileImage.publicId } : null,
            aadharPhoto: profile.documents?.aadhar?.document ? { url: profile.documents.aadhar.document, publicId: "" } : null,
            panPhoto: profile.documents?.pan?.document ? { url: profile.documents.pan.document, publicId: "" } : null,
            drivingLicensePhoto: profile.documents?.drivingLicense?.document ? { url: profile.documents.drivingLicense.document, publicId: "" } : null
          }

          setUploadedDocs(prev => {
            const hasDataAlready = Object.values(prev).some(doc => doc !== null)
            if (hasDataAlready) return prev
            return backendDocs
          })
        }
      } catch (error) {
        console.error("Error fetching existing documents:", error)
      }
    }

    fetchExistingDocs()
  }, [])

  // Sync documents UI state and persist to localStorage
  useEffect(() => {
    localStorage.setItem("delivery_uploaded_docs", JSON.stringify(uploadedDocs))

    // Sync the UI helper state
    setDocuments({
      profilePhoto: uploadedDocs.profilePhoto ? true : null,
      aadharPhoto: uploadedDocs.aadharPhoto ? true : null,
      panPhoto: uploadedDocs.panPhoto ? true : null,
      drivingLicensePhoto: uploadedDocs.drivingLicensePhoto ? true : null
    })
  }, [uploadedDocs])

  const handleFileSelect = async (docType, file) => {
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file")
      return
    }

    // Validate file size (max 3MB)
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Image size should be less than 3MB")
      return
    }

    // Show instant local preview before upload starts
    const localPreviewUrl = URL.createObjectURL(file)
    setLocalPreviews(prev => ({ ...prev, [docType]: localPreviewUrl }))
    setUploading(prev => ({ ...prev, [docType]: true }))

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'appzeto/delivery/documents')

      const response = await apiClient.post('/upload/media', formData)

      if (response?.data?.success && response?.data?.data) {
        const { url, publicId } = response.data.data

        // Replace local preview with Cloudinary URL
        URL.revokeObjectURL(localPreviewUrl)
        setLocalPreviews(prev => ({ ...prev, [docType]: null }))
        setUploadedDocs(prev => ({ ...prev, [docType]: { url, publicId } }))
      }
    } catch (error) {
      console.error(`Error uploading ${docType}:`, error)
      // Revert local preview on failure
      URL.revokeObjectURL(localPreviewUrl)
      setLocalPreviews(prev => ({ ...prev, [docType]: null }))
      toast.error(`Failed to upload ${docType.replace(/([A-Z])/g, ' $1').trim()}`)
    } finally {
      setUploading(prev => ({ ...prev, [docType]: false }))
    }
  }

  const handleRemove = (docType) => {
    // Clear local preview if any
    if (localPreviews[docType]) {
      URL.revokeObjectURL(localPreviews[docType])
      setLocalPreviews(prev => ({ ...prev, [docType]: null }))
    }
    setUploadedDocs(prev => ({ ...prev, [docType]: null }))
  }

  // Camera States
  const [activeCamera, setActiveCamera] = useState(null)
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
        console.error("Error checking cameras:", err)
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
      // Very basic constraints for maximum compatibility
      const constraints = {
        video: {
          facingMode: facingMode,
          // Remove ideal width/height as it can cause issues on some laptop cameras
        },
        audio: false
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(mediaStream)
    } catch (err) {
      console.warn(`Failed to start camera with ${facingMode}, trying generic:`, err)
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        setStream(fallbackStream)
      } catch (fallbackErr) {
        console.error("Critical camera error:", fallbackErr)
        toast.error("Could not access camera. Please check permissions.")
        setActiveCamera(null)
      }
    }
  }

  // Effect to assign stream to video element when stream or videoRef change
  useEffect(() => {
    if (stream && videoRef.current && !capturedImage) {
      videoRef.current.srcObject = stream
      // Ensure video actually plays
      videoRef.current.play().catch(e => console.error("Error playing video:", e))
    }
  }, [stream, capturedImage])

  useEffect(() => {
    if (activeCamera) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [activeCamera, facingMode])

  const toggleFacingMode = () => {
    setFacingMode(prev => prev === "environment" ? "user" : "environment")
    setCapturedImage(null)
  }

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

  const usePhoto = async () => {
    if (capturedImage) {
      // Convert data URL to File object
      const res = await fetch(capturedImage)
      const blob = await res.blob()
      const file = new File([blob], `${activeCamera}.jpg`, { type: "image/jpeg" })

      handleFileSelect(activeCamera, file)
      setActiveCamera(null)
      setCapturedImage(null)
    }
  }

  const CameraModal = () => {
    if (!activeCamera) return null

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black">
        <div className="flex-shrink-0 flex items-center justify-between p-4 text-white z-[1001] bg-black">
          <h3 className="text-lg font-medium">Take Photo</h3>
          <div className="flex items-center gap-2">

            <button onClick={() => { setActiveCamera(null); setCapturedImage(null); }} className="p-2">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
          {capturedImage ? (
            <img
              src={capturedImage}
              className={`w-full h-full object-contain ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              alt="Captured"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-contain ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
          )}
        </div>

        <div className="flex-shrink-0 p-8 pb-12 bg-black flex items-center justify-center border-0 m-0">
          {capturedImage ? (
            <>
              <button
                onClick={() => setCapturedImage(null)}
                className="flex flex-col items-center gap-2 text-white"
              >
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                  <X className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium">Retake</span>
              </button>
              <button
                onClick={usePhoto}
                className="flex flex-col items-center gap-2 text-white"
              >
                <div className="w-14 h-14 rounded-full bg-[#00B761] flex items-center justify-center">
                  <Check className="w-6 h-6" />
                </div>
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
                  onClick={toggleFacingMode}
                  className="absolute right-0 w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors active:bg-white/30"
                  title="Switch Camera"
                >
                  <RefreshCw className={`w-6 h-6 text-white ${uploading[activeCamera] ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Check if all required documents are uploaded
    if (!uploadedDocs.profilePhoto || !uploadedDocs.aadharPhoto || !uploadedDocs.panPhoto || !uploadedDocs.drivingLicensePhoto) {
      toast.error("Please upload all required documents")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await deliveryAPI.submitSignupDocuments({
        profilePhoto: uploadedDocs.profilePhoto,
        aadharPhoto: uploadedDocs.aadharPhoto,
        panPhoto: uploadedDocs.panPhoto,
        drivingLicensePhoto: uploadedDocs.drivingLicensePhoto
      })

      if (response?.data?.success) {
        toast.success("Signup completed successfully!")
        localStorage.removeItem("delivery_uploaded_docs")
        
        // Update user data to reflect completeness
        if (response?.data?.data?.profile) {
          localStorage.setItem("delivery_user", JSON.stringify(response.data.data.profile))
        } else {
          // Fallback if profile not explicitly returned
          try {
            const savedUser = localStorage.getItem("delivery_user")
            if (savedUser) {
              const parsed = JSON.parse(savedUser)
              parsed.isProfileComplete = true
              localStorage.setItem("delivery_user", JSON.stringify(parsed))
            }
          } catch (e) {
            console.error("Error updating local storage fallback:", e)
          }
        }

        // Redirect to delivery home page
        setTimeout(() => {
          navigate("/delivery", { replace: true })
        }, 1000)
      }
    } catch (error) {
      console.error("Error submitting documents:", error)
      const message = error?.response?.data?.message || "Failed to submit documents. Please try again."
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }



  return (
    <div className="min-h-screen bg-gray-100">
      <CameraModal />
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-4 border-b border-gray-200">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-medium">Upload Documents</h1>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Document Verification</h2>
          <p className="text-sm text-gray-600">Please upload clear photos of your documents</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <DocumentUpload docType="profilePhoto" label="Profile Photo" required={true} uploadedDocs={uploadedDocs} uploading={uploading} handleRemove={handleRemove} setActiveCamera={setActiveCamera} handleFileSelect={handleFileSelect} localPreviews={localPreviews} />
          <DocumentUpload docType="aadharPhoto" label="Aadhar Card Photo" required={true} uploadedDocs={uploadedDocs} uploading={uploading} handleRemove={handleRemove} setActiveCamera={setActiveCamera} handleFileSelect={handleFileSelect} localPreviews={localPreviews} />
          <DocumentUpload docType="panPhoto" label="PAN Card Photo" required={true} uploadedDocs={uploadedDocs} uploading={uploading} handleRemove={handleRemove} setActiveCamera={setActiveCamera} handleFileSelect={handleFileSelect} localPreviews={localPreviews} />
          <DocumentUpload docType="drivingLicensePhoto" label="Driving License Photo" required={true} uploadedDocs={uploadedDocs} uploading={uploading} handleRemove={handleRemove} setActiveCamera={setActiveCamera} handleFileSelect={handleFileSelect} localPreviews={localPreviews} />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !uploadedDocs.profilePhoto || !uploadedDocs.aadharPhoto || !uploadedDocs.panPhoto || !uploadedDocs.drivingLicensePhoto}
            className={`w-full py-4 rounded-lg font-bold text-white text-base transition-colors mt-6 ${isSubmitting || !uploadedDocs.profilePhoto || !uploadedDocs.aadharPhoto || !uploadedDocs.panPhoto || !uploadedDocs.drivingLicensePhoto
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#00B761] hover:bg-[#00A055]"
              }`}
          >
            {isSubmitting ? "Submitting..." : "Complete Signup"}
          </button>
        </form>
      </div>
    </div>
  )
}

