import { useEffect, useState } from "react";
import { Cloud, Settings, Info } from "lucide-react";
import { adminAPI } from "@/lib/api";

const languageTabs = [
{ key: "default", label: "Default" },
{ key: "en", label: "English(EN)" },
{ key: "bn", label: "Bengali - বাংলা(BN)" },
{ key: "ar", label: "Arabic - العربية (AR)" },
{ key: "es", label: "Spanish - español(ES)" }];


const defaultTemplates = [
  {
    key: "user.order_confirmed",
    audience: "user",
    channel: "push",
    label: "User: Order Confirmed",
    title: "✅ Order Confirmed",
    body: "Your order #{orderId} has been confirmed and is being sent to the kitchen.",
    enabled: true
  },
  {
    key: "user.order_preparing",
    audience: "user",
    channel: "push",
    label: "User: Order Preparing",
    title: "👨‍🍳 Preparing your food",
    body: "The restaurant has started preparing your delicious meal for order #{orderId}.",
    enabled: true
  },
  {
    key: "user.order_ready",
    audience: "user",
    channel: "push",
    label: "User: Order Ready",
    title: "📦 Order Ready",
    body: "Your order #{orderId} is ready and waiting for a delivery partner.",
    enabled: true
  },
  {
    key: "user.order_picked_up",
    audience: "user",
    channel: "push",
    label: "User: Order Picked Up",
    title: "🛵 Food is on the way!",
    body: "Your order #{orderId} has been picked up and is heading your way.",
    enabled: true
  },
  {
    key: "user.order_at_delivery",
    audience: "user",
    channel: "push",
    label: "User: Order Arrived",
    title: "📍 Arrived!",
    body: "The delivery partner has reached your location with order #{orderId}.",
    enabled: true
  },
  {
    key: "user.order_delivered",
    audience: "user",
    channel: "push",
    label: "User: Order Delivered",
    title: "🎉 Enjoy your meal!",
    body: "Your order #{orderId} has been delivered. Don't forget to rate your experience!",
    enabled: true
  },
  {
    key: "user.order_cancelled",
    audience: "user",
    channel: "push",
    label: "User: Order Cancelled",
    title: "❌ Order Cancelled",
    body: "Your order #{orderId} has been cancelled.",
    enabled: true
  },
  {
    key: "restaurant.order_new",
    audience: "restaurant",
    channel: "push",
    label: "Restaurant: New Order",
    title: "🛍️ New Order Received!",
    body: "You have a new order #{orderId}. Open the app to accept it.",
    enabled: true
  },
  {
    key: "restaurant.order_delivered",
    audience: "restaurant",
    channel: "push",
    label: "Restaurant: Order Delivered",
    title: "🎉 Order Delivered",
    body: "Order #{orderId} has been successfully delivered to the customer.",
    enabled: true
  },
  {
    key: "restaurant.order_cancelled",
    audience: "restaurant",
    channel: "push",
    label: "Restaurant: Order Cancelled",
    title: "❌ Order Cancelled",
    body: "Order #{orderId} has been cancelled by the customer. Reason: {reason}",
    enabled: true
  },
  {
    key: "delivery.order_assigned",
    audience: "delivery",
    channel: "push",
    label: "Delivery: Order Assigned",
    title: "🛍️ New Order Assigned!",
    body: "Order #{orderId} is assigned to you. Head to {restaurantName} for pickup.",
    enabled: true
  },
  {
    key: "delivery.order_available",
    audience: "delivery",
    channel: "push",
    label: "Delivery: Order Available",
    title: "🔔 New Delivery Opportunity",
    body: "Order #{orderId} is available for pickup at {restaurantName}. First come first serve!",
    enabled: true
  },
  {
    key: "delivery.order_ready",
    audience: "delivery",
    channel: "push",
    label: "Delivery: Order Ready",
    title: "📦 Order Ready for Pickup",
    body: "Order #{orderId} is ready at {restaurantName}. Please head there for pickup.",
    enabled: true
  }
];


