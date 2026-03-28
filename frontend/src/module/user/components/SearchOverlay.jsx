import { useState, useEffect, useRef } from "react"
import { useLocation as useRouterLocation, useNavigate } from "react-router-dom"
import { X, Search, MapPin, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { restaurantAPI } from "@/lib/api"
import { useLocation } from "../hooks/useLocation"

const API_CATEGORY_IMAGE_FALLBACK = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop";

export default function SearchOverlay({ isOpen, onClose, searchValue, onSearchChange }) {
  const navigate = useNavigate()
  const routerLocation = useRouterLocation()
  const inputRef = useRef(null)
  const { location } = useLocation()
  
  const isDiningMode = routerLocation.pathname.includes('/dining')
  
  const [debouncedSearchValue, setDebouncedSearchValue] = useState(searchValue)
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [allData, setAllData] = useState([])
  const [isDataLoaded, setIsDataLoaded] = useState(false)

  // Auto-focus input
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose])

  // Fetch initial data (restaurants and their menus) once when overlay opens
  useEffect(() => {
    if (isOpen && !isDataLoaded) {
      const loadInitialData = async () => {
        setLoading(true)
        try {
          const params = {}
          if (location?.latitude && location?.longitude) {
            params.lat = location.latitude
            params.lng = location.longitude
          }

          const response = await restaurantAPI.getRestaurants(params)
          
          if (response.data && response.data.success && response.data.data && response.data.data.restaurants) {
            const activeRests = response.data.data.restaurants.filter(r => r.isActive !== false && r.isActive !== undefined)
            // Limit to top restaurants to prevent massive concurrent menu requests
            const topRests = activeRests.slice(0, 30);
            
            const menuPromises = topRests.map(async (r) => {
              try {
                const restId = r.restaurantId || r._id;
                const menuRes = await restaurantAPI.getMenuByRestaurantId(restId);
                const menuData = menuRes.data?.data?.menu || null;
                return { ...r, menuData };
              } catch (e) {
                return { ...r, menuData: null };
              }
            });

            const loadedRests = await Promise.all(menuPromises);
            setAllData(loadedRests);
            setIsDataLoaded(true);
          }
        } catch (error) {
          console.error("Error fetching search data:", error)
        } finally {
          setLoading(false)
        }
      }
      loadInitialData()
    }
  }, [isOpen, isDataLoaded, location])

  // Debouncing logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchValue(searchValue)
    }, 400)

    return () => {
      clearTimeout(handler)
    }
  }, [searchValue])

  // Filter local data immediately when debounced value changes
  useEffect(() => {
    if (!isOpen) return;

    if (!debouncedSearchValue || debouncedSearchValue.trim() === "") {
      setSearchResults([])
      // Do not unset loading here if initial data is still loading
      return
    }

    if (!isDataLoaded && !loading) return; // Wait for initial grab to finish

    const query = debouncedSearchValue.toLowerCase().trim()
    const results = [];
    const addedDishNames = new Set()
    
    allData.forEach(r => {
      const rName = (r.name || "").toLowerCase()
      const rCuisine = r.cuisines ? r.cuisines.join(" ").toLowerCase() : ""
      const fDish = (r.featuredDish || "").toLowerCase()

      const coverImages = r.coverImages && r.coverImages.length > 0 ? r.coverImages.map(img => img.url || img) : []
      const menuImages = r.menuImages && r.menuImages.length > 0 ? r.menuImages.map(img => img.url || img) : []
      const allImages = coverImages.length > 0 ? coverImages : menuImages.length > 0 ? menuImages : r.profileImage?.url ? [r.profileImage.url] : []
      
      const image = allImages[0] || API_CATEGORY_IMAGE_FALLBACK

      // Determine the destination URL for restaurants
      const restId = r.slug || r.restaurantId || r._id;
      const restUrl = isDiningMode ? `/user/dining/restaurants/${restId}` : `/user/restaurants/${restId}`;

      // 1. Check if restaurant name or cuisine matches
      if (rName.includes(query) || rCuisine.includes(query)) {
        results.push({
          id: `res-${restId}`,
          type: 'restaurant',
          title: r.name,
          subtitle: 'Restaurant',
          image: image,
          queryTarget: r.name,
          url: restUrl
        })
      }

      // 2. Check featured dish
      if (fDish.includes(query) && fDish !== "" && !addedDishNames.has(fDish)) {
        results.push({
          id: `dish-${restId}-${fDish}`,
          type: 'dish',
          title: r.featuredDish,
          subtitle: r.name,
          image: image,
          queryTarget: r.featuredDish,
          url: isDiningMode ? `/user/dining/restaurants/${restId}?dish=${encodeURIComponent(r.featuredDish)}` : `/user/restaurants/${restId}?search=${encodeURIComponent(r.featuredDish)}`
        })
        addedDishNames.add(fDish)
      }

      // 3. Search through the actual full menu structure
      if (r.menuData && r.menuData.sections) {
        r.menuData.sections.forEach(section => {
          const checkItems = (items) => {
            if (!items) return;
            items.forEach(item => {
              const itemName = (item.name || "").toLowerCase();
              if (itemName.includes(query) && !addedDishNames.has(itemName)) {
                results.push({
                  id: `dish-${restId}-${item._id || item.id}`,
                  type: 'dish',
                  title: item.name,
                  subtitle: r.name,
                  image: item.image?.url || item.image || image,
                  queryTarget: item.name,
                  url: isDiningMode ? `/user/dining/restaurants/${restId}?dish=${encodeURIComponent(item.name)}` : `/user/restaurants/${restId}?search=${encodeURIComponent(item.name)}`
                });
                addedDishNames.add(itemName);
              }
            });
          };

          checkItems(section.items);
          if (section.subsections) {
            section.subsections.forEach(sub => checkItems(sub.items));
          }
        });
      }
    });

    // Set max 15 results for performance and clean UI
    setSearchResults(results.slice(0, 15))
  }, [debouncedSearchValue, isOpen, allData, isDataLoaded, loading, isDiningMode])

  const handleResultClick = (item) => {
    onSearchChange(item.queryTarget)
    navigate(item.url)
    onClose()
    onSearchChange("")
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (searchValue.trim()) {
      const targetPath = isDiningMode ? '/user/dining/restaurants' : '/user/search'
      navigate(`${targetPath}?q=${encodeURIComponent(searchValue.trim())}`)
      onClose()
      onSearchChange("")
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-[#0a0a0a]"
      style={{
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      {/* Header with Search Bar */}
      <div className="flex-shrink-0 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onClose}
              className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 bg-gray-100 dark:bg-[#1a1a1a] border-transparent shadow-sm hidden sm:flex h-12 w-12 flex-shrink-0 transition-colors"
            >
              <X className="h-6 w-6 text-gray-700 dark:text-gray-300" strokeWidth={2.5} />
            </Button>
            <div className="flex-1 relative flex items-center">
              <Search className="absolute left-4 h-5 w-5 text-muted-foreground dark:text-gray-400 z-10" />
              <Input
                ref={inputRef}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search for food, restaurants..."
                className="pl-12 h-12 w-full bg-gray-100 dark:bg-[#1a1a1a] border-transparent focus:border-gray-300 dark:focus:border-gray-700 focus:bg-white dark:focus:bg-black rounded-xl lg:rounded-2xl text-base dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-400 transition-all duration-300 shadow-sm"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onClose}
              className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 bg-gray-100 dark:bg-[#1a1a1a] border-transparent shadow-sm sm:hidden h-12 w-12 flex-shrink-0 transition-colors"
            >
              <X className="h-6 w-6 text-gray-700 dark:text-gray-300" strokeWidth={2.5} />
            </Button>
          </form>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 scrollbar-hide bg-white dark:bg-[#0a0a0a] min-h-0">
        
        {searchValue.trim() !== "" && (
          <div style={{ animation: 'slideDown 0.3s ease-out' }}>
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                Matching dishes & restaurants
              </span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Loader2 className="h-8 w-8 text-orange-500 animate-spin mb-4" />
                <p className="text-gray-500 dark:text-gray-400 font-medium">Searching...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="flex flex-col gap-2">
                {searchResults.map((item, index) => (
                  <div
                    key={item.id}
                    onClick={() => handleResultClick(item)}
                    className="flex items-center gap-4 p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                    style={{
                      animation: `fadeIn 0.3s ease-out ${index * 0.05}s both`
                    }}
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm flex-shrink-0 bg-white">
                      <img 
                        src={item.image} 
                        alt={item.title} 
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.src = API_CATEGORY_IMAGE_FALLBACK }}
                      />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{item.title}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.subtitle}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 sm:py-16">
                <Search className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 text-base sm:text-lg font-semibold">
                  No results found for "{debouncedSearchValue}"
                </p>
                <p className="text-sm sm:text-base text-gray-500 dark:text-gray-500 mt-2">
                  Try a different search term
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
