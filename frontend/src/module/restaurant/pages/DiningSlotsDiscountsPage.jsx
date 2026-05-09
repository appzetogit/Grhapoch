import { useEffect, useState } from "react"
import { ArrowLeft, Clock, Plus, Save, Trash2, Users } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import AnimatedPage from "@/module/user/components/AnimatedPage"
import { restaurantAPI } from "@/lib/api"
import { toast } from "sonner"

export default function DiningSlotsDiscountsPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [diningSlots, setDiningSlots] = useState({ lunch: [], dinner: [] })
    const [diningGuests, setDiningGuests] = useState(6)

    useEffect(() => {
        fetchSlots()
    }, [])

    const getRestaurantAuthConfig = () => {
        const token = localStorage.getItem("restaurant_accessToken") || localStorage.getItem("accessToken")
        if (!token) return {}

        return {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    }

    const fetchSlots = async () => {
        try {
            const activationRes = await restaurantAPI.getDiningActivationStatus()
            if (!activationRes.data?.data?.diningEnabled) {
                toast.error("Complete dining activation to access this section")
                navigate("/restaurant/dining-management")
                return
            }

            const profileRes = await restaurantAPI.getProfile(getRestaurantAuthConfig())
            if (profileRes.data?.success) {
                const restaurant = profileRes.data.data.restaurant
                setDiningSlots(restaurant.diningSlots || { lunch: [], dinner: [] })
                setDiningGuests(Number(restaurant.diningGuests) > 0 ? Number(restaurant.diningGuests) : 6)
            }
        } catch (error) {
            console.error("Failed to fetch dining slots:", error)
            toast.error("Failed to load dining slots")
        } finally {
            setLoading(false)
        }
    }

    const addSlot = (type) => {
        setDiningSlots((prev) => ({
            ...prev,
            [type]: [...prev[type], { time: "12:00 PM", discount: "", isAvailable: true }]
        }))
    }

    const removeSlot = (type, index) => {
        setDiningSlots((prev) => ({
            ...prev,
            [type]: prev[type].filter((_, i) => i !== index)
        }))
    }

    const updateSlot = (type, index, field, value) => {
        setDiningSlots((prev) => ({
            ...prev,
            [type]: prev[type].map((slot, i) => (i === index ? { ...slot, [field]: value } : slot))
        }))
    }

    const updateSlotTime = (type, index, part, value) => {
        setDiningSlots((prev) => {
            const newSlots = { ...prev }
            const currentSlot = { ...newSlots[type][index] }
            
            // Default time structure if empty: "12:00 PM"
            let [timeStr, period] = (currentSlot.time || "12:00 PM").split(" ")
            let [hour, minute] = timeStr.split(":")

            if (part === "hour") hour = value
            if (part === "minute") minute = value
            if (part === "period") period = value

            currentSlot.time = `${hour}:${minute} ${period}`
            newSlots[type][index] = currentSlot
            return newSlots
        })
    }

    const getTimeParts = (time) => {
        const defaultParts = { hour: "12", minute: "00", period: "PM" }
        if (!time || typeof time !== "string" || !time.includes(" ") || !time.includes(":")) return defaultParts
        
        try {
            const [timeStr, period] = time.split(" ")
            const [hour, minute] = timeStr.split(":")
            return { hour, minute, period }
        } catch (e) {
            return defaultParts
        }
    }

    const handleSaveSlots = async () => {
        // Validation
        const validateTimeRange = (time, type) => {
            const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
            if (!match) return false;
            let hours = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            const period = match[3].toUpperCase();

            if (period === 'PM' && hours < 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;

            const totalMinutes = hours * 60 + minutes;

            if (type === 'lunch') {
                // 11:00 AM (660) to 5:00 PM (1020)
                return totalMinutes >= 660 && totalMinutes <= 1020;
            } else {
                // 6:00 PM (1080) to 11:45 PM (1425)
                return totalMinutes >= 1080 && totalMinutes <= 1425;
            }
        };

        const lunchErrors = diningSlots.lunch.filter(s => !validateTimeRange(s.time, 'lunch'));
        if (lunchErrors.length > 0) {
            toast.error("Some lunch slots are outside 11:00 AM - 5:00 PM range");
            return;
        }

        const dinnerErrors = diningSlots.dinner.filter(s => !validateTimeRange(s.time, 'dinner'));
        if (dinnerErrors.length > 0) {
            toast.error("Some dinner slots are outside 6:00 PM - 11:45 PM range");
            return;
        }

        setSaving(true)
        try {
            const safeGuests = Math.max(1, Math.min(Number(diningGuests) || 1, 20))
            const normalizeSlots = (slots = []) => {
                const uniqueTimes = new Set();
                return slots
                    .filter((slot) => {
                        if (!slot?.time || String(slot.time).trim() === "") return false;
                        if (uniqueTimes.has(slot.time)) return false;
                        uniqueTimes.add(slot.time);
                        return true;
                    })
                    .map((slot) => {
                        let discount = slot?.discount ? String(slot.discount).trim() : ""
                        if (discount && /^\d+$/.test(discount)) {
                            discount = `${discount}% OFF`
                        }
                        return {
                            time: String(slot.time).trim(),
                            discount: discount,
                            isAvailable: slot?.isAvailable !== false
                        }
                    });
            }

            const res = await restaurantAPI.updateDiningSettings({
                diningSlots: {
                    lunch: normalizeSlots(diningSlots.lunch),
                    dinner: normalizeSlots(diningSlots.dinner)
                },
                diningGuests: safeGuests
            }, getRestaurantAuthConfig())
            if (res.data?.success) {
                toast.success("Dining settings updated successfully")
                fetchSlots(); // Refresh to get normalized values
            }
        } catch (error) {
            console.error("Failed to save slots:", error)
            toast.error("Failed to update dining settings")
        } finally {
            setSaving(false)
        }
    }

    const handleBackNavigation = () => {
        if (window.history.length > 1 && location.key !== "default") {
            navigate(-1)
            return
        }

        navigate("/restaurant/dining-management", { replace: true })
    }

    if (loading) {
        return (
            <AnimatedPage className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="flex flex-col items-center">
                    <div className="h-10 w-10 border-4 border-[#ef4f5f] border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-gray-500 font-medium">Loading...</p>
                </div>
            </AnimatedPage>
        )
    }

    return (
        <AnimatedPage className="min-h-screen bg-gray-50 pb-20">
            <header className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
                <div className="max-w-6xl mx-auto w-full px-4 md:px-6 h-[72px] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleBackNavigation}
                            className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5 text-gray-700" />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900">Dining Slots & Discounts</h1>
                            <p className="text-xs font-medium text-gray-500">Set available time slots and optional discounts</p>
                        </div>
                    </div>
                    <Button
                        onClick={handleSaveSlots}
                        disabled={saving}
                        className="bg-[#ef4f5f] hover:bg-[#e03f4f] text-white font-bold h-9 rounded-xl text-xs flex items-center gap-1.5 px-3"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? "Saving..." : "Save All"}
                    </Button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto w-full p-4 md:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm lg:col-span-2">
                        <div className="flex items-center gap-2 mb-5 pb-5 border-b border-gray-100">
                            <Users className="w-4 h-4 text-[#ef4f5f]" />
                            <h3 className="text-sm font-bold text-gray-700">Booking Guest Limit</h3>
                        </div>

                        <div className="rounded-xl border border-gray-200 px-3 flex items-center gap-3 max-w-sm">
                            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Max Guests</span>
                            <Input
                                type="number"
                                min="1"
                                max="20"
                                value={diningGuests}
                                onChange={(e) => setDiningGuests(e.target.value)}
                                className="h-10 border-0 shadow-none focus-visible:ring-0 px-0"
                            />
                        </div>
                    </div>

                    {/* Lunch Slots */}
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-5 pb-5 border-b border-gray-100">
                            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-orange-500" />
                                Lunch Slots
                            </h3>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addSlot("lunch")}
                                className="h-8 border-gray-200 text-xs font-bold rounded-lg px-2"
                            >
                                <Plus className="w-3.5 h-3.5 mr-1" /> Add
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {diningSlots.lunch.length === 0 ? (
                                <p className="text-center py-6 text-xs text-gray-400 font-medium bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                    No lunch slots added.
                                </p>
                            ) : (
                                diningSlots.lunch.map((slot, index) => {
                                    const { hour, minute, period } = getTimeParts(slot.time)
                                    return (
                                        <div key={index} className="flex flex-col gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-100 relative group transition-all hover:border-orange-200">
                                            <div className="flex-1">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 block mb-1">Slot Time</label>
                                                <div className="flex items-center gap-1.5">
                                                    <select
                                                        value={hour}
                                                        onChange={(e) => updateSlotTime("lunch", index, "hour", e.target.value)}
                                                        className="h-9 w-full rounded-lg text-sm border-gray-200 bg-white focus:ring-1 focus:ring-orange-500 outline-none px-2"
                                                    >
                                                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map(h => (
                                                            <option key={h} value={h}>{h}</option>
                                                        ))}
                                                    </select>
                                                    <span className="font-bold text-gray-400">:</span>
                                                    <select
                                                        value={minute}
                                                        onChange={(e) => updateSlotTime("lunch", index, "minute", e.target.value)}
                                                        className="h-9 w-full rounded-lg text-sm border-gray-200 bg-white focus:ring-1 focus:ring-orange-500 outline-none px-2"
                                                    >
                                                        {["00", "15", "30", "45"].map(m => (
                                                            <option key={m} value={m}>{m}</option>
                                                        ))}
                                                    </select>
                                                    <select
                                                        value={period}
                                                        onChange={(e) => updateSlotTime("lunch", index, "period", e.target.value)}
                                                        className="h-9 w-full rounded-lg text-sm border-gray-200 bg-white font-bold text-orange-600 focus:ring-1 focus:ring-orange-500 outline-none px-1"
                                                    >
                                                        <option value="AM">AM</option>
                                                        <option value="PM">PM</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 block mb-1">Disc (%)</label>
                                                    <Input
                                                        placeholder="e.g. 10"
                                                        value={slot.discount}
                                                        onChange={(e) => updateSlot("lunch", index, "discount", e.target.value)}
                                                        className="h-9 rounded-lg text-sm border-gray-200 bg-white"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => removeSlot("lunch", index)}
                                                    className="mt-5 h-9 w-9 flex-shrink-0 flex items-center justify-center text-red-500 hover:bg-red-100 rounded-lg transition-colors bg-white border border-gray-200 shadow-sm"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Dinner Slots */}
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-5 pb-5 border-b border-gray-100">
                            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-blue-500" />
                                Dinner Slots
                            </h3>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addSlot("dinner")}
                                className="h-8 border-gray-200 text-xs font-bold rounded-lg px-2"
                            >
                                <Plus className="w-3.5 h-3.5 mr-1" /> Add
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {diningSlots.dinner.length === 0 ? (
                                <p className="text-center py-6 text-xs text-gray-400 font-medium bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                    No dinner slots added.
                                </p>
                            ) : (
                                diningSlots.dinner.map((slot, index) => {
                                    const { hour, minute, period } = getTimeParts(slot.time)
                                    return (
                                        <div key={index} className="flex flex-col gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-100 relative group transition-all hover:border-blue-200">
                                            <div className="flex-1">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 block mb-1">Slot Time</label>
                                                <div className="flex items-center gap-1.5">
                                                    <select
                                                        value={hour}
                                                        onChange={(e) => updateSlotTime("dinner", index, "hour", e.target.value)}
                                                        className="h-9 w-full rounded-lg text-sm border-gray-200 bg-white focus:ring-1 focus:ring-blue-500 outline-none px-2"
                                                    >
                                                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map(h => (
                                                            <option key={h} value={h}>{h}</option>
                                                        ))}
                                                    </select>
                                                    <span className="font-bold text-gray-400">:</span>
                                                    <select
                                                        value={minute}
                                                        onChange={(e) => updateSlotTime("dinner", index, "minute", e.target.value)}
                                                        className="h-9 w-full rounded-lg text-sm border-gray-200 bg-white focus:ring-1 focus:ring-blue-500 outline-none px-2"
                                                    >
                                                        {["00", "15", "30", "45"].map(m => (
                                                            <option key={m} value={m}>{m}</option>
                                                        ))}
                                                    </select>
                                                    <select
                                                        value={period}
                                                        onChange={(e) => updateSlotTime("dinner", index, "period", e.target.value)}
                                                        className="h-9 w-full rounded-lg text-sm border-gray-200 bg-white font-bold text-blue-600 focus:ring-1 focus:ring-blue-500 outline-none px-1"
                                                    >
                                                        <option value="AM">AM</option>
                                                        <option value="PM">PM</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 block mb-1">Disc (%)</label>
                                                    <Input
                                                        placeholder="e.g. 20"
                                                        value={slot.discount}
                                                        onChange={(e) => updateSlot("dinner", index, "discount", e.target.value)}
                                                        className="h-9 rounded-lg text-sm border-gray-200 bg-white"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => removeSlot("dinner", index)}
                                                    className="mt-5 h-9 w-9 flex-shrink-0 flex items-center justify-center text-red-500 hover:bg-red-100 rounded-lg transition-colors bg-white border border-gray-200 shadow-sm"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </AnimatedPage>
    )
}
