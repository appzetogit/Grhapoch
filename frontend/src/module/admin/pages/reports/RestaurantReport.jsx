import { useState, useMemo, useEffect } from "react"
import { Search, Download, ChevronDown, Filter, Briefcase, RefreshCw, Settings, ArrowUpDown, FileText, FileSpreadsheet, Code, Loader2, Check, X, Eye, EyeOff } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { exportReportsToCSV, exportReportsToExcel, exportReportsToPDF, exportReportsToJSON } from "../../components/reports/reportsExportUtils"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"

const COLUMN_CONFIG = [
  { id: "sl", label: "SL", width: "w-20" },
  { id: "restaurantName", label: "RESTAURANT NAME", width: "min-w-[200px]" },
  { id: "totalFood", label: "TOTAL FOOD", width: "w-32" },
  { id: "totalOrder", label: "TOTAL ORDER", width: "w-32" },
  { id: "totalOrderAmount", label: "TOTAL ORDER AMOUNT", width: "w-40" },
  { id: "totalDiscountGiven", label: "TOTAL DISCOUNT GIVEN", width: "w-40" },
  { id: "totalAdminCommission", label: "TOTAL ADMIN COMMISSION", width: "w-40" },
  { id: "totalVATTAX", label: "TOTAL VAT/TAX", width: "w-32" },
  { id: "averageRatings", label: "AVERAGE RATINGS", width: "w-40" },
]

