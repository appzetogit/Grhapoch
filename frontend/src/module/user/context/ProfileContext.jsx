import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react"
import { authAPI, userAPI } from "@/lib/api"

const ProfileContext = createContext(null)

export function ProfileProvider({ children }) {
  const [userProfile, setUserProfile] = useState(() => {
    // First, try to get from localStorage (user_user from auth)
    const userStr = localStorage.getItem("user_user")
    if (userStr) {
      try {
        return JSON.parse(userStr)
      } catch (e) {
        console.error("Error parsing user_user from localStorage:", e)
      }
    }

    // Fallback to userProfile from localStorage
    const saved = localStorage.getItem("userProfile")
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error("Error parsing userProfile from localStorage:", e)
      }
    }

    // Default empty profile
    return null
  })

  const [loading, setLoading] = useState(true)

  const [addresses, setAddresses] = useState([])

  const [paymentMethods, setPaymentMethods] = useState(() => {
    const saved = localStorage.getItem("userPaymentMethods")
    return saved ? JSON.parse(saved) : [
      {
        id: "1",
        cardNumber: "1234",
        cardHolder: "John Doe",
        expiryMonth: "12",
        expiryYear: "2025",
        cvv: "123",
        isDefault: true,
        type: "visa",
      },
      {
        id: "2",
        cardNumber: "5678",
        cardHolder: "John Doe",
        expiryMonth: "12",
        expiryYear: "2026",
        cvv: "456",
        isDefault: false,
        type: "mastercard",
      },
    ]
  })

  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem("userFavorites")
    return saved ? JSON.parse(saved) : []
  })

  // Dish favorites state - stored in localStorage for persistence
  const [dishFavorites, setDishFavorites] = useState(() => {
    const saved = localStorage.getItem("userDishFavorites")
    return saved ? JSON.parse(saved) : []
  })

  // VegMode state - stored in localStorage for persistence
  const [vegMode, setVegMode] = useState(() => {
    const saved = localStorage.getItem("userVegMode")
    // Default to true (ON) if not set
    return saved !== null ? saved === "true" : true
  })

  // Save to localStorage whenever userProfile, addresses or paymentMethods change
  useEffect(() => {
    if (userProfile) {
      const stringifiedProfile = JSON.stringify(userProfile);
      localStorage.setItem("userProfile", stringifiedProfile);
      localStorage.setItem("user_user", stringifiedProfile);
    }
  }, [userProfile])

  useEffect(() => {
    localStorage.setItem("userAddresses", JSON.stringify(addresses))
  }, [addresses])

  useEffect(() => {
    localStorage.setItem("userPaymentMethods", JSON.stringify(paymentMethods))
  }, [paymentMethods])

  useEffect(() => {
    localStorage.setItem("userFavorites", JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => {
    localStorage.setItem("userDishFavorites", JSON.stringify(dishFavorites))
  }, [dishFavorites])

  useEffect(() => {
    localStorage.setItem("userVegMode", vegMode.toString())
  }, [vegMode])

  // Fetch user profile and addresses from API on mount and when authentication changes
  useEffect(() => {
    const fetchUserProfile = async () => {
      // Check if user is authenticated
      const isAuthenticated = localStorage.getItem("user_authenticated") === "true" ||
        localStorage.getItem("user_accessToken")

      if (!isAuthenticated) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        // Fetch user profile
        const response = await authAPI.getCurrentUser()
        const userData = response?.data?.data?.user || response?.data?.user || response?.data

        if (userData) {
          setUserProfile(userData)
          // Update localStorage
          localStorage.setItem("user_user", JSON.stringify(userData))
          localStorage.setItem("userProfile", JSON.stringify(userData))
        }

        // Fetch addresses
        try {
          const addressesResponse = await userAPI.getAddresses()
          const addressesData = addressesResponse?.data?.data?.addresses || addressesResponse?.data?.addresses || []
          setAddresses(addressesData)
          localStorage.setItem("userAddresses", JSON.stringify(addressesData))
        } catch (addressError) {
          console.error("Error fetching addresses:", addressError)
          // Try to load from localStorage as fallback
          const saved = localStorage.getItem("userAddresses")
          if (saved) {
            try {
              setAddresses(JSON.parse(saved))
            } catch (e) {
              console.error("Error parsing saved addresses:", e)
            }
          }
        }
      } catch (error) {
        // Silently handle error - use existing profile from localStorage
        console.error("Error fetching user profile:", error)
        // Try to load from localStorage as fallback
        const saved = localStorage.getItem("userAddresses")
        if (saved) {
          try {
            setAddresses(JSON.parse(saved))
          } catch (e) {
            console.error("Error parsing saved addresses:", e)
          }
        }
      } finally {
        setLoading(false)
      }
    }

    fetchUserProfile()

    // Fetch favorites from database
    const fetchFavorites = async () => {
      const isAuthenticated = localStorage.getItem("user_authenticated") === "true" ||
        localStorage.getItem("user_accessToken")
      if (!isAuthenticated) return

      try {
        const response = await userAPI.getFavorites()
        const { collections: dbCollData } = response.data.data

        if (dbCollData) {
          // Sync Restaurants
          if (dbCollData.restaurants) {
            const transformedFavs = dbCollData.restaurants.map(f => {
              const r = f.restaurantId;
              const name = f.name || (typeof r === 'object' ? r.name : 'Unknown Restaurant');
              const slug = f.slug || (typeof r === 'object' ? r.slug : name.toLowerCase().replace(/\s+/g, "-"));

              return {
                ... (typeof r === 'object' ? r : {}),
                id: f._id || (typeof r === 'object' ? r._id : r),
                restaurantId: typeof r === 'object' ? (r._id || r.id) : r,
                slug: slug,
                name: name,
                image: f.image || (typeof r === 'object' ? (r.profileImage?.url || r.image) : null),
                cuisine: f.cuisine || (typeof r === 'object' ? (Array.isArray(r.cuisines) ? r.cuisines.join(', ') : r.cuisine) : null),
                rating: f.rating || (typeof r === 'object' ? r.rating : null),
                addedAt: f.addedAt
              };
            }).filter(Boolean);

            setFavorites(transformedFavs)
          } else {
            setFavorites([]);
          }

          // Sync Dishes
          if (dbCollData.dishes) {
            const transformedDishes = dbCollData.dishes.map(d => {
              const dishObj = typeof d === 'object' ?
                (typeof d.toObject === 'function' ? d.toObject() : d) :
                null;

              if (!dishObj) return null;

              return {
                ...dishObj,
                id: d.dishId || dishObj.dishId || dishObj._id || dishObj.id,
                dishId: d.dishId || dishObj.dishId || dishObj._id || dishObj.id,
                restaurantId: d.restaurantId?._id || d.restaurantId || dishObj.restaurantId,
                name: d.name || dishObj.name,
                price: d.price || dishObj.price,
                image: d.image || dishObj.image,
                foodType: d.foodType || dishObj.foodType,
                restaurantName: d.restaurantName || dishObj.restaurantName,
                restaurantSlug: d.restaurantSlug || dishObj.restaurantSlug || 
                               (typeof d.restaurantId === 'object' ? d.restaurantId.slug : null),
                addedAt: d.addedAt
              };
            }).filter(Boolean);

            // Deduplicate dishes
            const uniqueDishes = [];
            const seenDishIds = new Set();
            transformedDishes.forEach(d => {
              const key = `${d.id}-${d.restaurantId}`;
              if (!seenDishIds.has(key)) {
                uniqueDishes.push(d);
                seenDishIds.add(key);
              }
            });

            setDishFavorites(uniqueDishes)
          }
        }

        // --- Granular Migration ---
        const localFavs = JSON.parse(localStorage.getItem("userFavorites") || "[]");
        const localDishFavs = JSON.parse(localStorage.getItem("userDishFavorites") || "[]");

        // Migrate Restaurants if DB is empty but local is not
        if (localFavs.length > 0 && (!dbCollData || !dbCollData.restaurants || dbCollData.restaurants.length === 0)) {
          console.log("Migrating local restaurant favorites to database...");
          for (const rf of localFavs) {
            await addFavorite(rf);
          }
          // Clear local storage after migration
          localStorage.removeItem("userFavorites");
        }

        // Migrate Dishes if DB is empty but local is not
        if (localDishFavs.length > 0 && (!dbCollData || !dbCollData.dishes || dbCollData.dishes.length === 0)) {
          console.log("Migrating local dish favorites to database...");
          for (const df of localDishFavs) {
            await addDishFavorite(df);
          }
          // Clear local storage after migration
          localStorage.removeItem("userDishFavorites");
        }
      } catch (error) {
        console.error("Error fetching favorites from DB:", error)
      }
    }

    fetchFavorites()

    // Listen for auth changes
    const handleAuthChange = () => {
      const isAuthenticated = localStorage.getItem("user_authenticated") === "true" ||
        localStorage.getItem("user_accessToken") ||
        localStorage.getItem("accessToken");

      if (!isAuthenticated) {
        setUserProfile(null);
        setAddresses([]);
        setFavorites([]);
        setDishFavorites([]);
      } else {
        fetchUserProfile()
        fetchFavorites()
      }
    }

    window.addEventListener("userAuthChanged", handleAuthChange)

    return () => {
      window.removeEventListener("userAuthChanged", handleAuthChange)
    }
  }, [])

  // Address functions - memoized with useCallback
  const addAddress = useCallback(async (address) => {
    try {
      const response = await userAPI.addAddress(address)
      const newAddress = response?.data?.data?.address || response?.data?.address

      if (newAddress) {
        setAddresses((prev) => {
          const updated = [...prev, newAddress]
          localStorage.setItem("userAddresses", JSON.stringify(updated))
          return updated
        })
        return newAddress
      }
    } catch (error) {
      console.error("Error adding address:", error)
      throw error
    }
  }, [])

  const updateAddress = useCallback(async (id, updatedAddress) => {
    try {
      const response = await userAPI.updateAddress(id, updatedAddress)
      const updatedAddr = response?.data?.data?.address || response?.data?.address

      if (updatedAddr) {
        setAddresses((prev) => {
          const updated = prev.map((addr) => (addr.id === id ? { ...updatedAddr, id } : addr))
          localStorage.setItem("userAddresses", JSON.stringify(updated))
          return updated
        })
        return updatedAddr
      }
    } catch (error) {
      console.error("Error updating address:", error)
      throw error
    }
  }, [])

  const deleteAddress = useCallback(async (id) => {
    try {
      await userAPI.deleteAddress(id)
      setAddresses((prev) => {
        const newAddresses = prev.filter((addr) => addr.id !== id)
        localStorage.setItem("userAddresses", JSON.stringify(newAddresses))
        return newAddresses
      })
    } catch (error) {
      console.error("Error deleting address:", error)
      throw error
    }
  }, [])

  const setDefaultAddress = useCallback((id) => {
    setAddresses((prev) =>
      prev.map((addr) => ({
        ...addr,
        isDefault: addr.id === id,
      }))
    )
  }, [])

  const getDefaultAddress = useCallback(() => {
    return addresses.find((addr) => addr.isDefault) || addresses[0] || null
  }, [addresses])

  // Payment method functions - memoized with useCallback
  const addPaymentMethod = useCallback((payment) => {
    setPaymentMethods((prev) => {
      const newPayment = {
        ...payment,
        id: Date.now().toString(),
        isDefault: prev.length === 0 ? true : false,
      }
      return [...prev, newPayment]
    })
  }, [])

  const updatePaymentMethod = useCallback((id, updatedPayment) => {
    setPaymentMethods((prev) =>
      prev.map((pm) => (pm.id === id ? { ...pm, ...updatedPayment } : pm))
    )
  }, [])

  const deletePaymentMethod = useCallback((id) => {
    setPaymentMethods((prev) => {
      const paymentToDelete = prev.find((pm) => pm.id === id)
      const newPayments = prev.filter((pm) => pm.id !== id)

      // If deleting default, set first remaining as default
      if (paymentToDelete?.isDefault && newPayments.length > 0) {
        newPayments[0].isDefault = true
      }

      return newPayments
    })
  }, [])

  const setDefaultPaymentMethod = useCallback((id) => {
    setPaymentMethods((prev) =>
      prev.map((pm) => ({
        ...pm,
        isDefault: pm.id === id,
      }))
    )
  }, [])

  const getDefaultPaymentMethod = useCallback(() => {
    return paymentMethods.find((pm) => pm.isDefault) || paymentMethods[0] || null
  }, [paymentMethods])

  const getAddressById = useCallback((id) => {
    return addresses.find((addr) => addr.id === id)
  }, [addresses])

  const getPaymentMethodById = useCallback((id) => {
    return paymentMethods.find((pm) => pm.id === id)
  }, [paymentMethods])

  // Favorites functions - memoized with useCallback
  const addFavorite = useCallback(async (restaurant) => {
    // Optimistic update
    setFavorites((prev) => {
      if (!prev.find(fav => fav.slug === restaurant.slug)) {
        return [...prev, restaurant]
      }
      return prev
    })

    // Backend sync
    try {
      const restaurantId = restaurant.restaurantId || restaurant._id || restaurant.id;
      console.log('📡 [FRONTEND] Sending toggleFavorite for ID:', restaurantId, 'Name:', restaurant.name);

      if (restaurantId) {
        const response = await userAPI.toggleRestaurantFavorite(restaurantId);
        console.log('✅ [FRONTEND] toggleFavorite SUCCESS:', response.data?.message);

        // Ensure we always sync with server state if returned
        if (response.data?.success && response.data.data?.collections) {
          const dbData = response.data.data.collections;
          
          // Sync Restaurants
          if (dbData.restaurants) {
            const syncedFavs = dbData.restaurants.map(f => {
              const r = f.restaurantId || {};
              const name = f.name || r.name || 'Unknown Restaurant';
              return {
                ... (typeof r === 'object' ? r : {}),
                _id: f._id,
                restaurantId: r._id || f.restaurantId,
                name: name,
                image: f.image || r.profileImage?.url || r.image,
                slug: f.slug || r.slug || name.toLowerCase().replace(/\s+/g, "-"),
                cuisine: f.cuisine || (Array.isArray(r.cuisines) ? r.cuisines.join(', ') : r.cuisine),
                rating: f.rating || r.rating,
                addedAt: f.addedAt
              };
            });
            setFavorites(syncedFavs);
          }
        }
      } else {
        console.error('❌ [FRONTEND] No restaurantId found to sync!');
      }
    } catch (error) {
      console.error("❌ [FRONTEND] Error syncing restaurant favorite to DB:", error.response?.data || error.message);
      // Revert optimistic update if needed or just let it be (re-fetch will happen later)
    }
  }, [])

  const removeFavorite = useCallback(async (slugOrId) => {
    let itemToRemove = favorites.find(f => 
      f.slug === slugOrId || 
      f._id === slugOrId || 
      f.id === slugOrId || 
      String(f.restaurantId) === String(slugOrId)
    )
    setFavorites((prev) => prev.filter(fav => 
      fav.slug !== slugOrId && 
      fav._id !== slugOrId && 
      fav.id !== slugOrId &&
      String(fav.restaurantId) !== String(slugOrId)
    ))

    // Backend sync
    try {
      const restaurantId = itemToRemove?.restaurantId || itemToRemove?._id || itemToRemove?.id;
      console.log('📡 [FRONTEND] Sending remove toggle for ID:', restaurantId);

      if (restaurantId) {
        const response = await userAPI.toggleRestaurantFavorite(restaurantId);
        console.log('✅ [FRONTEND] remove toggle SUCCESS:', response.data?.message);

        // Ensure we always sync with server state if returned
        if (response.data?.success && response.data.data?.collections) {
          const dbData = response.data.data.collections;
          
          // Sync Restaurants
          if (dbData.restaurants) {
            const syncedFavs = dbData.restaurants.map(f => {
              const r = f.restaurantId || {};
              const name = f.name || r.name || 'Unknown Restaurant';
              return {
                ... (typeof r === 'object' ? r : {}),
                _id: f._id,
                restaurantId: r._id || f.restaurantId,
                name: name,
                image: f.image || r.profileImage?.url || r.image,
                slug: f.slug || r.slug || name.toLowerCase().replace(/\s+/g, "-"),
                cuisine: f.cuisine || (Array.isArray(r.cuisines) ? r.cuisines.join(', ') : r.cuisine),
                rating: f.rating || r.rating,
                addedAt: f.addedAt
              };
            });
            setFavorites(syncedFavs);
          }
        }
      }
    } catch (error) {
      console.error("❌ [FRONTEND] Error removing restaurant favorite from DB:", error.response?.data || error.message);
    }
  }, [favorites])

  const isFavorite = useCallback((slug) => {
    const isFav = favorites.some(fav => fav.slug === slug)
    // console.log(`🔍 [isFavorite] Checking ${slug}: ${isFav ? 'YES' : 'NO'}`);
    return isFav;
  }, [favorites])

  const getFavorites = useCallback(() => {
    return favorites
  }, [favorites])

  // Dish favorites functions - memoized with useCallback
  const addDishFavorite = useCallback(async (dish) => {
    // Optimistic update
    setDishFavorites((prev) => {
      const dId = dish.id || dish.dishId || dish._id;
      const resId = dish.restaurantId;
      const resSlug = dish.restaurantSlug;

      const exists = prev.some(fav =>
        (fav.id === dId || fav.dishId === dId) &&
        (fav.restaurantId === resId || 
         fav.restaurantId?._id === resId || 
         fav.restaurantSlug === resId ||
         fav.restaurantSlug === resSlug)
      );
      if (!exists) {
        return [...prev, dish]
      }
      return prev
    })

    // Backend sync
    try {
      const dishId = dish.id || dish.dishId || dish._id;
      const resId = dish.restaurantId;

      if (dishId && resId) {
        const response = await userAPI.toggleDishFavorite({
          dishId,
          restaurantId: resId,
          name: dish.name,
          price: dish.price,
          image: dish.image,
          foodType: dish.foodType,
          restaurantName: dish.restaurantName,
          restaurantSlug: dish.restaurantSlug
        });

        if (response.data?.success && response.data.data?.collections?.dishes) {
          // Sync with server state
          const serverDishes = response.data.data.collections.dishes;
          const transformedDishes = serverDishes.map(d => ({
            ...d,
            id: d.dishId || d.id || d._id,
            dishId: d.dishId || d.id || d._id,
            restaurantId: d.restaurantId?._id || d.restaurantId,
            restaurantSlug: d.restaurantSlug || dish.restaurantSlug
          }));
          setDishFavorites(transformedDishes);
        }
      }
    } catch (error) {
      console.error("Error adding dish favorite to DB:", error)
    }
  }, [])

  const removeDishFavorite = useCallback(async (dishId, restaurantId) => {
    // Optimistic update
    setDishFavorites((prev) => prev.filter(fav => {
      const favDishId = fav.id || fav.dishId || fav._id;
      const matchDish = favDishId === dishId;
      const matchRes = 
        fav.restaurantId === restaurantId || 
        fav.restaurantId?._id === restaurantId || 
        fav.restaurantSlug === restaurantId;
        
      return !(matchDish && matchRes);
    }))

    // Backend sync
    try {
      const resId = restaurantId?._id || restaurantId;
      if (dishId && resId) {
        const response = await userAPI.toggleDishFavorite({ dishId, restaurantId: resId });

        if (response.data?.success && response.data.data?.collections?.dishes) {
          const transformedDishes = response.data.data.collections.dishes.map(d => ({
            ...d,
            id: d.dishId || d.id || d._id,
            dishId: d.dishId || d.id || d._id,
            restaurantId: d.restaurantId?._id || d.restaurantId
          }));
          setDishFavorites(transformedDishes);
        }
      }
    } catch (error) {
      console.error("Error removing dish favorite from DB:", error)
    }
  }, [])

  const isDishFavorite = useCallback((dishId, restaurantIdentifier, itemName = "") => {
    if (!dishId || !restaurantIdentifier) return false;
    
    const dId = String(dishId);
    const rId = String(restaurantIdentifier);
    const iName = String(itemName || "").toLowerCase().trim();

    // Guard against generic matches
    if (dId === 'undefined' || dId === 'null' || dId === '[object Object]') {
      if (!iName) return false;
    }

    return dishFavorites.some(fav => {
      const favDishId = String(fav.id || fav.dishId || fav._id || "");
      const favName = String(fav.name || "").toLowerCase().trim();
      
      // strict match: ID must match AND Name must match (if provided)
      const idMatch = (favDishId !== "undefined" && favDishId !== "null" && favDishId === dId);
      const nameMatch = (favName === iName);
      
      let matchDish = false;
      if (dId !== "undefined" && dId !== "null" && iName) {
        matchDish = idMatch && nameMatch;
      } else if (dId !== "undefined" && dId !== "null") {
        matchDish = idMatch;
      } else if (iName) {
        matchDish = nameMatch;
      }
      
      const matchRes = 
        String(fav.restaurantId || "") === rId || 
        String(fav.restaurantId?._id || "") === rId || 
        String(fav.restaurantSlug || "").toLowerCase() === rId.toLowerCase();

      return matchDish && matchRes;
    })
  }, [dishFavorites])

  const getDishFavorites = useCallback(() => {
    return dishFavorites
  }, [dishFavorites])

  // User profile functions - memoized with useCallback
  const updateUserProfile = useCallback((updatedProfile) => {
    setUserProfile((prev) => ({ ...prev, ...updatedProfile }))
  }, [])

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      userProfile,
      loading,
      updateUserProfile,
      addresses,
      paymentMethods,
      favorites,
      vegMode,
      setVegMode,
      addAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress,
      getDefaultAddress,
      getAddressById,
      addPaymentMethod,
      updatePaymentMethod,
      deletePaymentMethod,
      setDefaultPaymentMethod,
      getDefaultPaymentMethod,
      getPaymentMethodById,
      addFavorite,
      removeFavorite,
      isFavorite,
      getFavorites,
      dishFavorites,
      addDishFavorite,
      removeDishFavorite,
      isDishFavorite,
      getDishFavorites,
    }),
    [
      userProfile,
      loading,
      updateUserProfile,
      addresses,
      paymentMethods,
      favorites,
      dishFavorites,
      vegMode,
      setVegMode,
      addAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress,
      getDefaultAddress,
      getAddressById,
      addPaymentMethod,
      updatePaymentMethod,
      deletePaymentMethod,
      setDefaultPaymentMethod,
      getDefaultPaymentMethod,
      getPaymentMethodById,
      addFavorite,
      removeFavorite,
      isFavorite,
      getFavorites,
      addDishFavorite,
      removeDishFavorite,
      isDishFavorite,
      getDishFavorites,
    ]
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (!context) {
    return {
      userProfile: null,
      loading: false,
      updateUserProfile: () => { },
      addresses: [],
      paymentMethods: [],
      favorites: [],
      addAddress: () => { },
      updateAddress: () => { },
      deleteAddress: () => { },
      setDefaultAddress: () => { },
      getDefaultAddress: () => null,
      getAddressById: () => null,
      addPaymentMethod: () => { },
      updatePaymentMethod: () => { },
      deletePaymentMethod: () => { },
      setDefaultPaymentMethod: () => { },
      getDefaultPaymentMethod: () => null,
      getPaymentMethodById: () => null,
      addFavorite: () => { },
      removeFavorite: () => { },
      isFavorite: () => false,
      getFavorites: () => [],
      dishFavorites: [],
      addDishFavorite: () => { },
      removeDishFavorite: () => { },
      isDishFavorite: () => false,
      getDishFavorites: () => [],
      vegMode: true,
      setVegMode: () => { }
    }
  }
  return context
}

