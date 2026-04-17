import { useState, useEffect } from "react";
import { Search, Plus, Trash2, Edit2, Calendar, Percent, Store, Users, Eye, CheckCircle, XCircle } from "lucide-react";
import { adminAPI } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const initialFormState = {
    couponCode: "",
    discountPercentage: "",
    minOrderValue: "",
    maxDiscountLimit: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: "",
    restaurantScope: "all",
    restaurantIds: [],
    userScope: "all",
    visibility: {
      showOnCheckout: true
    }
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [couponsRes, restaurantsRes] = await Promise.all([
        adminAPI.getAllGlobalCoupons(),
        adminAPI.getRestaurants({ limit: 1000 })
      ]);
      
      if (couponsRes?.data?.success) {
        setCoupons(couponsRes.data.data);
      }
      if (restaurantsRes?.data?.success) {
        setRestaurants(restaurantsRes.data.data.restaurants || []);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        const res = await adminAPI.updateGlobalCoupon(editingId, formData);
        if (res.data.success) {
          toast.success("Coupon updated successfully");
          fetchData();
          resetForm();
        }
      } else {
        const res = await adminAPI.createGlobalCoupon(formData);
        if (res.data.success) {
          toast.success("Coupon created successfully");
          fetchData();
          resetForm();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save coupon");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this coupon?")) return;
    try {
      const res = await adminAPI.deleteGlobalCoupon(id);
      if (res.data.success) {
        toast.success("Coupon deleted successfully");
        fetchData();
      }
    } catch (err) {
      toast.error("Failed to delete coupon");
    }
  };

  const handleEdit = (coupon) => {
    setEditingId(coupon._id);
    setFormData({
      ...coupon,
      startDate: format(new Date(coupon.startDate), "yyyy-MM-dd"),
      endDate: format(new Date(coupon.endDate), "yyyy-MM-dd"),
      restaurantIds: coupon.restaurantIds?.map(r => r._id || r) || []
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setEditingId(null);
    setShowForm(false);
  };

  const filteredCoupons = coupons.filter(c => 
    c.couponCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Coupon Management</h1>
            <p className="text-slate-500 text-sm">Create and manage global or restaurant-specific coupons</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
              showForm ? 'bg-slate-200 text-slate-700' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {showForm ? <XCircle size={20} /> : <Plus size={20} />}
            {showForm ? "Cancel" : "Create New Coupon"}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8 animate-in slide-in-from-top duration-300">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Percent className="text-blue-600" size={20} />
              {editingId ? "Edit Coupon" : "Create New Coupon"}
            </h2>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Coupon Code</label>
                <input
                  type="text"
                  required
                  value={formData.couponCode}
                  onChange={(e) => setFormData({...formData, couponCode: e.target.value.toUpperCase()})}
                  placeholder="e.g. SAVE50"
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Discount Percentage (%)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="100"
                  value={formData.discountPercentage}
                  onChange={(e) => setFormData({...formData, discountPercentage: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Min Order Value (₹)</label>
                <input
                  type="number"
                  required
                  value={formData.minOrderValue}
                  onChange={(e) => setFormData({...formData, minOrderValue: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Max Discount Limit (₹)</label>
                <input
                  type="number"
                  required
                  value={formData.maxDiscountLimit}
                  onChange={(e) => setFormData({...formData, maxDiscountLimit: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Start Date</label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">End Date</label>
                <input
                  type="date"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Store size={16} /> Restaurant Scope
                </label>
                <select
                  value={formData.restaurantScope}
                  onChange={(e) => setFormData({...formData, restaurantScope: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Restaurants</option>
                  <option value="specific">Specific Restaurants</option>
                </select>
              </div>

              {formData.restaurantScope === 'specific' && (
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Select Restaurants</label>
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                    {restaurants.map(res => (
                      <label key={res._id} className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full text-xs cursor-pointer hover:bg-blue-50">
                        <input
                          type="checkbox"
                          checked={formData.restaurantIds.includes(res._id)}
                          onChange={(e) => {
                            const newIds = e.target.checked 
                              ? [...formData.restaurantIds, res._id]
                              : formData.restaurantIds.filter(id => id !== res._id);
                            setFormData({...formData, restaurantIds: newIds});
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        {res.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Users size={16} /> User Scope
                </label>
                <select
                  value={formData.userScope}
                  onChange={(e) => setFormData({...formData, userScope: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Users</option>
                  <option value="first-time">First Time Users</option>
                  <option value="shared">Shared App Users</option>
                </select>
              </div>

              <div className="space-y-4 pt-8">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={formData.visibility.showOnCheckout}
                      onChange={(e) => setFormData({
                        ...formData, 
                        visibility: { ...formData.visibility, showOnCheckout: e.target.checked }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Show on Checkout Page</span>
                </label>
              </div>

              <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="px-8 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md shadow-blue-200"
                >
                  {editingId ? "Update Coupon" : "Create Coupon"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-900">Coupons List</h2>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search coupons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-700 uppercase tracking-wider">Restaurant</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-700 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-700 uppercase tracking-wider">Discount</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-700 uppercase tracking-wider">Order Rules</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-700 uppercase tracking-wider">Validity</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-700 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                      <div className="flex justify-center mb-4">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                      Loading coupons...
                    </td>
                  </tr>
                ) : filteredCoupons.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                      No coupons found
                    </td>
                  </tr>
                ) : (
                  filteredCoupons.map((coupon) => (
                    <tr key={coupon._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        {coupon.restaurantScope === 'all' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Global (All)
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-semibold text-slate-900">{coupon.restaurantIds?.length || 0} Restaurants</span>
                            <span className="text-xs text-slate-500 truncate max-w-[150px]">
                              {coupon.restaurantIds?.map(r => r.name).join(", ")}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                          {coupon.couponCode}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">{coupon.discountPercentage}% OFF</span>
                          <span className="text-xs text-slate-500">Max: ₹{coupon.maxDiscountLimit}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        Min Order: ₹{coupon.minOrderValue}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-xs text-slate-600">
                          <span>Start: {format(new Date(coupon.startDate), "dd MMM yyyy")}</span>
                          <span>End: {format(new Date(coupon.endDate), "dd MMM yyyy")}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          coupon.status === 'active' ? 'bg-green-100 text-green-800' : 
                          coupon.status === 'expired' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {coupon.status.charAt(0)?.toUpperCase() + coupon.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button 
                          onClick={() => handleEdit(coupon)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(coupon._id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