function ToggleSwitch({ enabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center w-11 h-6 rounded-full border transition-all ${
      enabled ?
      "bg-blue-600 border-blue-600 justify-end" :
      "bg-slate-200 border-slate-300 justify-start"}`
      }>
      
      <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
    </button>);

}

export default function FirebaseNotification() {
  const [activeTab, setActiveTab] = useState("push-notification");
  const [activeLanguage, setActiveLanguage] = useState("bn");
  const [messages, setMessages] = useState(() => defaultTemplates);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [firebaseConfig, setFirebaseConfig] = useState({
    serviceFileContent: "",
    apiKey: "AIzaSyC_TqpDR7LNHxFEPd8cGjl_ka_Rj0ebECA",
    fcmProjectId: "zomato-607fa",
    messagingSenderId: "1065631021082",
    authDomain: "zomato-607fa.firebaseapp.com",
    appId: "1:1065631021082:web:7424afd0ad2054ed6879a3",
    storageBucket: "zomato-607fa.firebasestorage.app",
    measurementId: "G-7JJV7JYVRX"
  });

  const defaultTemplateMap = new Map(defaultTemplates.map((template) => [template.key, template]));
  const templateOrder = new Map(defaultTemplates.map((template, index) => [template.key, index]));
  const formatLabel = (key = "") =>
    key.replace(/\./g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

  const buildFallbackTemplates = () =>
    defaultTemplates.map((template) => ({
      ...template,
      language: activeLanguage,
      channel: "push"
    }));

  const normalizeTemplates = (templates = []) => {
    if (!Array.isArray(templates) || templates.length === 0) {
      return buildFallbackTemplates();
    }

    const normalized = templates.map((template) => {
      const fallback = defaultTemplateMap.get(template.key);
      return {
        ...fallback,
        ...template,
        label: template.label || fallback?.label || formatLabel(template.key),
        title: template.title ?? fallback?.title ?? "",
        body: template.body ?? fallback?.body ?? "",
        enabled: template.enabled !== false,
        language: template.language || activeLanguage,
        channel: template.channel || "push"
      };
    });

    normalized.sort((a, b) => (templateOrder.get(a.key) ?? 9999) - (templateOrder.get(b.key) ?? 9999));
    return normalized;
  };

  useEffect(() => {
    let mounted = true;

    const loadTemplates = async () => {
      setIsLoading(true);
      try {
        const response = await adminAPI.getNotificationTemplates({
          channel: "push",
          language: activeLanguage
        });
        const templates = response?.data?.data?.templates || response?.data?.templates || [];
        if (mounted) {
          setMessages(normalizeTemplates(templates));
        }
      } catch (error) {
        console.error("Failed to load notification templates:", error);
        if (mounted) {
          setMessages(buildFallbackTemplates());
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadTemplates();

    return () => {
      mounted = false;
    };
  }, [activeLanguage]);

  const handleMessageToggle = (key) => {
    setMessages((prev) => prev.map((msg) =>
      msg.key === key ? { ...msg, enabled: !msg.enabled } : msg
    ));
  };

  const handleMessageChange = (key, value) => {
    setMessages((prev) => prev.map((msg) =>
      msg.key === key ? { ...msg, body: value } : msg
    ));
  };

  const handleTitleChange = (key, value) => {
    setMessages((prev) => prev.map((msg) =>
      msg.key === key ? { ...msg, title: value } : msg
    ));
  };

  const handleFirebaseConfigChange = (key, value) => {
    setFirebaseConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (activeTab === "firebase-configuration") {
      alert("Firebase configuration UI is not wired to backend yet.");
      return;
    }

    if (isSaving) return;
    setIsSaving(true);

    try {
      const payload = messages.map((msg) => ({
        key: msg.key,
        audience: msg.audience,
        channel: msg.channel || "push",
        language: activeLanguage,
        title: msg.title,
        body: msg.body,
        enabled: msg.enabled !== false
      }));

      await adminAPI.saveNotificationTemplates(payload);
      alert("Notification templates saved successfully!");
    } catch (error) {
      console.error("Failed to save notification templates:", error);
      alert("Failed to save notification templates.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setMessages(buildFallbackTemplates());
    setFirebaseConfig({
      serviceFileContent: "",
      apiKey: "AIzaSyC_TqpDR7LNHxFEPd8cGjl_ka_Rj0ebECA",
      fcmProjectId: "zomato-607fa",
      messagingSenderId: "1065631021082",
      authDomain: "zomato-607fa.firebaseapp.com",
      appId: "1:1065631021082:web:7424afd0ad2054ed6879a3",
      storageBucket: "zomato-607fa.firebasestorage.app",
      measurementId: "G-7JJV7JYVRX"
    });
  };

  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
      <div className="w-full mx-auto max-w-6xl">
        {/* Page Title */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
                <Cloud className="w-3.5 h-3.5 text-white" />
              </div>
              <h1 className="text-lg font-bold text-slate-900">Firebase Push Notification Setup</h1>
            </div>
            {activeTab === "push-notification" &&
            <a
              href="#"
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              
                Read Documentation
                <Info className="w-3 h-3" />
              </a>
            }
            {activeTab === "firebase-configuration" &&
            <a
              href="#"
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              
                Where to get this information
                <Info className="w-3 h-3" />
              </a>
            }
          </div>
        </div>

        {/* Primary Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("push-notification")}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
              activeTab === "push-notification" ?
              "bg-blue-600 text-white" :
              "text-slate-600 hover:bg-slate-100"}`
              }>
              
              <Settings className="w-3.5 h-3.5" />
              <span>Push Notification</span>
            </button>
            <button
              onClick={() => setActiveTab("firebase-configuration")}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
              activeTab === "firebase-configuration" ?
              "bg-blue-600 text-white" :
              "text-slate-600 hover:bg-slate-100"}`
              }>
              
              <Cloud className="w-3.5 h-3.5" />
              <Settings className="w-3.5 h-3.5" />
              <span>Firebase Configuration</span>
            </button>
          </div>
        </div>

        {/* Push Notification Tab Content */}
        {activeTab === "push-notification" &&
        <div className="space-y-3">
            {/* Language Tabs */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-3">
              <div className="flex items-center gap-2 overflow-x-auto">
                {languageTabs.map((tab) =>
              <button
                key={tab.key}
                onClick={() => setActiveLanguage(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeLanguage === tab.key ?
                "border-blue-600 text-blue-600" :
                "border-transparent text-slate-600 hover:text-slate-900"}`
                }>
                
                    {tab.label}
                  </button>
              )}
              </div>
            </div>

            {/* Notification Messages */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="space-y-4">
                {isLoading && (
                  <p className="text-xs text-slate-500">Loading templates...</p>
                )}
                {!isLoading && messages.length === 0 && (
                  <p className="text-xs text-slate-500">No templates found.</p>
                )}
                {!isLoading && messages.map((message) =>
              <div key={message.key} className="border-b border-slate-200 pb-4 last:border-b-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-slate-700">{message.label || message.key}</p>
                        <p className="text-[10px] text-slate-500">{message.key} - {message.audience}</p>
                      </div>
                      <ToggleSwitch
                    enabled={message.enabled}
                    onToggle={() => handleMessageToggle(message.key)} />
                  
                    </div>
                    <input
                  value={message.title || ""}
                  onChange={(e) => handleTitleChange(message.key, e.target.value)}
                  className="w-full mb-2 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Notification title" />
                    <textarea
                  value={message.body || ""}
                  onChange={(e) => handleMessageChange(message.key, e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Notification message" />
                
                  </div>
              )}
              </div>
            </div>
          </div>
        }

        {/* Firebase Configuration Tab Content */}
        {activeTab === "firebase-configuration" &&
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <form onSubmit={handleSubmit}>
              {/* Service File Content */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  Service File Content
                  <Info className="w-3 h-3 text-slate-400" />
                </label>
                <textarea
                value={firebaseConfig.serviceFileContent}
                onChange={(e) => handleFirebaseConfigChange("serviceFileContent", e.target.value)}
                rows={6}
                placeholder="Paste your Firebase service file content here"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono" />
              
              </div>

              {/* API Key */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Api Key
                </label>
                <input
                type="text"
                value={firebaseConfig.apiKey}
                onChange={(e) => handleFirebaseConfigChange("apiKey", e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              
              </div>

              {/* Firebase Configuration Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    FCM Project ID
                  </label>
                  <input
                  type="text"
                  value={firebaseConfig.fcmProjectId}
                  onChange={(e) => handleFirebaseConfigChange("fcmProjectId", e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Auth Domain
                  </label>
                  <input
                  type="text"
                  value={firebaseConfig.authDomain}
                  onChange={(e) => handleFirebaseConfigChange("authDomain", e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Messaging Sender Id
                  </label>
                  <input
                  type="text"
                  value={firebaseConfig.messagingSenderId}
                  onChange={(e) => handleFirebaseConfigChange("messagingSenderId", e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    App Id
                  </label>
                  <input
                  type="text"
                  value={firebaseConfig.appId}
                  onChange={(e) => handleFirebaseConfigChange("appId", e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Storage Bucket
                  </label>
                  <input
                  type="text"
                  value={firebaseConfig.storageBucket}
                  onChange={(e) => handleFirebaseConfigChange("storageBucket", e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Measurement Id
                  </label>
                  <input
                  type="text"
                  value={firebaseConfig.measurementId}
                  onChange={(e) => handleFirebaseConfigChange("measurementId", e.target.value)}
                  placeholder="Ex: F-12345678"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                type="submit"
                className="px-6 py-2.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                
                  Submit
                </button>
              </div>
            </form>
          </div>
        }

        {/* Action Buttons (for Push Notification tab) */}
        {activeTab === "push-notification" &&
        <div className="flex justify-end gap-2 mt-3">
            <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
            
              Reset
            </button>
            <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
              isSaving ? "bg-blue-300 text-white cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"
            }`}>
            
              {isSaving ? "Saving..." : "Submit"}
            </button>
          </div>
        }
      </div>
    </div>);

}