export default function RestaurantReport() {
  const [searchQuery, setSearchQuery] = useState("")
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: "All",
    type: "All types",
    time: "All Time",
  })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(COLUMN_CONFIG.map(col => col.id))

  // Fetch restaurant report data
  useEffect(() => {
    const fetchRestaurantReport = async () => {
      try {
        setLoading(true)

        const params = {
          all: filters.status !== "All" ? filters.status : undefined,
          type: filters.type !== "All types" ? filters.type : undefined,
          time: filters.time !== "All Time" ? filters.time : undefined,
          search: searchQuery || undefined
        }

        const response = await adminAPI.getRestaurantReport(params)

        if (response?.data?.success && response.data.data) {
          const safeRestaurants = (response.data.data.restaurants || []).map((restaurant, index) => ({
            sl: restaurant?.sl ?? index + 1,
            id: restaurant?.id || restaurant?._id || `restaurant-${index + 1}`,
            restaurantName: restaurant?.restaurantName || restaurant?.name || "Unknown Restaurant",
            icon: restaurant?.icon || null,
            totalFood: restaurant?.totalFood ?? 0,
            totalOrder: restaurant?.totalOrder ?? 0,
            totalOrderAmount: String(restaurant?.totalOrderAmount ?? "0"),
            totalDiscountGiven: String(restaurant?.totalDiscountGiven ?? "0"),
            totalAdminCommission: String(restaurant?.totalAdminCommission ?? "0"),
            totalVATTAX: String(restaurant?.totalVATTAX ?? "0"),
            averageRatings: Number(restaurant?.averageRatings ?? 0),
            reviews: Number(restaurant?.reviews ?? 0),
          }))
          setRestaurants(safeRestaurants)
        } else {
          setRestaurants([])
        }
      } catch (error) {
        console.error("Error fetching restaurant report:", error)
        setRestaurants([])
      } finally {
        setLoading(false)
      }
    }

    const timeoutId = setTimeout(fetchRestaurantReport, 500)
    return () => clearTimeout(timeoutId)
  }, [filters, searchQuery])

  const filteredRestaurants = useMemo(() => restaurants, [restaurants])

  const handleReset = () => {
    setFilters({ status: "All", type: "All types", time: "All Time" })
    setSearchQuery("")
  }

  const toggleColumn = (id) => {
    setVisibleColumns(prev =>
      prev.includes(id)
        ? (prev.length > 1 ? prev.filter(c => c !== id) : prev)
        : [...prev, id]
    )
  }

  const handleExport = (format) => {
    if (filteredRestaurants.length === 0) {
      toast.error("No data to export")
      return
    }
    const headers = COLUMN_CONFIG
      .filter(col => visibleColumns.includes(col.id))
      .map(col => ({ key: col.id, label: col.label }))

    switch (format) {
      case "csv": exportReportsToCSV(filteredRestaurants, headers, "restaurant_report"); break
      case "excel": exportReportsToExcel(filteredRestaurants, headers, "restaurant_report"); break
      case "pdf": exportReportsToPDF(filteredRestaurants, headers, "restaurant_report", "Restaurant Report"); break
      case "json": exportReportsToJSON(filteredRestaurants, "restaurant_report"); break
    }
  }

  const activeFiltersCount = (filters.status !== "All" ? 1 : 0) + (filters.type !== "All types" ? 1 : 0) + (filters.time !== "All Time" ? 1 : 0)

  const renderStars = (rating, reviews) => {
    const safeRating = Number(rating) || 0
    const safeReviews = Number(reviews) || 0
    if (safeRating === 0) return "★0"
    const fullStars = Math.floor(safeRating)
    const hasHalfStar = safeRating % 1 !== 0
    return "★".repeat(fullStars) + (hasHalfStar ? "½" : "") + "☆".repeat(5 - Math.ceil(safeRating)) + ` (${safeReviews})`
  }

  return (
    <div className="p-4 bg-[#f8f9fa] min-h-screen">
      <div className="max-w-[1600px] mx-auto space-y-4">

        {/* Page Header - Matching 3rd Image Style */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 flex items-center gap-4">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Briefcase className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Restaurant Report</h1>
            <p className="text-sm text-slate-500">Manage and monitor restaurant performance</p>
          </div>
        </div>

        {/* Filter Section - Clean Admin Style */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-6 uppercase tracking-wider text-xs font-bold text-slate-500">
            <Filter className="w-4 h-4" />
            <span>Search Filters</span>
            {activeFiltersCount > 0 && (
              <span className="ml-auto bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] uppercase">{activeFiltersCount} Active Filter</span>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-6">
            <div className="w-[280px] space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Account Status</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-all text-slate-600">
                    <span>{filters.status}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[280px] bg-white border border-slate-100 shadow-xl rounded-lg z-[100]">
                  {["All", "Active", "Inactive"].map((opt) => (
                    <DropdownMenuItem
                      key={opt}
                      onClick={() => setFilters(prev => ({ ...prev, status: opt }))}
                      className={`cursor-pointer px-4 py-2 text-sm transition-colors ${filters.status === opt ? "bg-blue-600 text-white" : "hover:bg-slate-100"}`}
                    >
                      {opt}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="w-[280px] space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Business Model</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-all text-slate-600">
                    <span>{filters.type}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[280px] bg-white border border-slate-100 shadow-xl rounded-lg z-[100]">
                  {["All types", "Commission", "Subscription"].map((opt) => (
                    <DropdownMenuItem
                      key={opt}
                      onClick={() => setFilters(prev => ({ ...prev, type: opt }))}
                      className={`cursor-pointer px-4 py-2 text-sm transition-colors ${filters.type === opt ? "bg-blue-600 text-white" : "hover:bg-slate-100"}`}
                    >
                      {opt}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="w-[280px] space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Time Range</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-all text-slate-600">
                    <span>{filters.time}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[280px] bg-white border border-slate-100 shadow-xl rounded-lg z-[100]">
                  {["All Time", "Today", "This Week", "This Month", "This Year"].map((opt) => (
                    <DropdownMenuItem
                      key={opt}
                      onClick={() => setFilters(prev => ({ ...prev, time: opt }))}
                      className={`cursor-pointer px-4 py-2 text-sm transition-colors ${filters.time === opt ? "bg-blue-600 text-white" : "hover:bg-slate-100"}`}
                    >
                      {opt}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex-1 lg:flex-none flex items-center gap-3">
              <button
                onClick={handleReset}
                className="px-6 py-2 text-sm font-bold text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-100 transition-all flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Reset
              </button>
            </div>
          </div>
        </div>

        {/* Table Section - Matching Withdraws Template */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-slate-800">Restaurant List ({filteredRestaurants.length})</h2>

            <div className="flex items-center gap-3">
              <div className="relative group">
                <input
                  type="text"
                  placeholder="Ex: Search restaurant..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-4 pr-10 py-2 text-sm w-[280px] rounded-lg border border-slate-200 bg-[#f8f9fa] focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-all focus:outline-none">
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-white shadow-xl border border-slate-100 rounded-lg z-50">
                  <DropdownMenuItem onClick={() => handleExport("csv")} className="cursor-pointer px-4 py-2 hover:bg-slate-50 flex items-center gap-3">
                    <FileText className="w-4 h-4 text-blue-500" /> <span className="text-sm">CSV</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("excel")} className="cursor-pointer px-4 py-2 hover:bg-slate-50 flex items-center gap-3">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> <span className="text-sm">Excel</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("pdf")} className="cursor-pointer px-4 py-2 hover:bg-slate-50 flex items-center gap-3">
                    <FileText className="w-4 h-4 text-red-500" /> <span className="text-sm">PDF</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-slate-500 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 shadow-sm transition-all focus:outline-none"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading && restaurants.length === 0 ? (
              <div className="flex flex-col items-center py-24 gap-4">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">Loading Data...</p>
              </div>
            ) : (
              <table className="w-full whitespace-nowrap">
                <thead>
                  <tr className="bg-[#f8f9fa] border-y border-slate-100">
                    {COLUMN_CONFIG.filter(col => visibleColumns.includes(col.id)).map((col) => (
                      <th key={col.id} className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <div className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-all">
                          {col.label} <ArrowUpDown className="w-3 h-3 text-slate-300" />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRestaurants.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColumns.length} className="px-6 py-24 text-center">
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No Report Data Found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRestaurants.map((restaurant) => (
                      <tr key={restaurant.id} className="hover:bg-slate-50 transition-colors group">
                        {visibleColumns.includes("sl") && <td className="px-6 py-4 text-sm font-bold text-slate-400">{restaurant.sl}</td>}
                        {visibleColumns.includes("restaurantName") && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-100 bg-white flex items-center justify-center flex-shrink-0">
                                {restaurant.icon ? <img src={restaurant.icon} className="w-full h-full object-cover" /> : <span className="text-xs font-black text-blue-600">{restaurant.restaurantName?.charAt(0)}</span>}
                              </div>
                              <span className="text-sm font-bold text-slate-800">{restaurant.restaurantName}</span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.includes("totalFood") && <td className="px-6 py-4 text-sm font-medium text-slate-600">{restaurant.totalFood}</td>}
                        {visibleColumns.includes("totalOrder") && <td className="px-6 py-4 text-sm font-medium text-slate-600">{restaurant.totalOrder}</td>}
                        {visibleColumns.includes("totalOrderAmount") && <td className="px-6 py-4 text-sm font-black text-slate-900">{restaurant.totalOrderAmount}</td>}
                        {visibleColumns.includes("totalDiscountGiven") && <td className="px-6 py-4 text-sm font-semibold text-red-500">{restaurant.totalDiscountGiven}</td>}
                        {visibleColumns.includes("totalAdminCommission") && <td className="px-6 py-4 text-sm font-bold text-emerald-600">{restaurant.totalAdminCommission}</td>}
                        {visibleColumns.includes("totalVATTAX") && <td className="px-6 py-4 text-sm font-medium text-slate-600">{restaurant.totalVATTAX}</td>}
                        {visibleColumns.includes("averageRatings") && (
                          <td className="px-6 py-4">
                            <span className="bg-amber-50 text-amber-600 px-2 py-1 rounded-md text-xs font-bold ring-1 ring-amber-100">
                              {renderStars(restaurant.averageRatings, restaurant.reviews)}
                            </span>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Table Settings Popup - Matching Standard Style */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-[480px] bg-white rounded-xl p-0 border-none shadow-2xl z-[150] outline-none overflow-hidden font-sans">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-slate-800" />
              <DialogTitle className="text-lg font-bold text-slate-800 leading-none">Table Settings</DialogTitle>
            </div>
            <button onClick={() => setIsSettingsOpen(false)} className="p-1 hover:bg-slate-100 rounded-full transition-all text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-8">
            <h4 className="text-sm font-bold text-slate-800 mb-6">Toggle Columns</h4>
            <div className="grid grid-cols-2 gap-y-6 gap-x-12">
              {COLUMN_CONFIG.map((col) => (
                <div key={col.id} className="flex items-center gap-3 cursor-pointer group" onClick={() => toggleColumn(col.id)}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center transition-all border-2 ${visibleColumns.includes(col.id) ? "bg-blue-600 border-blue-600" : "border-slate-300 bg-white group-hover:border-blue-400"
                    }`}>
                    {visibleColumns.includes(col.id) && <Check className="w-3.5 h-3.5 text-white stroke-[4px]" />}
                  </div>
                  <span className={`text-[15px] font-medium transition-colors ${visibleColumns.includes(col.id) ? "text-slate-900" : "text-slate-400"}`}>
                    {col.label === "RESTAURANT NAME" ? "Restaurant" : col.label === "SL" ? "Si" : col.label.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="px-8 pb-8 flex items-center justify-end gap-3">
            <button
              onClick={() => setVisibleColumns(COLUMN_CONFIG.map(c => c.id))}
              className="px-6 py-2.5 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all font-sans"
            >
              Reset Columns
            </button>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="px-10 py-2.5 bg-[#10b981] text-white text-sm font-bold rounded-lg hover:bg-[#0da271] transition-all shadow-md shadow-[#10b981]/20 font-sans"
            >
              Apply
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
