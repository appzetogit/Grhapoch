import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, AlertCircle, FileText } from "lucide-react";
import { orderAPI, uploadAPI } from "@/lib/api";
import { toast } from "sonner";
import { requestImageFileFromFlutter, hasFlutterCameraBridge } from "@/lib/utils/cameraBridge";


const COMPLAINT_TYPES = [
{ value: 'food_quality', label: 'Food Quality Issue' },
{ value: 'wrong_item', label: 'Wrong Item Received' },
{ value: 'missing_item', label: 'Missing Item' },
{ value: 'delivery_issue', label: 'Delivery Issue' },
{ value: 'packaging', label: 'Packaging Problem' },
{ value: 'pricing', label: 'Pricing Issue' },
{ value: 'service', label: 'Service Issue' },
{ value: 'other', label: 'Other' }];


export default function SubmitComplaint() {
  const navigate = useNavigate();
  const { orderId } = useParams();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    complaintType: '',
    subject: '',
    description: '',
    requestedAction: 'REFUND'
  });
  const [files, setFiles] = useState([]);

  useEffect(() => {
    if (!orderId) {
      console.error("Order ID missing from URL params");
      toast.error("Order ID is required");
      setTimeout(() => {
        navigate("/user/orders");
      }, 2000);
      return;
    }

    const fetchOrder = async () => {
      try {
        setLoading(true);

        const response = await orderAPI.getOrderDetails(orderId);

        let orderData = null;
        if (response?.data?.success && response.data.data?.order) {
          orderData = response.data.data.order;
        } else if (response?.data?.order) {
          orderData = response.data.order;
        } else {
          console.error("Order not found in response:", response?.data);
          toast.error("Order not found");
          setTimeout(() => {
            navigate("/user/orders");
          }, 2000);
          return;
        }






        setOrder(orderData);
      } catch (error) {
        console.error("Error fetching order:", error);
        toast.error(error?.response?.data?.message || "Failed to load order details");
        setTimeout(() => {
          navigate("/user/orders");
        }, 2000);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.complaintType) {
      toast.error("Please select a complaint type");
      return;
    }
    if (!formData.subject.trim()) {
      toast.error("Please enter a subject");
      return;
    }
    if (!formData.description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    const isMismatch = ["wrong_item", "missing_item"].includes(formData.complaintType);
    if (isMismatch && !formData.requestedAction) {
      toast.error("Please select refund or coupon request");
      return;
    }

    try {
      setSubmitting(true);
      // Use order._id (MongoDB ObjectId) for the complaint submission
      const orderMongoId = order?._id || orderId;
      if (!orderMongoId) {
        toast.error("Order ID not available");
        setSubmitting(false);
        return;
      }

      const orderIdString = typeof orderMongoId === 'object' && orderMongoId.toString ?
      orderMongoId.toString() :
      String(orderMongoId);


      // Upload attachments (optional)
      let attachments = [];
      if (files.length > 0) {
        try {
          setUploading(true);
          const uploaded = [];
          for (const file of files) {
            // eslint-disable-next-line no-await-in-loop
            const up = await uploadAPI.uploadMedia(file, { folder: "appzeto/complaints" });
            const url = up?.data?.data?.url;
            const publicId = up?.data?.data?.publicId;
            if (url) {
              uploaded.push({
                url,
                publicId: publicId || null,
                type: "image",
              });
            }
          }
          attachments = uploaded;
        } catch (uploadErr) {
          console.error("Upload error:", uploadErr);
          toast.error(uploadErr?.response?.data?.message || "Failed to upload images");
          setSubmitting(false);
          return;
        } finally {
          setUploading(false);
        }
      }

      const response = await orderAPI.submitComplaint({
        orderId: orderIdString,
        complaintType: formData.complaintType,
        subject: formData.subject,
        description: formData.description,
        requestedAction: isMismatch ? formData.requestedAction : null,
        attachments
      });

      if (response?.data?.success) {
        toast.success("Complaint submitted successfully");
        // Navigate to complaint details (or complaint list if id not returned).
        const complaintId = response?.data?.data?.complaint?.id;
        if (complaintId) {
          navigate(`/user/complaints/${encodeURIComponent(complaintId)}`);
        } else {
          navigate(`/user/complaints`);
        }
      } else {
        toast.error(response?.data?.message || "Failed to submit complaint");
      }
    } catch (error) {
      console.error("Error submitting complaint:", error);
      toast.error(error?.response?.data?.message || "Failed to submit complaint");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-300 text-sm">Loading...</p>
      </div>);

  }

  if (!order) {
    return null;
  }

  const orderDelivered =
    String(order.status || "").toLowerCase() === "delivered" ||
    !!order.tracking?.delivered?.status;

  const deliveredAt = order.deliveredAt || order.tracking?.delivered?.timestamp || order.updatedAt || order.createdAt || null;
  const within24h = deliveredAt ? (Date.now() - new Date(deliveredAt).getTime()) <= 24 * 60 * 60 * 1000 : false;
  const canRaiseComplaint = orderDelivered && within24h;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-[#1a1a1a] p-4 flex items-center sticky top-0 z-20 shadow-sm border-b border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
          
          <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-gray-200" />
        </button>
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 ml-3">Submit Complaint</h1>
      </div>

      {/* Order Info */}
      <div className="bg-white dark:bg-[#1a1a1a] mx-4 mt-4 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </div>
          <div>
            <p className="font-semibold text-gray-800 dark:text-gray-100">
              Order #{order.orderId || order._id}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {order.restaurantName || 'Restaurant'}
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {new Date(order.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          })}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mx-4 mt-4 space-y-4">
        {!canRaiseComplaint && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-300 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800 dark:text-red-200">
              <p className="font-semibold mb-1">Complaint not available</p>
              <p className="text-red-700 dark:text-red-300">
                Complaints can be raised only for delivered orders and within 24 hours of delivery.
              </p>
            </div>
          </div>
        )}

        {/* Complaint Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Complaint Type <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.complaintType}
            onChange={(e) => setFormData({ ...formData, complaintType: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#E23744] focus:border-transparent"
            required>
            
            <option value="">Select complaint type</option>
            {COMPLAINT_TYPES.map((type) =>
            <option key={type.value} value={type.value}>
                {type.label}
              </option>
            )}
          </select>
        </div>

        {/* Requested Action (Mismatch Only) */}
        {["wrong_item", "missing_item"].includes(formData.complaintType) && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Request <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.requestedAction}
              onChange={(e) => setFormData({ ...formData, requestedAction: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#E23744] focus:border-transparent"
              required
            >
              <option value="REFUND">Refund</option>
              <option value="COUPON">Coupon</option>
            </select>
          </div>
        )}

        {/* Subject */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Subject <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            placeholder="Brief description of your complaint"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#E23744] focus:border-transparent"
            required
            maxLength={200} />
          
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Please provide detailed information about your complaint..."
            rows={6}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#E23744] focus:border-transparent resize-none"
            required
            maxLength={1000} />
          
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formData.description.length}/1000 characters
          </p>
        </div>

        {/* Attachments */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Proof Images (optional)
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                if (hasFlutterCameraBridge()) {
                  try {
                    const file = await requestImageFileFromFlutter({ 
                      source: 'gallery', 
                      fileNamePrefix: 'complaint' 
                    });
                    if (file) {
                      setFiles(prev => [...prev, file]);
                      return;
                    }
                  } catch (err) {
                    console.warn("Flutter bridge failed for complaint image, falling back to web:", err);
                  }
                }
                document.getElementById('complaintFileInput')?.click();
              }}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Add Images
            </button>
            <input
              id="complaintFileInput"
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setFiles(prev => [...prev, ...Array.from(e.target.files || [])])}
              className="hidden"
            />
          </div>
          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Selected {files.length} file{files.length !== 1 ? "s" : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {files.map((file, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt="preview" 
                      className="w-full h-full object-cover"
                    />
                    <button 
                      type="button"
                      onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                      className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-300 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-semibold mb-1">What happens next?</p>
            <p className="text-blue-700 dark:text-blue-300">
              Your complaint will be sent to the restaurant. They will review and respond to your complaint. You can track the status in your complaints section.
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1a1a1a] border-t border-gray-200 dark:border-gray-800 p-4 z-20">
          <button
            type="submit"
            disabled={submitting || uploading || !canRaiseComplaint}
            className="w-full bg-[#E23744] text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            
            {submitting || uploading ?
            <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {uploading ? "Uploading..." : "Submitting..."}
              </> :

            "Submit Complaint"
            }
          </button>
        </div>
      </form>
    </div>);

}
