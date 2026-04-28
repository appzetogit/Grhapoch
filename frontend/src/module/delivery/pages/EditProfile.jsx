import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  Save,
  Upload } from
"lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { hasFlutterCameraBridge, requestImageFileFromFlutter } from "@/lib/utils/cameraBridge";

export default function EditProfile() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "Jhon Doe",
    phone: "8801700000",
    email: "jhon.doe@example.com",
    shift: "Morning (04:00 AM - 11:59 AM)"
  });
  const [phoneError, setPhoneError] = useState("");

  const handleInputChange = (field, value) => {
    let finalValue = value;
    if (field === "phone") {
      finalValue = value.replace(/\D/g, "").slice(0, 10);
    }

    setFormData((prev) => ({
      ...prev,
      [field]: finalValue
    }));

    // Clear error while typing if it becomes valid
    if (field === "phone" && phoneError && finalValue.length === 10) {
      setPhoneError("");
    }
  };

  const handleBlur = (field) => {
    if (field === "phone" && formData.phone.length > 0) {
      if (formData.phone.length !== 10) {
        setPhoneError("Phone number must be exactly 10 digits");
      } else {
        setPhoneError("");
      }
    }
  };

  const handleBridgePick = (source = 'gallery') => {
    const triggerFallback = () => {
      const input = document.getElementById('profile-image-input');
      if (input) {
        if (source === 'camera') input.setAttribute('capture', 'environment');
        else input.removeAttribute('capture');
        input.click();
      }
    };

    if (!hasFlutterCameraBridge()) {
      triggerFallback();
      return;
    }

    requestImageFileFromFlutter({ source, fileNamePrefix: 'delivery_profile' })
      .then(file => {
        if (file) handlePhotoChange({ target: { files: [file] } });
      })
      .catch(err => {
        console.warn(`Bridge ${source} failed, falling back:`, err);
        triggerFallback();
      });
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Here you would typically upload to server, for now just update preview
        // This file usually expects an image URL or state update
      };
      reader.readAsDataURL(file);
      toast.success("Profile photo selected");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle form submission

    navigate("/delivery/profile");
  };

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 md:py-3 flex items-center gap-3 md:gap-4 rounded-b-3xl md:rounded-b-none">
        <button
          onClick={() => navigate("/delivery/profile")}
          className="p-1.5 md:p-2 hover:bg-gray-100 rounded-lg transition-colors">
          
          <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
        </button>
        <h1 className="text-base md:text-xl font-bold text-gray-900">Edit Profile</h1>
      </div>

      {/* Main Content */}
      <div className="px-3 md:px-4 py-4 md:py-6 pb-24 md:pb-6">
        <form onSubmit={handleSubmit} className="space-y-2 md:space-y-4">
          {/* Profile Picture */}
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-3 md:p-6">
              <div className="flex flex-col items-center">
                <div className="relative mb-2 md:mb-4">
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face"
                    alt="Profile"
                    className="w-20 h-20 md:w-32 md:h-32 rounded-full border-2 md:border-4 border-white object-cover shadow-md" />
                  
                  <div className="absolute bottom-0 right-0 flex gap-1">
                    <button 
                      type="button"
                      onClick={() => handleBridgePick('gallery')}
                      className="bg-[#ff8100] text-white p-1.5 md:p-2 rounded-full cursor-pointer hover:bg-[#e67300] transition-colors shadow-sm"
                      title="Gallery"
                    >
                      <Upload className="w-3 h-3 md:w-4 md:h-4" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleBridgePick('camera')}
                      className="bg-black text-white p-1.5 md:p-2 rounded-full cursor-pointer hover:bg-gray-800 transition-colors shadow-sm"
                      title="Camera"
                    >
                      <Camera className="w-3 h-3 md:w-4 md:h-4" />
                    </button>
                  </div>
                  <input
                    id="profile-image-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange} />
                </div>
                <p className="text-gray-600 text-xs md:text-sm text-center">Tap to change profile picture</p>
              </div>
            </CardContent>
          </Card>

          {/* Name */}
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-3 md:p-6">
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                required />
              
            </CardContent>
          </Card>

          {/* Phone */}
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-3 md:p-6">
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                onBlur={() => handleBlur("phone")}
                className={`w-full px-3 md:px-4 py-2 text-sm md:text-base border rounded-lg focus:ring-2 outline-none transition-all ${
                  phoneError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-[#ff8100]'
                }`}
                required />
              {phoneError && (
                <p className="text-red-500 text-xs mt-1 font-medium animate-in fade-in slide-in-from-top-1">
                  {phoneError}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Email */}
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-3 md:p-6">
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                required />
              
            </CardContent>
          </Card>

          {/* Shift */}
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-3 md:p-6">
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">
                Shift
              </label>
              <select
                value={formData.shift}
                onChange={(e) => handleInputChange("shift", e.target.value)}
                className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none">
                
                <option value="Morning (04:00 AM - 11:59 AM)">Morning (04:00 AM - 11:59 AM)</option>
                <option value="Afternoon (12:00 PM - 07:59 PM)">Afternoon (12:00 PM - 07:59 PM)</option>
                <option value="Night (08:00 PM - 03:59 AM)">Night (08:00 PM - 03:59 AM)</option>
              </select>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button
            type="submit"
            disabled={!!phoneError || !formData.phone || !formData.name || !formData.email}
            className={`w-full font-semibold py-2.5 md:py-3 rounded-lg text-sm md:text-lg mt-2 md:mt-0 transition-all ${
              phoneError || !formData.phone || !formData.name || !formData.email
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#ff8100] hover:bg-[#e67300] text-white'
            }`}>
            
            <Save className="w-4 h-4 md:w-5 md:h-5 mr-2" />
            Save Changes
          </Button>
        </form>
      </div>

    </div>);

}