import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Star, Clock, Search, SlidersHorizontal, ChevronDown, Bookmark, BadgePercent, MapPin, ArrowDownUp, Timer, IndianRupee, UtensilsCrossed, ShieldCheck, X, Loader2, Heart, Percent } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FoodTypeIcon from "../components/FoodTypeIcon";
import api from "@/lib/api";
import { restaurantAPI, adminAPI } from "@/lib/api";
import { useProfile } from "../context/ProfileContext";
import { useLocation } from "../hooks/useLocation";

export default function CategoryPage() {
  const { category } = useParams();
  const navigate = useNavigate();
  const { vegMode } = useProfile();
  const { location } = useLocation();
  const isOutOfService = false;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(category?.toLowerCase() || 'all');
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [favorites, setFavorites] = useState(new Set());
  const [sortBy, setSortBy] = useState(null);
  const [selectedCuisine, setSelectedCuisine] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState('sort');
  const [activeScrollSection, setActiveScrollSection] = useState('sort');
  const [isLoadingFilterResults, setIsLoadingFilterResults] = useState(false);
  const filterSectionRefs = useRef({});
  const rightContentRef = useRef(null);
  const categoryScrollRef = useRef(null);

  // State for categories from admin
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // State for restaurants from backend
  const [restaurantsData, setRestaurantsData] = useState([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [categoryKeywords, setCategoryKeywords] = useState({});
  const [availableCuisines, setAvailableCuisines] = useState([]);

  // Fetch categories from admin API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true);
        const response = await adminAPI.getPublicCategories({ categoryFor: "food" });

        if (response.data && response.data.success && response.data.data && response.data.data.categories) {
          const categoriesArray = response.data.data.categories;

          // Transform API categories to match expected format
          const transformedCategories = [
            { id: 'all', name: "All", image: null, slug: 'all' },
            ...categoriesArray.map((cat) => ({
              id: cat.slug || cat.id,
              name: cat.name,
              image: cat.image || null,
              slug: cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-'),
              type: cat.type
            }))];


          setCategories(transformedCategories);

          // Generate category keywords dynamically from category names
          const keywordsMap = {};
          const genericKeywords = new Set([
            "food",
            "foods",
            "dish",
            "dishes",
            "item",
            "items",
            "menu",
            "category",
            "categories",
            "cuisine",
            "cuisines",
            "all"
          ]);
          const normalizeKeyword = (value) => String(value || "").toLowerCase().trim();
          const slugify = (value) => normalizeKeyword(value).replace(/\s+/g, "-");

          categoriesArray.forEach((cat) => {
            const categoryId = cat.slug || cat.id;
            const categoryName = cat.name.toLowerCase();

            // Generate keywords from category name
            // DO NOT split into individual words to enforce exact phrase matching
            const baseKeywords = [categoryName, slugify(categoryName)];

            const cleanedKeywords = Array.from(new Set(
              baseKeywords
                .map(normalizeKeyword)
                .filter((keyword) => keyword && keyword.length >= 3 && !genericKeywords.has(keyword))
            ));

            // ADD MANUAL OVERRIDES: Fix common spelling variations or important sub-items
            if (categoryId === 'daal-bati' || categoryName.includes('daal bati')) {
              cleanedKeywords.push('dal bati', 'dal-bati');
            } else if (categoryId === 'pestry-cake' || categoryName.includes('cake') || categoryName.includes('pestry') || categoryId === 'cake') {
              cleanedKeywords.push('pastry', 'cake', 'pestry', 'pastery', 'pastries', 'pestries', 'cupcake', 'muffin', 'cakes');
            } else if (categoryId === 'ice-cream') {
              cleanedKeywords.push('dessert', 'cold', 'gelato', 'kulfi');
            } else if (categoryId === 'south-indian') {
              cleanedKeywords.push('dosa', 'idli', 'vada', 'uttapam', 'sambhar', 'chutney');
            } else if (categoryId === 'main-course') {
              cleanedKeywords.push('thali', 'platter', 'gravy', 'sabzi', 'meal', 'lunch', 'dinner', 'roti', 'naan', 'bread', 'paratha', 'pulav');
            }

            // Store full name separately for strict section-name matching
            keywordsMap[categoryId] = {
              fullName: normalizeKeyword(categoryName),
              fullSlug: slugify(categoryName),
              keywords: cleanedKeywords
            };
          });

          setCategoryKeywords(keywordsMap);
        } else {
          // Keep default "All" category on error
          setCategories([{ id: 'all', name: "All", image: null, slug: 'all' }]);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
        // Keep default "All" category on error
        setCategories([{ id: 'all', name: "All", image: null, slug: 'all' }]);
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);
  // Checks if a dish matches category.
  // categoryData = { fullName, fullSlug, keywords } from categoryKeywords map.
  // sectionName is optional - used for strict full-name matching against section titles.
  const matchesCategoryKeywords = (item, categoryData, sectionName = null) => {
    if (!categoryData) return false;
    // Support both old format (array) and new format (object)
    const isNewFormat = categoryData && typeof categoryData === 'object' && !Array.isArray(categoryData);
    const normalizeKeyword = (value) => String(value || "").toLowerCase().trim();
    const slugify = (value) => normalizeKeyword(value).replace(/\s+/g, "-");

    const fullName = isNewFormat ? categoryData.fullName : null;
    const fullSlug = isNewFormat ? categoryData.fullSlug : null;
    const keywordsList = isNewFormat ? categoryData.keywords : (Array.isArray(categoryData) ? categoryData : []);

    const keywordSet = new Set(
      keywordsList
        .map(normalizeKeyword)
        .filter(Boolean)
        .flatMap((keyword) => [keyword, slugify(keyword)])
    );

    const actualFullName = fullName || String(categoryData.fullName || categoryData.name || "").toLowerCase();
    const actualFullSlug = fullSlug || slugify(actualFullName);

    // Helper: check if a text value contains any keyword
    const textContainsKeyword = (text) => {
      const normalized = normalizeKeyword(text);
      if (!normalized) return false;
      const slug = slugify(normalized);
      if (keywordSet.has(normalized) || keywordSet.has(slug)) return true;

      return Array.from(keywordSet).some((kw) => {
        try {
          const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, 'i');
          return regex.test(normalized);
        } catch (e) {
          return normalized.includes(kw);
        }
      });
    };

    // EXCLUSION LOGIC: Prevent Burger/Rice from being in "Main Course"
    const getExclusions = (catId) => {
      const ex = {
        'main-course': ['burger', 'pizza', 'sandwich', 'beverage', 'drink', 'shake', 'ice cream', 'icecream', 'dessert', 'sweet', 'chips', 'rice', 'biryani'],
        'ice-cream': ['rice', 'biryani', 'burger', 'pizza', 'main course'],
        'rice': ['ice cream', 'burger', 'pizza', 'sandwich']
      };
      return ex[catId] || [];
    };

    const catId = categoryData.slug || categoryData.id || actualFullSlug;
    const exclusions = getExclusions(catId);
    const dishNameNorm = normalizeKeyword(item.name);

    // If the dish is an exclusion (like Burger vs Main Course), ignore section name
    const matchesExclusion = exclusions.some(ex => {
      const exEscaped = ex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const exRegex = new RegExp(`(^|[^a-zA-Z0-9])${exEscaped}([^a-zA-Z0-9]|$)`, 'i');
      return exRegex.test(dishNameNorm);
    });

    // 1. Excluded items (like Burger in Main Course) should ONLY match if the word 'Main Course' is in their NAME.
    // We ignore Section, Tags, etc. for these to prevent over-matching.
    if (matchesExclusion) {
      return textContainsKeyword(item.name);
    }

    // 2. Section Match (Only for non-excluded items)
    if (sectionName && actualFullName) {
      const sectionNorm = normalizeKeyword(sectionName);
      const sectionSlug = slugify(sectionName);
      const escapedFull = actualFullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const sectionRegex = new RegExp(`(^|[^a-zA-Z0-9])${escapedFull}([^a-zA-Z0-9]|$)`, 'i');

      if (sectionNorm === actualFullName || sectionSlug === actualFullSlug || sectionRegex.test(sectionNorm)) {
        return true;
      }
    }

    // 3. Structured dish fields: category, subCategory, tags
    const candidates = [];
    if (item.category) candidates.push(item.category);
    if (item.subCategory) candidates.push(item.subCategory);
    if (Array.isArray(item.tags)) {
      item.tags.forEach((tag) => candidates.push(tag));
    }
    if (candidates.some((c) => textContainsKeyword(c))) return true;

    // 4. Last fallback: Check dish name itself
    return textContainsKeyword(item.name);
  };

  // Helper function to check if menu has dishes matching category keywords
  const checkCategoryInMenu = (menu, categoryId) => {
    if (!menu || !menu.sections || !Array.isArray(menu.sections)) {
      return false;
    }

    const categoryData = categoryKeywords[categoryId];
    if (!categoryData) return false;
    const hasKeywords = Array.isArray(categoryData) ? categoryData.length > 0 : (categoryData.keywords && categoryData.keywords.length > 0);
    if (!hasKeywords) return false;

    for (const section of menu.sections) {
      const sectionName = section.name || section.title || null;
      if (section.items && Array.isArray(section.items)) {
        for (const item of section.items) {
          if (matchesCategoryKeywords(item, categoryData, sectionName)) {
            return true;
          }
        }
      }
      // Check subsections too
      if (section.subsections && Array.isArray(section.subsections)) {
        for (const sub of section.subsections) {
          const subName = sub.name || sub.title || sectionName;
          if (sub.items && Array.isArray(sub.items)) {
            for (const item of sub.items) {
              if (matchesCategoryKeywords(item, categoryData, subName)) {
                return true;
              }
            }
          }
        }
      }
    }

    return false;
  };

  // Helper function to get ALL dishes matching a category from menu (returns array of dish info)
  const getAllCategoryDishesFromMenu = (menu, categoryId) => {
    if (!menu || !menu.sections || !Array.isArray(menu.sections)) {
      return [];
    }

    const isAll = categoryId === 'all';
    const categoryData = categoryKeywords[categoryId];

    // If we're on a specific category but keywords aren't loaded yet, return empty
    // This prevents the "show everything" bug while waiting for keywords
    if (!isAll && (!categoryData || (Array.isArray(categoryData) ? categoryData.length === 0 : !categoryData.fullName && !categoryData.keywords?.length))) {
      return [];
    }

    if (!isAll && !categoryData) return [];

    const matchingDishes = [];
    const seenIds = new Set();
    const extractItemImageUrls = (item, section) => {
      const urls = [];

      if (Array.isArray(item?.images)) {
        item.images.forEach((img) => {
          if (typeof img === "string") {
            urls.push(img);
          } else if (img && typeof img === "object" && typeof img.url === "string") {
            urls.push(img.url);
          }
        });
      }

      if (typeof item?.image === "string") {
        urls.push(item.image);
      } else if (item?.image && typeof item.image === "object" && typeof item.image.url === "string") {
        urls.push(item.image.url);
      }

      if (typeof section?.image === "string") {
        urls.push(section.image);
      } else if (section?.image && typeof section.image === "object" && typeof section.image.url === "string") {
        urls.push(section.image.url);
      }

      return [...new Set(urls.map((url) => String(url).trim()).filter(Boolean))];
    };

    const addItem = (item, section, sectionName) => {
      // If NOT 'all', skip items that don't match the category. 
      // If 'all', we take everything.
      if (!isAll && !matchesCategoryKeywords(item, categoryData, sectionName)) return;

      const itemId = item._id || item.id || `${item.name}-${item.price}`;
      if (seenIds.has(itemId)) return;
      seenIds.add(itemId);

      const originalPrice = item.originalPrice || item.price || 0;
      const discountPercent = item.discountPercent || 0;
      const finalPrice = discountPercent > 0
        ? Math.round(originalPrice * (1 - discountPercent / 100))
        : originalPrice;

      const dishImages = extractItemImageUrls(item, section);
      const dishImage = dishImages[0] || null;

      matchingDishes.push({
        name: item.name,
        price: finalPrice,
        image: dishImage,
        images: dishImages,
        originalPrice: originalPrice,
        itemId: itemId,
        foodType: item.foodType
      });
    };

    for (const section of menu.sections) {
      const sectionName = section.name || section.title || null;

      if (section.items && Array.isArray(section.items)) {
        for (const item of section.items) {
          addItem(item, section, sectionName);
        }
      }

      // Also check subsections
      if (section.subsections && Array.isArray(section.subsections)) {
        for (const sub of section.subsections) {
          const subName = sub.name || sub.title || sectionName;
          if (sub.items && Array.isArray(sub.items)) {
            for (const item of sub.items) {
              addItem(item, sub, subName);
            }
          }
        }
      }
    }

    return matchingDishes;
  };

  // Helper function to get FIRST featured dish for a category from menu (for backward compatibility)
  const getCategoryDishFromMenu = (menu, categoryId) => {
    const allDishes = getAllCategoryDishesFromMenu(menu, categoryId);
    return allDishes.length > 0 ? allDishes[0] : null;
  };

  // Fetch restaurants from API
  useEffect(() => {
    const fetchRestaurants = async () => {
      // Don't call API without location
      if (!location?.latitude || !location?.longitude) return;

      try {
        setLoadingRestaurants(true);
        const response = await restaurantAPI.getNearbyRestaurants({
          latitude: location.latitude,
          longitude: location.longitude
        });

        if (response.data && response.data.success && response.data.data && response.data.data.restaurants) {
          const restaurantsArray = response.data.data.restaurants;

          // Filter out inactive restaurants (safety check)
          const activeRestaurants = restaurantsArray.filter((restaurant) => {
            return restaurant.isActive !== false; // Allow true or undefined
          });


          // Helper function to check if value is a default/mock value
          const isDefaultValue = (value, fieldName) => {
            if (!value) return false;

            const defaultOffers = [
              "Flat ₹50 OFF above ₹199",
              "Flat 50% OFF",
              "Flat ₹40 OFF above ₹149"];

            const defaultDeliveryTimes = ["25-30 mins", "20-25 mins", "30-35 mins"];
            const defaultDistances = ["1.2 km", "1 km", "0.8 km"];
            const defaultFeaturedPrice = 249;

            if (fieldName === 'offer' && defaultOffers.includes(value)) return true;
            if (fieldName === 'deliveryTime' && defaultDeliveryTimes.includes(value)) return true;
            if (fieldName === 'distance' && defaultDistances.includes(value)) return true;
            if (fieldName === 'featuredPrice' && value === defaultFeaturedPrice) return true;

            return false;
          };

          // Transform restaurants - basic info first
          const restaurantsWithIds = activeRestaurants.map((restaurant) => {
            const restaurantId = restaurant.restaurantId || restaurant._id;
            const coverImages = restaurant.coverImages && restaurant.coverImages.length > 0 ?
              restaurant.coverImages.map((img) => img.url || img).filter(Boolean) :
              [];
            const allImages = coverImages.length > 0 ? coverImages :
              restaurant.profileImage?.url ? [restaurant.profileImage.url] : [];
            const image = allImages[0] || null;

            return {
              id: restaurantId,
              name: restaurant.name,
              cuisine: restaurant.cuisines?.[0] || 'Multi-cuisine',
              cuisines: restaurant.cuisines || [],
              rating: restaurant.rating || 4.2,
              deliveryTime: restaurant.deliveryTime || '30-40 min',
              distance: restaurant.distance || '2.3 km',
              image: image,
              offer: restaurant.activeOffer || null,
              slug: restaurant.slug || restaurant.name?.toLowerCase().replace(/\s+/g, '-'),
              restaurantId: restaurantId,
              menu: null
            };
          });

          // Show base data immediately
          setRestaurantsData(restaurantsWithIds);
          setLoadingRestaurants(false);

          // Update cuisines
          const cuisinesSet = new Set();
          restaurantsWithIds.forEach(r => r.cuisines.forEach(c => c && cuisinesSet.add(c.trim())));
          setAvailableCuisines(Array.from(cuisinesSet).sort());

          // Load menus incrementally in background
          restaurantsWithIds.forEach(async (r) => {
            try {
              const menuRes = await restaurantAPI.getMenuByRestaurantId(r.restaurantId);
              if (menuRes.data?.success && menuRes.data?.data?.menu) {
                setRestaurantsData(prev => prev.map(item =>
                  item.id === r.id ? { ...item, menu: menuRes.data.data.menu } : item
                ));
              }
            } catch (err) {
              console.warn("Failed to load menu", r.id);
            }
          });
        }
      } catch (error) {
        console.error('Error fetching restaurants:', error);
        setLoadingRestaurants(false);
      }
    };

    fetchRestaurants();
  }, [location?.latitude, location?.longitude]);

  // Update selected category when URL changes
  useEffect(() => {
    if (category && categories && categories.length > 0) {
      const categorySlug = category.toLowerCase();
      const matchedCategory = categories.find((cat) =>
        cat.slug === categorySlug ||
        cat.id === categorySlug ||
        cat.name.toLowerCase().replace(/\s+/g, '-') === categorySlug
      );
      if (matchedCategory) {
        setSelectedCategory(matchedCategory.slug || matchedCategory.id);
      } else {
        setSelectedCategory(categorySlug);
      }
    } else if (category) {
      setSelectedCategory(category.toLowerCase());
    }
  }, [category, categories]);

  const toggleFilter = (filterId) => {
    setActiveFilters((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(filterId)) {
        newSet.delete(filterId);
      } else {
        newSet.add(filterId);
      }
      return newSet;
    });
    // Show loading when filter is toggled
    setIsLoadingFilterResults(true);
    setTimeout(() => {
      setIsLoadingFilterResults(false);
    }, 500);
  };

  // Scroll tracking effect for filter modal
  useEffect(() => {
    if (!isFilterOpen || !rightContentRef.current) return;

    const observerOptions = {
      root: rightContentRef.current,
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute('data-section-id');
          if (sectionId) {
            setActiveScrollSection(sectionId);
            setActiveFilterTab(sectionId);
          }
        }
      });
    }, observerOptions);

    Object.values(filterSectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [isFilterOpen]);

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };



  const filteredAllRestaurants = useMemo(() => {
    const sourceData = restaurantsData.length > 0 ? restaurantsData : [];
    let filtered = [...sourceData];

    // Filter by category - Dynamic filtering based on menu items
    if (selectedCategory) {
      const isAll = selectedCategory === 'all';
      const expandedDishes = [];
      let foundAnyMenu = false;

      filtered.forEach((r) => {
        if (r.menu) {
          foundAnyMenu = true;
          const categoryDishes = getAllCategoryDishesFromMenu(r.menu, selectedCategory);
          if (categoryDishes.length > 0) {
            // Group by restaurant: Find the first matching dish that respects vegMode
            const matchingDish = categoryDishes.find(dish => 
              !vegMode || String(dish.foodType || "").toLowerCase() === "veg"
            );

            if (matchingDish) {
              expandedDishes.push({
                ...r,
                categoryDish: matchingDish,
                categoryDishName: matchingDish.name,
                categoryDishPrice: matchingDish.price,
                categoryDishImage: matchingDish.image
              });
            }
          }
        } else if (isAll) {
          // If 'all' is selected but menu is still loading, keep the restaurant card
          expandedDishes.push(r);
        }
      });

      // For 'all', if we haven't loaded any menus yet, expandedDishes will just be restaurants
      // For specific categories, we MUST show only matches from menus
      if (isAll) {
        // Fallback to restaurants for 'all' if no menus loaded yet handled by line 545
        filtered = expandedDishes;
      } else {
        // For specific categories, only show dishes from loaded menus
        // If NO menus are loaded yet (foundAnyMenu is false), show empty list (to avoid restaurant flicker)
        if (foundAnyMenu) {
          filtered = expandedDishes;
        } else {
          // No menus have been searched yet for the specific category
          filtered = [];
        }
      }
    }

    // Apply filters
    if (activeFilters.has('under-30-mins')) {
      filtered = filtered.filter((r) => {
        if (!r.deliveryTime) return false;
        const timeMatch = r.deliveryTime.match(/(\d+)/);
        return timeMatch && parseInt(timeMatch[1]) <= 30;
      });
    }
    if (activeFilters.has('rating-4-plus')) {
      filtered = filtered.filter((r) => r.rating && r.rating >= 4.0);
    }
    if (activeFilters.has('under-250')) {
      filtered = filtered.filter((r) => {
        const dishPrice = r.categoryDishPrice || r.featuredPrice || 0;
        return dishPrice > 0 && dishPrice <= 250;
      });
    }
    if (activeFilters.has('flat-50-off')) {
      filtered = filtered.filter((r) => r.offer && r.offer.includes('50%'));
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((r) =>
        r.name?.toLowerCase().includes(query) ||
        r.cuisine?.toLowerCase().includes(query) ||
        r.featuredDish?.toLowerCase().includes(query) ||
        r.categoryDishName?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [selectedCategory, activeFilters, searchQuery, restaurantsData, categoryKeywords, vegMode]);

  const handleCategorySelect = (category) => {
    const categorySlug = category.slug || category.id;
    setSelectedCategory(categorySlug);
    // Update URL to reflect category change
    if (categorySlug === 'all') {
      navigate('/user/category/all');
    } else {
      navigate(`/user/category/${categorySlug}`);
    }
  };

  // Check if should show grayscale (user out of service)
  const shouldShowGrayscale = false;

  return (
    <div className={`min-h-screen bg-white dark:bg-[#0a0a0a] ${shouldShowGrayscale ? 'grayscale opacity-75' : ''}`}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white dark:bg-[#1a1a1a] shadow-sm">
        <div className="max-w-7xl mx-auto">
          {/* Search Bar with Back Button */}
          <div className="flex items-center gap-2 px-3 md:px-6 py-3 border-b border-gray-100 dark:border-gray-800">
            <button
              onClick={() => navigate('/user')}
              className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0">

              <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </button>

            <div className="flex-1 relative max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Restaurant name or a dish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 h-11 md:h-12 rounded-lg border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1a] focus:bg-white dark:focus:bg-[#2a2a2a] focus:border-gray-500 dark:focus:border-gray-600 text-sm md:text-base dark:text-white placeholder:text-gray-600 dark:placeholder:text-gray-400" />

            </div>
          </div>

          {/* Browse Category Section */}
          <div
            ref={categoryScrollRef}
            className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide px-4 md:px-6 py-3 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none"
            }}>

            {loadingCategories ?
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="h-5 w-5 animate-spin text-green-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Loading categories...</span>
              </div> :

              categories && categories.length > 0 ? categories.map((cat) => {
                const categorySlug = cat.slug || cat.id;
                const isSelected = selectedCategory === categorySlug || selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat)}
                    className={`flex flex-col items-center gap-1.5 flex-shrink-0 pb-2 transition-all ${isSelected ? 'border-b-2 border-green-600' : ''}`
                    }>

                    {cat.image ?
                      <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 transition-all ${isSelected ? 'border-green-600 shadow-lg' : 'border-transparent'}`
                      }>
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Hide broken images to avoid showing static placeholders
                            e.target.style.display = 'none';
                          }} />

                      </div> :

                      <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center border-2 transition-all ${isSelected ? 'border-green-600 shadow-lg bg-green-50 dark:bg-green-900/20' : 'border-transparent'}`
                      }>
                        <span className="text-xl md:text-2xl">🍽️</span>
                      </div>
                    }
                    <span className={`text-xs md:text-sm font-medium whitespace-nowrap ${isSelected ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`
                    }>
                      {cat.name}
                    </span>
                  </button>);

              }) :
                <div className="flex items-center justify-center py-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400">No categories available</span>
                </div>

            }
          </div>
        </div>
      </div>

      {/* Filters removed as requested */}

      {/* Content */}
      <div className="px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-4 sm:py-6 md:py-8 lg:py-10 space-y-6 md:space-y-8 lg:space-y-10">
        <div className="max-w-7xl mx-auto">
          {/* Results Grid */}
          <section className="relative">
            <h2 className="text-xs sm:text-sm md:text-base font-semibold text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-4 md:mb-6">
              {selectedCategory && selectedCategory !== 'all' ? 'ALL DISHES' : 'ALL RESTAURANTS'}
            </h2>

            {/* Loading Overlay or Results */}
            {loadingCategories || loadingRestaurants || isLoadingFilterResults || (selectedCategory !== 'all' && restaurantsData.length > 0 && !restaurantsData.some(r => r.menu)) ?
              <div className="bg-white/80 dark:bg-[#1a1a1a]/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-lg min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 text-green-600 animate-spin" strokeWidth={2.5} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {loadingCategories ? "Loading categories metadata..." : selectedCategory !== 'all' ? `Searching for ${categories.find(c => (c.slug || c.id) === selectedCategory)?.name || selectedCategory.replace(/-/g, ' ')}...` : "Filtering results..."}
                  </span>
                </div>
              </div> :
              filteredAllRestaurants.length === 0 ?
                /* Empty State */
                <div className="text-center py-16 md:py-24">
                  <div className="text-5xl md:text-6xl mb-4">🍽️</div>
                  <p className="text-gray-700 dark:text-gray-300 text-base md:text-lg font-semibold">
                    {searchQuery ?
                      `No dishes found for "${searchQuery}"` :
                      selectedCategory && selectedCategory !== 'all' ?
                        `No dishes found in ${categories.find(c => (c.slug || c.id) === selectedCategory)?.name || selectedCategory.replace(/-/g, ' ')}` :
                        "No dishes found with selected filters"}
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                    Try selecting a different category or removing filters
                  </p>
                  <Button
                    variant="outline"
                    className="mt-6 md:mt-8"
                    onClick={() => {
                      setActiveFilters(new Set());
                      setSearchQuery("");
                      setSelectedCategory('all');
                      navigate('/user/category/all');
                    }}>
                    Clear all filters
                  </Button>
                </div> :
                /* Large Restaurant Cards */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 lg:gap-6 xl:gap-7 items-stretch transition-opacity duration-300">
                  {filteredAllRestaurants.map((restaurant) => {
                    const restaurantSlug = restaurant.name.toLowerCase().replace(/\s+/g, "-");
                    const isFavorite = favorites.has(restaurant.id);

                    return (
                      <Link
                        key={restaurant.id}
                        to={`/user/restaurants/${restaurantSlug}${restaurant.categoryDishName ? `?search=${encodeURIComponent(restaurant.categoryDishName)}` : ''}`}
                        className="h-full flex">
                        <Card className={`overflow-hidden cursor-pointer gap-0 border-0 dark:border-gray-800 group bg-white dark:bg-[#1a1a1a] shadow-md hover:shadow-xl transition-all duration-300 py-0 rounded-md h-full flex flex-col w-full ${shouldShowGrayscale ? 'grayscale opacity-75' : ''}`
                        }>

                          {/* Image Section */}
                          <div className="relative h-44 sm:h-52 md:h-60 lg:h-64 xl:h-72 w-full overflow-hidden rounded-t-md flex-shrink-0">
                            {/* Use category dish image if available, otherwise restaurant image */}
                            {restaurant.categoryDishImage ?
                              <img
                                src={restaurant.categoryDishImage}
                                alt={restaurant.categoryDishName || restaurant.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                onError={(e) => {
                                  // Fallback to restaurant image if dish image fails
                                  if (restaurant.image) {
                                    e.target.src = restaurant.image;
                                  } else {
                                    // Show emoji placeholder
                                    e.target.style.display = 'none';
                                    const placeholder = document.createElement('div');
                                    placeholder.className = 'w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-6xl';
                                    placeholder.textContent = '🍽️';
                                    e.target.parentElement.appendChild(placeholder);
                                  }
                                }} /> :

                              restaurant.image ?
                                <img
                                  src={restaurant.image}
                                  alt={restaurant.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                  onError={(e) => {
                                    // Show emoji placeholder
                                    e.target.style.display = 'none';
                                    const placeholder = document.createElement('div');
                                    placeholder.className = 'w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-6xl';
                                    placeholder.textContent = '🍽️';
                                    e.target.parentElement.appendChild(placeholder);
                                  }} /> :


                                <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-6xl">
                                  🍽️
                                </div>
                            }

                            {/* Category Dish Badge - Top Left (shows category dish if available, otherwise featured dish) */}
                            {(restaurant.categoryDishName || restaurant.featuredDish) &&
                              <div className="absolute top-3 left-3 flex items-center gap-2">
                                <div className="bg-gray-800/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs sm:text-sm md:text-base font-medium flex items-center gap-2">
                                  <FoodTypeIcon isVeg={restaurant.categoryDish ? restaurant.categoryDish.foodType === "Veg" : restaurant.isVeg} size="sm" />
                                  <span>{restaurant.categoryDishName || restaurant.featuredDish} · ₹{restaurant.categoryDishPrice || restaurant.featuredPrice}</span>
                                </div>
                              </div>
                            }

                            {/* Ad Badge */}
                            {restaurant.isAd &&
                              <div className="absolute top-3 right-14 bg-black/50 text-white text-[10px] md:text-xs px-2 py-0.5 rounded">
                                Ad
                              </div>
                            }

                            {/* Bookmark Icon - Top Right */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-3 right-3 h-9 w-9 md:h-10 md:w-10 bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur-sm rounded-lg hover:bg-white dark:hover:bg-[#2a2a2a] transition-colors"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleFavorite(restaurant.id);
                              }}>

                              <Bookmark className={`h-5 w-5 md:h-6 md:w-6 ${isFavorite ? "fill-gray-800 dark:fill-gray-200 text-gray-800 dark:text-gray-200" : "text-gray-600 dark:text-gray-400"}`} strokeWidth={2} />
                            </Button>
                          </div>

                          {/* Content Section */}
                          <CardContent className="p-3 sm:p-4 md:p-5 lg:p-6 gap-0 flex-1 flex flex-col">
                            {/* Restaurant Name & Rating */}
                            <div className="flex items-start justify-between gap-2 mb-2 lg:mb-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-md md:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white line-clamp-1 lg:line-clamp-2">
                                  {restaurant.name}
                                </h3>
                              </div>
                              <div className="flex-shrink-0 bg-green-600 text-white px-2 md:px-3 lg:px-4 py-1 lg:py-1.5 rounded-lg flex items-center gap-1">
                                <span className="text-sm md:text-base lg:text-lg font-bold">{restaurant.rating}</span>
                                <Star className="h-3 w-3 md:h-4 md:w-4 lg:h-5 lg:w-5 fill-white text-white" />
                              </div>
                            </div>

                            {/* Delivery Time & Distance */}
                            <div className="flex items-center gap-1 text-sm md:text-base lg:text-lg text-gray-500 dark:text-gray-400 mb-2 lg:mb-3">
                              <Clock className="h-4 w-4 md:h-5 md:w-5 lg:h-6 lg:w-6" strokeWidth={1.5} />
                              <span className="font-medium">{restaurant.deliveryTime || 'Not available'}</span>
                              {restaurant.distance &&
                                <>
                                  <span className="mx-1">|</span>
                                  <span className="font-medium">{restaurant.distance}</span>
                                </>
                              }
                            </div>

                            {/* Offer Badge */}
                            {restaurant.offer &&
                              <div className="flex items-center gap-2 text-sm md:text-base lg:text-lg mt-auto">
                                <BadgePercent className="h-4 w-4 md:h-5 md:w-5 lg:h-6 lg:w-6 text-blue-600" strokeWidth={2} />
                                <span className="text-gray-700 dark:text-gray-300 font-medium">{restaurant.offer}</span>
                              </div>
                            }
                          </CardContent>
                        </Card>
                      </Link>);

                  })}
                </div>
            }
          </section>
        </div>
      </div>

      {/* Filter Modal - Bottom Sheet */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isFilterOpen &&
              <div className="fixed inset-0 z-[100]">
                {/* Backdrop */}
                <div
                  className="absolute inset-0 bg-black/50"
                  onClick={() => setIsFilterOpen(false)} />


                {/* Modal Content */}
                <div className="absolute bottom-0 left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-4xl bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl max-h-[85vh] md:max-h-[90vh] flex flex-col animate-[slideUp_0.3s_ease-out]">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">Filters and sorting</h2>
                    <button
                      onClick={() => {
                        setActiveFilters(new Set());
                        setSortBy(null);
                        setSelectedCuisine(null);
                      }}
                      className="text-green-600 dark:text-green-400 font-medium text-sm md:text-base">

                      Clear all
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar - Tabs */}
                    <div className="w-24 sm:w-28 md:w-32 bg-gray-50 dark:bg-[#0a0a0a] border-r border-gray-200 dark:border-gray-800 flex flex-col">
                      {[
                        { id: 'sort', label: 'Sort By', icon: ArrowDownUp },
                        { id: 'time', label: 'Time', icon: Timer },
                        { id: 'rating', label: 'Rating', icon: Star },
                        { id: 'distance', label: 'Distance', icon: MapPin },
                        { id: 'price', label: 'Dish Price', icon: IndianRupee },
                        { id: 'cuisine', label: 'Cuisine', icon: UtensilsCrossed },
                        { id: 'offers', label: 'Offers', icon: BadgePercent },
                        { id: 'trust', label: 'Trust', icon: ShieldCheck }].
                        map((tab) => {
                          const Icon = tab.icon;
                          const isActive = activeScrollSection === tab.id || activeFilterTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              onClick={() => {
                                setActiveFilterTab(tab.id);
                                const section = filterSectionRefs.current[tab.id];
                                if (section) {
                                  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }
                              }}
                              className={`flex flex-col items-center gap-1 py-4 px-2 text-center relative transition-colors ${isActive ? 'bg-white dark:bg-[#1a1a1a] text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`
                              }>

                              {isActive &&
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-600 rounded-r" />
                              }
                              <Icon className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1.5} />
                              <span className="text-xs md:text-sm font-medium leading-tight">{tab.label}</span>
                            </button>);

                        })}
                    </div>

                    {/* Right Content Area - Scrollable */}
                    <div ref={rightContentRef} className="flex-1 overflow-y-auto p-4 md:p-6">
                      {/* Sort By Tab */}
                      <div
                        ref={(el) => filterSectionRefs.current['sort'] = el}
                        data-section-id="sort"
                        className="space-y-4 mb-8">

                        <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4">Sort by</h3>
                        <div className="flex flex-col gap-3">
                          {[
                            { id: null, label: 'Relevance' },
                            { id: 'price-low', label: 'Price: Low to High' },
                            { id: 'price-high', label: 'Price: High to Low' },
                            { id: 'rating-high', label: 'Rating: High to Low' },
                            { id: 'rating-low', label: 'Rating: Low to High' }].
                            map((option) =>
                              <button
                                key={option.id || 'relevance'}
                                onClick={() => setSortBy(option.id)}
                                className={`px-4 md:px-5 py-3 md:py-4 rounded-xl border text-left transition-colors ${sortBy === option.id ?
                                  'border-green-600 bg-green-50 dark:bg-green-900/20' :
                                  'border-gray-200 dark:border-gray-700 hover:border-green-600'}`
                                }>

                                <span className={`text-sm md:text-base font-medium ${sortBy === option.id ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                  {option.label}
                                </span>
                              </button>
                            )}
                        </div>
                      </div>

                      {/* Time Tab */}
                      <div
                        ref={(el) => filterSectionRefs.current['time'] = el}
                        data-section-id="time"
                        className="space-y-4 mb-8">

                        <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4">Delivery Time</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                          <button
                            onClick={() => toggleFilter('under-30-mins')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('under-30-mins') ?
                              'border-green-600 bg-green-50 dark:bg-green-900/20' :
                              'border-gray-200 dark:border-gray-700 hover:border-green-600'}`
                            }>

                            <Timer className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('under-30-mins') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('under-30-mins') ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>Under 30 mins</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('delivery-under-45')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('delivery-under-45') ?
                              'border-green-600 bg-green-50 dark:bg-green-900/20' :
                              'border-gray-200 dark:border-gray-700 hover:border-green-600'}`
                            }>

                            <Timer className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('delivery-under-45') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('delivery-under-45') ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>Under 45 mins</span>
                          </button>
                        </div>
                      </div>

                      {/* Rating Tab */}
                      <div
                        ref={(el) => filterSectionRefs.current['rating'] = el}
                        data-section-id="rating"
                        className="space-y-4 mb-8">

                        <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4">Restaurant Rating</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                          <button
                            onClick={() => toggleFilter('rating-35-plus')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('rating-35-plus') ?
                              'border-green-600 bg-green-50 dark:bg-green-900/20' :
                              'border-gray-200 dark:border-gray-700 hover:border-green-600'}`
                            }>

                            <Star className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('rating-35-plus') ? 'text-green-600 fill-green-600 dark:text-green-400 dark:fill-green-400' : 'text-gray-400 dark:text-gray-500'}`} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('rating-35-plus') ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>Rated 3.5+</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('rating-4-plus')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('rating-4-plus') ?
                              'border-green-600 bg-green-50 dark:bg-green-900/20' :
                              'border-gray-200 dark:border-gray-700 hover:border-green-600'}`
                            }>

                            <Star className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('rating-4-plus') ? 'text-green-600 fill-green-600 dark:text-green-400 dark:fill-green-400' : 'text-gray-400 dark:text-gray-500'}`} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('rating-4-plus') ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>Rated 4.0+</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('rating-45-plus')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('rating-45-plus') ?
                              'border-green-600 bg-green-50 dark:bg-green-900/20' :
                              'border-gray-200 dark:border-gray-700 hover:border-green-600'}`
                            }>

                            <Star className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('rating-45-plus') ? 'text-green-600 fill-green-600 dark:text-green-400 dark:fill-green-400' : 'text-gray-400 dark:text-gray-500'}`} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('rating-45-plus') ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>Rated 4.5+</span>
                          </button>
                        </div>
                      </div>

                      {/* Distance Tab */}
                      <div
                        ref={(el) => filterSectionRefs.current['distance'] = el}
                        data-section-id="distance"
                        className="space-y-4 mb-8">

                        <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4">Distance</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                          <button
                            onClick={() => toggleFilter('distance-under-1km')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('distance-under-1km') ?
                              'border-green-600 bg-green-50 dark:bg-green-900/20' :
                              'border-gray-200 dark:border-gray-700 hover:border-green-600'}`
                            }>

                            <MapPin className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('distance-under-1km') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('distance-under-1km') ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>Under 1 km</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('distance-under-2km')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('distance-under-2km') ?
                              'border-green-600 bg-green-50 dark:bg-green-900/20' :
                              'border-gray-200 dark:border-gray-700 hover:border-green-600'}`
                            }>

                            <MapPin className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('distance-under-2km') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('distance-under-2km') ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>Under 2 km</span>
                          </button>
                        </div>
                      </div>

                      {/* Price Tab */}
                      <div
                        ref={(el) => filterSectionRefs.current['price'] = el}
                        data-section-id="price"
                        className="space-y-4 mb-8">

                        <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4">Dish Price</h3>
                        <div className="flex flex-col gap-3 md:gap-4">
                          <button
                            onClick={() => toggleFilter('price-under-200')}
                            className={`px-4 md:px-5 py-3 md:py-4 rounded-xl border text-left transition-colors ${activeFilters.has('price-under-200') ?
                              'border-green-600 bg-green-50 dark:bg-green-900/20' :
                              'border-gray-200 dark:border-gray-700 hover:border-green-600'}`
                            }>

                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('price-under-200') ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>Under ₹200</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('under-250')}
                            className={`px-4 md:px-5 py-3 md:py-4 rounded-xl border text-left transition-colors ${activeFilters.has('under-250') ?
                              'border-green-600 bg-green-50 dark:bg-green-900/20' :
                              'border-gray-200 dark:border-gray-700 hover:border-green-600'}`
                            }>

                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('under-250') ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>Under ₹250</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('price-under-500')}
                            className={`px-4 md:px-5 py-3 md:py-4 rounded-xl border text-left transition-colors ${activeFilters.has('price-under-500') ?
                              'border-green-600 bg-green-50 dark:bg-green-900/20' :
                              'border-gray-200 dark:border-gray-700 hover:border-green-600'}`
                            }>

                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('price-under-500') ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>Under ₹500</span>
                          </button>
                        </div>
                      </div>

                      {/* Cuisine Tab */}
                      {availableCuisines.length > 0 &&
                        <div
                          ref={(el) => filterSectionRefs.current['cuisine'] = el}
                          data-section-id="cuisine"
                          className="space-y-4 mb-8">

                          <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4">Cuisine</h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                            {availableCuisines.map((cuisine) =>
                              <button
                                key={cuisine}
                                onClick={() => setSelectedCuisine(selectedCuisine === cuisine ? null : cuisine)}
                                className={`px-4 md:px-5 py-3 md:py-4 rounded-xl border text-center transition-colors ${selectedCuisine === cuisine ?
                                  'border-green-600 bg-green-50 dark:bg-green-900/20' :
                                  'border-gray-200 dark:border-gray-700 hover:border-green-600'}`
                                }>

                                <span className={`text-sm md:text-base font-medium ${selectedCuisine === cuisine ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                  {cuisine}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      }

                      {/* Offers Tab */}
                      <div
                        ref={(el) => filterSectionRefs.current['offers'] = el}
                        data-section-id="offers"
                        className="space-y-4 mb-8">

                        <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4">Offers</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                          <button
                            onClick={() => toggleFilter('flat-50-off')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('flat-50-off') ?
                              'border-green-600 bg-green-50 dark:bg-green-900/20' :
                              'border-gray-200 dark:border-gray-700 hover:border-green-600'}`
                            }>

                            <BadgePercent className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('flat-50-off') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('flat-50-off') ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>Flat 50% OFF</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('price-match')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('price-match') ?
                              'border-green-600 bg-green-50 dark:bg-green-900/20' :
                              'border-gray-200 dark:border-gray-700 hover:border-green-600'}`
                            }>

                            <BadgePercent className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('price-match') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('price-match') ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>Price Match</span>
                          </button>
                        </div>
                      </div>

                      {/* Trust Markers Tab */}
                      {activeFilterTab === 'trust' &&
                        <div className="space-y-4">
                          <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">Trust Markers</h3>
                          <div className="flex flex-col gap-3 md:gap-4">
                            <button className="px-4 md:px-5 py-3 md:py-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-green-600 text-left transition-colors">
                              <span className="text-sm md:text-base font-medium text-gray-700 dark:text-gray-300">Top Rated</span>
                            </button>
                            <button className="px-4 md:px-5 py-3 md:py-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-green-600 text-left transition-colors">
                              <span className="text-sm md:text-base font-medium text-gray-700 dark:text-gray-300">Trusted by 1000+ users</span>
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center gap-4 px-4 md:px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1a1a]">
                    <button
                      onClick={() => setIsFilterOpen(false)}
                      className="flex-1 py-3 md:py-4 text-center font-semibold text-gray-700 dark:text-gray-300 text-sm md:text-base">

                      Close
                    </button>
                    <button
                      onClick={() => {
                        setIsLoadingFilterResults(true);
                        setIsFilterOpen(false);
                        // Simulate loading for 500ms
                        setTimeout(() => {
                          setIsLoadingFilterResults(false);
                        }, 500);
                      }}
                      className={`flex-1 py-3 md:py-4 font-semibold rounded-xl transition-colors text-sm md:text-base ${activeFilters.size > 0 || sortBy || selectedCuisine ?
                        'bg-green-600 text-white hover:bg-green-700' :
                        'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`
                      }>

                      {activeFilters.size > 0 || sortBy || selectedCuisine ?
                        'Show results' :
                        'Show results'}
                    </button>
                  </div>
                </div>
              </div>
            }
          </AnimatePresence>,
          document.body
        )}

      <style>{`
        @keyframes slideUp {
          0% {
            transform: translateY(100%);
          }
          100% {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>);
}
