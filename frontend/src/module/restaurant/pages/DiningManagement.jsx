import { useEffect, useState } from "react"
import { ArrowLeft, CalendarCheck2, CheckCircle2, ChevronRight, Clock, IndianRupee, Loader2, UtensilsCrossed, XCircle } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import AnimatedPage from "@/module/user/components/AnimatedPage"
import { diningAPI, restaurantAPI } from "@/lib/api"
import { loadRazorpayScript } from "@/lib/utils/razorpay"
import { toast } from "sonner"

const DINING_STATUSES = {
    REQUESTED: "Requested",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    PAYMENT_PENDING: "Payment Pending",
    PAYMENT_SUCCESSFUL: "Payment Successful"
}

export default function DiningManagement() {
    const navigate = useNavigate()
    const location = useLocation()
    const [diningStatus, setDiningStatus] = useState(null)
    const [statusLoading, setStatusLoading] = useState(true)
    const [requesting, setRequesting] = useState(false)
    const [enablingFree, setEnablingFree] = useState(false)
    const [paying, setPaying] = useState(false)
    const [availableCategories, setAvailableCategories] = useState([])
    const [loadingCategories, setLoadingCategories] = useState(true)
    const [selectedDiningCategories, setSelectedDiningCategories] = useState([])
    const [savingDiningCategory, setSavingDiningCategory] = useState(false)

    const sections = [
        {
            id: "slots",
            title: "Dining Slots & Discounts",
            description: "Set available lunch and dinner slots with optional discounts.",
            icon: Clock,
            route: "/restaurant/dining-management/slots-discounts"
        },
        {
            id: "tables",
            title: "Manage Tables",
            description: "Add or remove tables and configure seating capacity.",
            icon: UtensilsCrossed,
            route: "/restaurant/dining-management/manage-tables"
        },
        {
            id: "bookings",
            title: "Table Bookings",
            description: "Review booking requests and confirm or reject them.",
            icon: CalendarCheck2,
            route: "/restaurant/dining-management/table-bookings"
        }
    ]

    const fetchDiningActivationStatus = async () => {
        try {
            setStatusLoading(true)
            const res = await restaurantAPI.getDiningActivationStatus()
            if (res.data?.success) {
                setDiningStatus(res.data.data)
                const responseCategories = Array.isArray(res.data.data?.diningCategories)
                    ? res.data.data.diningCategories
                    : (String(res.data.data?.diningCategory || "").trim() ? [String(res.data.data.diningCategory).trim()] : [])
                setSelectedDiningCategories(responseCategories.map((category) => String(category || "").trim()).filter(Boolean))
            }
        } catch (error) {
            console.error("Failed to fetch dining activation status:", error)
            toast.error("Failed to load dining activation status")
        } finally {
            setStatusLoading(false)
        }
    }

    useEffect(() => {
        fetchDiningActivationStatus()
    }, [])

    useEffect(() => {
        const fetchDiningCategories = async () => {
            try {
                setLoadingCategories(true)
                const res = await diningAPI.getCategories()
                const categories = Array.isArray(res.data?.data) ? res.data.data : []
                setAvailableCategories(categories)
            } catch (error) {
                console.error("Failed to fetch dining categories:", error)
                toast.error("Failed to load dining categories")
                setAvailableCategories([])
            } finally {
                setLoadingCategories(false)
            }
        }

        fetchDiningCategories()
    }, [])

    const handleSaveDiningCategory = async () => {
        const normalizedCategories = Array.from(
            new Set(
                selectedDiningCategories
                    .map((category) => String(category || "").trim())
                    .filter(Boolean)
            )
        )

        if (normalizedCategories.length === 0) {
            toast.error("Please select at least one dining category")
            return
        }

        try {
            setSavingDiningCategory(true)
            const res = await restaurantAPI.updateDiningSettings({ diningCategories: normalizedCategories })
            const responseCategories = Array.isArray(res.data?.data?.diningCategories)
                ? res.data.data.diningCategories
                : (String(res.data?.data?.diningCategory || "").trim() ? [String(res.data.data.diningCategory).trim()] : normalizedCategories)
            const savedCategories = responseCategories
                .map((category) => String(category || "").trim())
                .filter(Boolean)
            setSelectedDiningCategories(savedCategories)
            setDiningStatus((prev) => ({
                ...(prev || {}),
                diningCategory: savedCategories[0] || "",
                diningCategories: savedCategories
            }))
            toast.success("Dining categories updated successfully")
        } catch (error) {
            console.error("Failed to update dining categories:", error)
            toast.error(error?.response?.data?.message || "Failed to update dining categories")
        } finally {
            setSavingDiningCategory(false)
        }
    }

    const handleToggleDiningCategory = (categoryName) => {
        const normalizedCategory = String(categoryName || "").trim()
        if (!normalizedCategory) return

        setSelectedDiningCategories((prev) => {
            const exists = prev.some((category) => category.toLowerCase() === normalizedCategory.toLowerCase())
            if (exists) {
                return prev.filter((category) => category.toLowerCase() !== normalizedCategory.toLowerCase())
            }
            return [...prev, normalizedCategory]
        })
    }

    const handleRequestDiningEnable = async () => {
        try {
            setRequesting(true)
            const res = await restaurantAPI.requestDiningEnable()
            if (res.data?.success && res.data?.data) {
                setDiningStatus(res.data.data)
                toast.success("Dining enable request sent to admin")
            }
        } catch (error) {
            console.error("Failed to request dining enable:", error)
            toast.error(error.response?.data?.message || "Failed to request dining enable")
        } finally {
            setRequesting(false)
        }
    }

    const handleEnableWithoutPayment = async () => {
        try {
            setEnablingFree(true)
            const res = await restaurantAPI.enableDiningWithoutPayment()
            if (res.data?.success && res.data?.data) {
                setDiningStatus(res.data.data)
            }
            toast.success("Dining enabled successfully")
        } catch (error) {
            console.error("Failed to enable dining for free:", error)
            toast.error(error.response?.data?.message || "Failed to enable dining")
        } finally {
            setEnablingFree(false)
        }
    }

    const handlePayAndEnableDining = async () => {
        try {
            setPaying(true)
            await loadRazorpayScript()
            if (!window.Razorpay) {
                toast.error("Razorpay SDK not loaded. Please refresh and try again.")
                setPaying(false)
                return
            }
            const orderRes = await restaurantAPI.createDiningActivationOrder()
            const orderData = orderRes.data?.data || {}

            const options = {
                key: orderData.keyId,
                amount: orderData.amount,
                currency: orderData.currency || "INR",
                name: "GrhaPoch Partner",
                description: "Dining Activation Fee",
                order_id: orderData.orderId,
                prefill: {
                    name: diningStatus?.restaurant?.name || "",
                    email: diningStatus?.restaurant?.email || "",
                    contact: diningStatus?.restaurant?.phone || ""
                },
                theme: {
                    color: "#ef4f5f"
                },
                handler: async function (response) {
                    try {
                        const verifyRes = await restaurantAPI.verifyDiningActivationPayment({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        })

                        if (verifyRes.data?.success && verifyRes.data?.data) {
                            setDiningStatus(verifyRes.data.data)
                        }

                        toast.success("Dining activated successfully")
                    } catch (verifyError) {
                        console.error("Dining activation payment verification failed:", verifyError)
                        toast.error(verifyError.response?.data?.message || "Payment verification failed")
                    } finally {
                        setPaying(false)
                    }
                },
                modal: {
                    ondismiss: function () {
                        setPaying(false)
                    }
                }
            }

            const razorpay = new window.Razorpay(options)
            razorpay.open()
        } catch (error) {
            console.error("Failed to start dining activation payment:", error)
            toast.error(error.response?.data?.message || "Failed to start payment")
            setPaying(false)
        }
    }

    const currentStatus = diningStatus?.diningStatus || null
    const isDiningEnabled = Boolean(diningStatus?.diningEnabled)
    const canEnableWithoutPayment = Boolean(diningStatus?.canEnableWithoutPayment)
    const requiresPayment = Boolean(diningStatus?.requiresPayment)
    const isSubscriptionBased = diningStatus?.businessModel === "Subscription Base"
    const canRequest =
        !isDiningEnabled &&
        (!currentStatus || currentStatus === DINING_STATUSES.REJECTED)
    const isPendingApproval = currentStatus === DINING_STATUSES.REQUESTED
    const isApproved = currentStatus === DINING_STATUSES.APPROVED
    const isPaymentPending = currentStatus === DINING_STATUSES.PAYMENT_PENDING
    const isRejected = currentStatus === DINING_STATUSES.REJECTED

    const handleBackNavigation = () => {
        if (window.history.length > 1 && location.key !== "default") {
            navigate(-1)
            return
        }

        navigate("/restaurant/explore", { replace: true })
    }

    const renderActivationContent = () => {
        if (canRequest) {
            return (
                <div className="mt-4">
                    <p className="text-sm text-gray-600">
                        {isSubscriptionBased
                            ? "Since your subscription plan is active, dining will be enabled instantly."
                            : "Send a request to admin first. After approval, you can complete activation."}
                    </p>
                    <Button
                        onClick={handleRequestDiningEnable}
                        disabled={requesting}
                        className="mt-4 bg-[#ef4f5f] hover:bg-[#e03f4f] text-white text-sm font-bold h-10 rounded-xl"
                    >
                        {requesting ? (
                            <span className="inline-flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Requesting...
                            </span>
                        ) : (isRejected ? "Request Again" : isSubscriptionBased ? "Enable Dining" : "Request Dining Enable")}
                    </Button>
                </div>
            )
        }

        if (isPendingApproval) {
            return (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700 text-sm font-medium">
                    Dining Status: Pending Approval
                </div>
            )
        }

        if (isRejected) {
            return (
                <div className="mt-4">
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm font-medium inline-flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Dining request was rejected by admin.
                    </div>
                    <div>
                        <Button
                            onClick={handleRequestDiningEnable}
                            disabled={requesting}
                            className="mt-4 bg-[#ef4f5f] hover:bg-[#e03f4f] text-white text-sm font-bold h-10 rounded-xl"
                        >
                            {requesting ? (
                                <span className="inline-flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Requesting...
                                </span>
                            ) : (
                                "Request Again"
                            )}
                        </Button>
                    </div>
                </div>
            )
        }

        if (isApproved || isPaymentPending) {
            if (canEnableWithoutPayment) {
                return (
                    <div className="mt-4 rounded-xl border border-gray-200 p-4 bg-gray-50">
                        <p className="text-sm font-medium text-gray-700">Dining Approved. Enable without any charges.</p>
                        <Button
                            onClick={handleEnableWithoutPayment}
                            disabled={enablingFree}
                            className="mt-3 bg-[#ef4f5f] hover:bg-[#e03f4f] text-white text-sm font-bold h-10 rounded-xl"
                        >
                            {enablingFree ? (
                                <span className="inline-flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Enabling...
                                </span>
                            ) : (
                                "Enable Dining"
                            )}
                        </Button>
                    </div>
                )
            }

            if (requiresPayment) {
                return (
                    <div className="mt-4 rounded-xl border border-gray-200 p-4 bg-gray-50">
                        <p className="text-sm font-medium text-gray-700 inline-flex items-center gap-1">
                            Dining Activation Fee
                            <span className="inline-flex items-center font-bold text-gray-900">
                                <IndianRupee className="h-3.5 w-3.5" />
                                {Number(diningStatus?.activationFeeAmount || 0)}
                            </span>
                        </p>
                        <Button
                            onClick={handlePayAndEnableDining}
                            disabled={paying}
                            className="mt-3 bg-[#ef4f5f] hover:bg-[#e03f4f] text-white text-sm font-bold h-10 rounded-xl"
                        >
                            {paying ? (
                                <span className="inline-flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Processing...
                                </span>
                            ) : (
                                "Pay & Enable Dining"
                            )}
                        </Button>
                    </div>
                )
            }
        }

        return (
            <p className="mt-4 text-sm text-red-600 font-medium">
                Unable to determine dining activation flow for this restaurant.
            </p>
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
                            <h1 className="text-lg font-bold text-gray-900">Dining Management</h1>
                            <p className="text-xs font-medium text-gray-500">Manage Tables & Bookings</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto w-full p-4 md:p-6">
                {statusLoading ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 flex items-center gap-2 text-sm text-gray-600">
                        <Loader2 className="h-4 w-4 animate-spin text-[#ef4f5f]" />
                        Checking dining activation status...
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
                        {!isDiningEnabled ? (
                            <>
                                <h2 className="text-base font-bold text-gray-900">Dining Is Disabled</h2>
                                <p className="text-sm text-gray-600 mt-1">
                                    {diningStatus?.businessModel === "Subscription Base"
                                        ? "Business Model: Subscription Based"
                                        : "Business Model: Commission Base"}
                                </p>
                                {renderActivationContent()}
                            </>
                        ) : (
                            <div className="bg-green-50 rounded-2xl border border-green-100 p-4 text-sm text-green-700 font-medium inline-flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" />
                                Dining is enabled for this restaurant
                            </div>
                        )}
                    </div>
                )}

                {!statusLoading && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
                        <h2 className="text-base font-bold text-gray-900">Dining Category</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Select one or more categories from admin dining categories.
                        </p>

                        <div className="mt-4 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {availableCategories.map((category) => {
                                    const categoryName = String(category?.name || "").trim()
                                    const isSelected = selectedDiningCategories.some(
                                        (selectedCategory) => selectedCategory.toLowerCase() === categoryName.toLowerCase()
                                    )

                                    return (
                                        <label
                                            key={category._id}
                                            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer transition-colors ${
                                                isSelected
                                                    ? "border-[#ef4f5f] bg-rose-50 text-[#ef4f5f]"
                                                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleToggleDiningCategory(categoryName)}
                                                disabled={loadingCategories || savingDiningCategory}
                                                className="h-4 w-4 accent-[#ef4f5f]"
                                            />
                                            <span className="font-medium">{categoryName}</span>
                                        </label>
                                    )
                                })}
                            </div>

                            <Button
                                onClick={handleSaveDiningCategory}
                                disabled={loadingCategories || savingDiningCategory || selectedDiningCategories.length === 0}
                                className="h-10 rounded-xl px-4 bg-[#ef4f5f] hover:bg-[#e03f4f] text-white text-sm font-bold"
                            >
                                {savingDiningCategory ? (
                                    <span className="inline-flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Saving...
                                    </span>
                                ) : (
                                    "Save Categories"
                                )}
                            </Button>
                        </div>
                        {!loadingCategories && availableCategories.length === 0 && (
                            <p className="mt-2 text-xs text-amber-700">
                                No active dining categories available right now. Please ask admin to add categories.
                            </p>
                        )}
                    </div>
                )}

                {isDiningEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
                        {sections.map((section) => {
                            const Icon = section.icon
                            return (
                                <div
                                    key={section.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => navigate(section.route)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault()
                                            navigate(section.route)
                                        }
                                    }}
                                    className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-left transition-all hover:shadow-md hover:-translate-y-0.5"
                                >
                                    <div className="h-10 w-10 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center mb-4">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-base font-bold text-gray-900">{section.title}</h2>
                                    <p className="text-sm text-gray-500 mt-2 min-h-[40px]">{section.description}</p>
                                    <div className="mt-4">
                                        <Button className="h-9 rounded-lg px-3 bg-[#ef4f5f] hover:bg-[#e03f4f] text-white text-xs font-bold">
                                            Open <ChevronRight className="h-4 w-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>
        </AnimatedPage>
    )
}
