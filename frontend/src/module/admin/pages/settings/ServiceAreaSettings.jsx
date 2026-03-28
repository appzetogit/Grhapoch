import { useEffect, useState } from "react";
import { Loader2, MapPin, Save } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@/lib/api";

export default function ServiceAreaSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serviceRadiusKm, setServiceRadiusKm] = useState("");
  const [baseDistance, setBaseDistance] = useState("");
  const [baseFee, setBaseFee] = useState("");
  const [perKmCharge, setPerKmCharge] = useState("");
  const [maxServiceDistance, setMaxServiceDistance] = useState("");
  const radiusExampleText = serviceRadiusKm === ""
    ? "Example will update based on the value you set above."
    : `Example: ${serviceRadiusKm} means users will only see restaurants within ${serviceRadiusKm} km.`;

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getServiceSettings();
      const settings = response?.data?.data || response?.data || {};
      const radiusValue = settings?.serviceRadiusKm ?? 10;
      const baseDistanceValue = settings?.baseDistance ?? 2;
      const baseFeeValue = settings?.baseFee ?? 30;
      const perKmChargeValue = settings?.perKmCharge ?? 5;
      const maxDistanceValue = settings?.maxServiceDistance ?? "";
      setServiceRadiusKm(String(radiusValue));
      setBaseDistance(String(baseDistanceValue));
      setBaseFee(String(baseFeeValue));
      setPerKmCharge(String(perKmChargeValue));
      setMaxServiceDistance(maxDistanceValue === null ? "" : String(maxDistanceValue));
    } catch (error) {
      console.error("Error fetching service settings:", error);
      toast.error(error?.response?.data?.message || "Failed to load service area settings");
      setServiceRadiusKm("10");
      setBaseDistance("2");
      setBaseFee("30");
      setPerKmCharge("5");
      setMaxServiceDistance("");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const radiusValue = Number(serviceRadiusKm);
    const baseDistanceValue = Number(baseDistance);
    const baseFeeValue = Number(baseFee);
    const perKmChargeValue = Number(perKmCharge);
    const maxDistanceValue = maxServiceDistance === "" ? null : Number(maxServiceDistance);

    if (!Number.isFinite(radiusValue) || radiusValue < 0) {
      toast.error("Service radius must be a non-negative number");
      return;
    }
    if (!Number.isFinite(baseDistanceValue) || baseDistanceValue < 0) {
      toast.error("Base distance must be a non-negative number");
      return;
    }
    if (!Number.isFinite(baseFeeValue) || baseFeeValue < 0) {
      toast.error("Base fee must be a non-negative number");
      return;
    }
    if (!Number.isFinite(perKmChargeValue) || perKmChargeValue < 0) {
      toast.error("Per-km charge must be a non-negative number");
      return;
    }
    if (maxDistanceValue !== null && (!Number.isFinite(maxDistanceValue) || maxDistanceValue < 0)) {
      toast.error("Max service distance must be a non-negative number");
      return;
    }
    if (maxDistanceValue !== null && maxDistanceValue < baseDistanceValue) {
      toast.error("Max service distance must be >= base distance");
      return;
    }

    try {
      setSaving(true);
      const response = await adminAPI.updateServiceSettings({
        serviceRadiusKm: radiusValue,
        baseDistance: baseDistanceValue,
        baseFee: baseFeeValue,
        perKmCharge: perKmChargeValue,
        maxServiceDistance: maxDistanceValue
      });
      const saved = response?.data?.data || response?.data || {};
      setServiceRadiusKm(String(saved?.serviceRadiusKm ?? radiusValue));
      setBaseDistance(String(saved?.baseDistance ?? baseDistanceValue));
      setBaseFee(String(saved?.baseFee ?? baseFeeValue));
      setPerKmCharge(String(saved?.perKmCharge ?? perKmChargeValue));
      setMaxServiceDistance(saved?.maxServiceDistance === null || saved?.maxServiceDistance === undefined ? "" : String(saved?.maxServiceDistance));
      toast.success("Service area radius updated successfully");
    } catch (error) {
      console.error("Error saving service settings:", error);
      toast.error(error?.response?.data?.message || "Failed to update service area radius");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="w-5 h-5 text-slate-700" />
            <h1 className="text-2xl font-bold text-slate-900">Service Area Settings</h1>
          </div>

          <p className="text-sm text-slate-600 mb-6">
            Set a global service radius in kilometers. This radius is used to filter nearby restaurants and
            validate orders against the user&apos;s delivery location.
          </p>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg mb-6">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-emerald-700 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-emerald-900 mb-1">
                  Service Radius (km)
                </div>
                <div className="text-sm text-emerald-800/80 mb-3">
                  {radiusExampleText}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={serviceRadiusKm}
                      onChange={(e) => setServiceRadiusKm(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm border-emerald-200"
                      placeholder="e.g., 10"
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-lg mb-6">
            <div className="font-semibold text-slate-900 mb-3">Delivery Fee Rules</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Base Distance (km)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={baseDistance}
                  onChange={(e) => setBaseDistance(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g., 2"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Base Fee (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={baseFee}
                  onChange={(e) => setBaseFee(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g., 30"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Per Km Charge (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={perKmCharge}
                  onChange={(e) => setPerKmCharge(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g., 5"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Max Service Distance (km)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={maxServiceDistance}
                  onChange={(e) => setMaxServiceDistance(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Optional"
                  disabled={saving}
                />
                <p className="text-[11px] text-slate-500 mt-1">Leave empty to allow up to service radius.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Settings
            </button>
          </div>

          <div className="text-xs text-slate-500">
            Note: This setting affects restaurant listing, under-250 listing, and order creation validation.
          </div>
        </div>
      </div>
    </div>
  );
}
