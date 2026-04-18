import { useState, useMemo, useEffect, useRef } from "react";
import { Search, Download, ChevronDown, Bell, Edit, Trash2, Upload, Settings, Image as ImageIcon, Loader2, X } from "lucide-react";
import { adminAPI } from "@/lib/api";
import { toast } from "sonner";

export default function PushNotification() {
  const [formData, setFormData] = useState({
    title: "",
    zoneId: "All",
    sendTo: "Customer",
    description: "",
    image: null
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [zones, setZones] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      const [zonesRes, notificationsRes] = await Promise.all([
        adminAPI.getZones(),
        adminAPI.getPushNotifications()
      ]);
      
      if (zonesRes.data.success) {
        setZones(zonesRes.data.data.zones || []);
      }
      
      if (notificationsRes.data.success) {
        setNotifications(notificationsRes.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to load initial data");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredNotifications = useMemo(() => {
    if (!searchQuery.trim()) {
      return notifications;
    }

    const query = searchQuery.toLowerCase().trim();
    return notifications.filter((notification) =>
      notification.title.toLowerCase().includes(query) ||
      notification.description.toLowerCase().includes(query)
    );
  }, [notifications, searchQuery]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Image size must be less than 2MB");
        return;
      }
      setFormData(prev => ({ ...prev, image: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.description) {
      toast.error("Title and Description are required");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await adminAPI.sendPushNotification(formData);
      if (response.data.success) {
        toast.success("Notification sent successfully!");
        handleReset();
        fetchInitialData(); // Refresh list
      }
    } catch (error) {
      console.error("Failed to send notification:", error);
      toast.error(error.response?.data?.message || "Failed to send notification");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      title: "",
      zoneId: "All",
      sendTo: "Customer",
      description: "",
      image: null
    });
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleToggleStatus = async (id) => {
    try {
      const response = await adminAPI.togglePushNotificationStatus(id);
      if (response.data.success) {
        setNotifications(notifications.map((n) =>
          n._id === id ? { ...n, status: !n.status } : n
        ));
        toast.success(response.data.message);
      }
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this notification?")) {
      try {
        const response = await adminAPI.deletePushNotification(id);
        if (response.data.success) {
          setNotifications(notifications.filter((n) => n._id !== id));
          toast.success("Notification deleted");
        }
      } catch (error) {
        toast.error("Failed to delete notification");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Create New Notification Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-5 h-5 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Notification</h1>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="Ex: Notification Title"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Send To
                </label>
                <select
                  value={formData.sendTo}
                  onChange={(e) => handleInputChange("sendTo", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm">
                  <option value="Customer">Customer</option>
                  <option value="Delivery Man">Delivery Man</option>
                  <option value="Restaurant">Restaurant</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Select Zone
                </label>
                <select
                  value={formData.zoneId}
                  onChange={(e) => handleInputChange("zoneId", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm">
                  <option value="All">All Zones</option>
                  {zones.map((zone) => (
                    <option key={zone._id} value={zone._id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notification Banner Upload */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Notification banner
              </label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer min-h-[150px] flex flex-col items-center justify-center bg-slate-50"
              >
                {imagePreview ? (
                  <div className="relative w-full max-w-md h-32">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImagePreview(null);
                        setFormData(prev => ({ ...prev, image: null }));
                      }}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-md"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-slate-400 mb-2" />
                    <p className="text-sm font-medium text-blue-600 mb-1">Upload Image</p>
                    <p className="text-xs text-slate-500">Image format - jpg png jpeg gif webp (Max 2MB)</p>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/*"
                  className="hidden" 
                />
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Description
              </label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Ex: Notification Descriptions"
                rows={4}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none" />
            </div>

            <div className="flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={handleReset}
                disabled={isSubmitting}
                className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50">
                Reset
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md flex items-center gap-2 disabled:bg-blue-400">
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? "Sending..." : "Send Notification"}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Notification List Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Notification List</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredNotifications.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search by title"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400" />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>

              <button className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all">
                <Download className="w-4 h-4" />
                <span>Export</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">SI</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Image</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Zone</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Target</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredNotifications.map((notification, index) =>
                <tr
                  key={notification._id}
                  className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-700">{index + 1}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-900">{notification.title}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-700 max-w-xs truncate block">{notification.description}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {notification.banner ?
                        <div className="w-12 h-8 rounded overflow-hidden bg-slate-100">
                          <img
                            src={notification.banner}
                            alt={notification.title}
                            className="w-full h-full object-cover"
                          />
                        </div> :
                        <div className="w-12 h-8 rounded bg-slate-100 flex items-center justify-center">
                          <ImageIcon className="w-4 h-4 text-slate-400" />
                        </div>
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-700">{notification.zoneName}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700">
                        {notification.sendTo}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(notification._id)}
                        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
                        notification.status ? "bg-blue-600" : "bg-slate-300"}`
                        }>
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          notification.status ? "translate-x-6" : "translate-x-1"}`
                          } />
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(notification._id)}
                          className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {filteredNotifications.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-slate-500 italic">
                      No notifications found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}