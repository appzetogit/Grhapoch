import Restaurant from '../models/Restaurant.js';
import DiningCategory from '../models/DiningCategory.js';
import DiningLimelight from '../models/DiningLimelight.js';
import DiningBankOffer from '../models/DiningBankOffer.js';
import DiningMustTry from '../models/DiningMustTry.js';
import DiningOfferBanner from '../models/DiningOfferBanner.js';
import DiningStory from '../models/DiningStory.js';
import DiningTable from '../models/DiningTable.js';
import DiningBooking from '../models/DiningBooking.js';
import RestaurantNotification from '../models/RestaurantNotification.js';
import { createOrder, verifyPayment } from '../services/razorpayService.js';
import { notifyRestaurantFCM } from '../services/fcmNotificationService.js';
import { emitDiningBookingStatusUpdate } from '../services/diningBookingRealtimeService.js';

const BOOKING_STATUSES = {
    PENDING: "Pending",
    CONFIRMED: "Confirmed",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
    COMPLETED: "Completed"
};

const CANCELLABLE_STATUSES = new Set([
    BOOKING_STATUSES.PENDING,
    BOOKING_STATUSES.CONFIRMED
]);

const BOOKED_STATUSES = [
    BOOKING_STATUSES.PENDING,
    BOOKING_STATUSES.CONFIRMED,
    BOOKING_STATUSES.COMPLETED
];
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const PAST_SLOT_BOOKING_MESSAGE = 'Selected time slot has already passed. Please choose an upcoming time slot';

const toObjectIdString = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
    return String(value);
};

const normalizeDiningCategories = (restaurant = {}) => {
    const categories = [];
    const seen = new Set();

    const addCategory = (value) => {
        const normalized = String(value || '').trim();
        if (!normalized) return;
        const key = normalized.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        categories.push(normalized);
    };

    if (Array.isArray(restaurant?.diningCategories)) {
        restaurant.diningCategories.forEach(addCategory);
    }
    addCategory(restaurant?.diningCategory);

    if (Array.isArray(restaurant?.cuisines) && restaurant.cuisines.length > 0) {
        addCategory(restaurant.cuisines[0]);
    }

    return categories;
};

const parseBookingTime = (timeValue = '') => {
    const raw = String(timeValue || '').trim();
    if (!raw) return { hours: 0, minutes: 0 };

    const match = raw.match(/^(\d{1,2})(?:\s*:\s*(\d{1,2}))?\s*(AM|PM)?$/i);
    if (!match) return { hours: 0, minutes: 0 };

    let hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const meridian = String(match[3] || '').toUpperCase();

    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;

    return {
        hours: Number.isFinite(hours) ? hours : 0,
        minutes: Number.isFinite(minutes) ? Math.min(Math.max(minutes, 0), 59) : 0
    };
};

const parseBookingDateTime = (dateValue, timeValue, referenceDate = new Date()) => {
    if (!dateValue) return null;

    const dateText = String(dateValue).trim();
    if (!dateText) return null;

    const now = new Date(referenceDate);
    const base = new Date(now);
    base.setHours(0, 0, 0, 0);

    let parsedDate = null;

    if (/^today$/i.test(dateText)) {
        parsedDate = new Date(base);
    } else if (/^tomorrow$/i.test(dateText)) {
        parsedDate = new Date(base);
        parsedDate.setDate(parsedDate.getDate() + 1);
    } else {
        const withYear = new Date(`${dateText} ${base.getFullYear()}`);
        if (!Number.isNaN(withYear.getTime())) {
            parsedDate = withYear;
        } else {
            const fallback = new Date(dateText);
            if (!Number.isNaN(fallback.getTime())) {
                parsedDate = fallback;
            }
        }
    }

    if (!parsedDate || Number.isNaN(parsedDate.getTime())) return null;

    const { hours, minutes } = parseBookingTime(timeValue);
    parsedDate.setHours(hours, minutes, 0, 0);

    return parsedDate;
};

const isPastBookingSlot = (dateValue, timeValue) => {
    const bookingDateTime = parseBookingDateTime(dateValue, timeValue);
    if (!bookingDateTime) return true;
    return bookingDateTime.getTime() <= Date.now();
};

const notifyRestaurantForDiningBooking = async (booking, notification = {}) => {
    if (!booking?.restaurantId) return;

    const title = String(notification?.title || 'Dining booking update');
    const message = String(notification?.message || '');
    const event = String(notification?.event || 'DINING_BOOKING_UPDATE');

    try {
        await RestaurantNotification.create({
            restaurant: booking.restaurantId,
            title,
            message,
            type: 'alert'
        });
    } catch (notificationError) {
        console.error('Failed to create dining booking notification:', notificationError);
    }

    try {
        await notifyRestaurantFCM(
            booking.restaurantId,
            title,
            message,
            {
                event,
                bookingId: String(booking._id || ''),
                status: String(booking.bookingStatus || ''),
                screen: 'table_bookings'
            }
        );
    } catch (pushError) {
        console.error('Failed to send dining booking push notification:', pushError);
    }
};

const notifyRestaurantForPendingDiningBooking = async (booking) => {
    const guestName = String(booking.guestName || 'A customer');
    const guestsCount = Number(booking.guests || 0);
    const title = 'New dining booking request';
    const message = `${guestName} requested table ${booking.tableNumber} on ${booking.date} at ${booking.time} for ${guestsCount} guest${guestsCount === 1 ? '' : 's'}.`;
    await notifyRestaurantForDiningBooking(booking, {
        title,
        message,
        event: 'DINING_BOOKING_REQUEST'
    });
};

const notifyRestaurantForConfirmedDiningBooking = async (booking) => {
    const guestName = String(booking.guestName || 'A customer');
    const guestsCount = Number(booking.guests || 0);
    const title = 'New confirmed dining booking';
    const message = `${guestName} booked table ${booking.tableNumber} on ${booking.date} at ${booking.time} for ${guestsCount} guest${guestsCount === 1 ? '' : 's'}.`;
    await notifyRestaurantForDiningBooking(booking, {
        title,
        message,
        event: 'DINING_BOOKING_CONFIRMED'
    });
};

const getDiningEnabledRestaurant = async (restaurantId) => {
    if (!restaurantId) return null;
    return Restaurant.findById(restaurantId).select('diningEnabled diningPlatformFee name');
};

const resolveBookableTable = async (restaurantId, { tableId, tableNumber, guests } = {}) => {
    const trimmedTableNumber = String(tableNumber || '').trim();

    if (!tableId && !trimmedTableNumber) {
        return {
            ok: false,
            statusCode: 400,
            message: 'tableId or tableNumber is required'
        };
    }

    let table = null;

    if (tableId) {
        table = await DiningTable.findOne({
            _id: tableId,
            restaurantId,
            status: 'Active'
        });
    } else if (trimmedTableNumber) {
        table = await DiningTable.findOne({
            tableNumber: trimmedTableNumber,
            restaurantId,
            status: 'Active'
        });
    }

    if (!table) {
        return {
            ok: false,
            statusCode: 400,
            message: 'Selected table is not available for booking'
        };
    }

    if (trimmedTableNumber && String(table.tableNumber || '').trim() !== trimmedTableNumber) {
        return {
            ok: false,
            statusCode: 400,
            message: 'Selected table details are invalid'
        };
    }

    let normalizedGuests = null;
    if (guests !== undefined && guests !== null && guests !== '') {
        normalizedGuests = Number(guests);
        if (!Number.isFinite(normalizedGuests) || normalizedGuests <= 0) {
            return {
                ok: false,
                statusCode: 400,
                message: 'Guests must be a valid number greater than 0'
            };
        }

        if (Number(table.capacity) > 0 && normalizedGuests > Number(table.capacity)) {
            return {
                ok: false,
                statusCode: 400,
                message: `Selected table can seat up to ${table.capacity} guests only`
            };
        }
    }

    return {
        ok: true,
        table,
        tableId: table._id,
        tableNumber: String(table.tableNumber || '').trim(),
        guests: normalizedGuests
    };
};

// Get all dining restaurants (with filtering)
export const getRestaurants = async (req, res) => {
    try {
        const { city } = req.query;
        let query = { diningEnabled: true };

        // Simple filter support
        if (city) {
            query.$or = [
                { 'location.city': { $regex: city, $options: 'i' } },
                { 'location.area': { $regex: city, $options: 'i' } },
                { 'location.formattedAddress': { $regex: city, $options: 'i' } },
                { 'zone': { $regex: city, $options: 'i' } },
                { 'location.city': { $exists: false } },
                { 'location.city': '' },
                { 'location.city': null },
                { location: { $exists: false } },
                { location: null }
            ];
        }

        const rawRestaurants = await Restaurant.find(query);
        const restaurants = rawRestaurants.map((r) => {
            const diningCategories = normalizeDiningCategories(r);

            return {
                id: r._id,
                _id: r._id,
                name: r.name,
                rating: r.rating || 0,
                totalRatings: r.totalRatings || 0,
                location: r.location?.city || r.zone || '',
                distance: r.distance || '1.2 km',
                cuisine: diningCategories[0] || '',
                diningCategories,
                price: r.priceRange || '$$',
                priceRange: r.priceRange || '$$',
                image: r.profileImage?.url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop',
                profileImage: r.profileImage || null,
                offer: r.offer || '',
                deliveryTime: r.estimatedDeliveryTime || '30-45 mins',
                deliveryTimings: r.deliveryTimings || null,
                featuredDish: r.featuredDish || '',
                featuredPrice: r.featuredPrice || 0,
                slug: r.slug,
                coordinates: r.location ? { latitude: r.location.latitude, longitude: r.location.longitude } : null,
                isPopular: r.rating >= 4,
                diningEnabled: r.diningEnabled === true,
                diningGuests: r.diningGuests || 6,
                diningSlots: r.diningSlots || { lunch: [], dinner: [] }
            };
        }).filter((restaurant) => restaurant.diningEnabled === true);

        res.status(200).json({
            success: true,
            count: restaurants.length,
            data: restaurants
        });
    } catch (error) {
        console.error("Error fetching dining enabled restaurants:", error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get single restaurant by slug
export const getRestaurantBySlug = async (req, res) => {
    try {
        const r = await Restaurant.findOne({ slug: req.params.slug, diningEnabled: true });

        if (!r) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found'
            });
        }

        const diningCategories = normalizeDiningCategories(r);
        const mappedRestaurant = {
            id: r._id,
            _id: r._id,
            name: r.name,
            rating: r.rating || 0,
            totalRatings: r.totalRatings || 0,
            location: r.location?.city || r.zone || '',
            distance: r.distance || '1.2 km',
            cuisine: diningCategories[0] || '',
            diningCategories,
            price: r.priceRange || '$$',
            priceRange: r.priceRange || '$$',
            image: r.profileImage?.url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop',
            profileImage: r.profileImage || null,
            offer: r.offer || '',
            deliveryTime: r.estimatedDeliveryTime || '30-45 mins',
            deliveryTimings: r.deliveryTimings || null,
            featuredDish: r.featuredDish || '',
            featuredPrice: r.featuredPrice || 0,
            slug: r.slug,
            coordinates: r.location ? { latitude: r.location.latitude, longitude: r.location.longitude } : null,
            isPopular: r.rating >= 4,
            diningEnabled: r.diningEnabled || false,
            diningGuests: r.diningGuests || 6,
            diningSlots: r.diningSlots || { lunch: [], dinner: [] }
        };

        res.status(200).json({
            success: true,
            data: mappedRestaurant
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get dining categories
export const getCategories = async (req, res) => {
    try {
        const categories = await DiningCategory.find({ isActive: true }).sort({ order: 1 });
        res.status(200).json({
            success: true,
            count: categories.length,
            data: categories
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get limelight features
export const getLimelight = async (req, res) => {
    try {
        const limelights = await DiningLimelight.find({ isActive: true }).sort({ order: 1 });
        res.status(200).json({
            success: true,
            count: limelights.length,
            data: limelights
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get bank offers
export const getBankOffers = async (req, res) => {
    try {
        const offers = await DiningBankOffer.find({ isActive: true });
        res.status(200).json({
            success: true,
            count: offers.length,
            data: offers
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get must tries
export const getMustTries = async (req, res) => {
    try {
        const mustTries = await DiningMustTry.find({ isActive: true }).sort({ order: 1 });
        res.status(200).json({
            success: true,
            count: mustTries.length,
            data: mustTries
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get offer banners
export const getOfferBanners = async (req, res) => {
    try {
        const banners = await DiningOfferBanner.find({ isActive: true }).populate('restaurant', 'name').sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: banners.length,
            data: banners
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get dining stories
export const getStories = async (req, res) => {
    try {
        const stories = await DiningStory.find({ isActive: true }).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: stories.length,
            data: stories
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get available tables for a restaurant with booking logic
export const getAvailableTables = async (req, res) => {
    try {
        const { id } = req.params;
        const { date, time, guests } = req.query;

        if (date && time && isPastBookingSlot(date, time)) {
            return res.status(400).json({
                success: false,
                message: PAST_SLOT_BOOKING_MESSAGE
            });
        }

        // Find active tables
        const tables = await DiningTable.find({
            restaurantId: id,
            status: "Active"
        }).sort({ capacity: 1 });

        // Find existing bookings for this restaurant on the requested date and time
        const existingBookings = await DiningBooking.find({
            restaurantId: id,
            date,
            time,
            bookingStatus: { $in: BOOKED_STATUSES }
        });

        const bookedTableNumbers = existingBookings.map(b => b.tableNumber);

        // Map tables and mark if booked or unavailable
        const result = tables.map(table => ({
            id: table._id,
            tableNumber: table.tableNumber,
            capacity: table.capacity,
            isAvailable: !bookedTableNumbers.includes(table.tableNumber),
            isCapacityMatch: guests ? table.capacity >= Number(guests) : true
        }));

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Create a new booking
export const createBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { tableId, tableNumber, guests, date, time, customerDetails } = req.body;
        const userId = req.user?._id || req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required for dining booking'
            });
        }

        if (isPastBookingSlot(date, time)) {
            return res.status(400).json({
                success: false,
                message: PAST_SLOT_BOOKING_MESSAGE
            });
        }

        if (!date || !time) {
            return res.status(400).json({
                success: false,
                message: 'Booking date and time are required'
            });
        }

        const restaurant = await getDiningEnabledRestaurant(id);
        if (!restaurant || !restaurant.diningEnabled) {
            return res.status(400).json({
                success: false,
                message: 'Dining is not enabled for this restaurant'
            });
        }

        if (guests === undefined || guests === null || String(guests).trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Guests count is required'
            });
        }

        const tableResolution = await resolveBookableTable(id, { tableId, tableNumber, guests });
        if (!tableResolution.ok) {
            return res.status(tableResolution.statusCode).json({
                success: false,
                message: tableResolution.message
            });
        }

        // Check if already booked to prevent race condition
        const existingBooking = await DiningBooking.findOne({
            restaurantId: id,
            tableNumber: tableResolution.tableNumber,
            date,
            time,
            bookingStatus: { $in: BOOKED_STATUSES }
        });

        if (existingBooking) {
            return res.status(400).json({
                success: false,
                message: 'Table already booked for this date and time'
            });
        }

        const newBooking = new DiningBooking({
            restaurantId: id,
            userId,
            tableId: tableResolution.tableId,
            tableNumber: tableResolution.tableNumber,
            guests: tableResolution.guests,
            date,
            time,
            guestName: customerDetails?.name || "Guest",
            guestPhone: customerDetails?.phone || "N/A",
            bookingStatus: BOOKING_STATUSES.PENDING
        });

        await newBooking.save();
        await notifyRestaurantForPendingDiningBooking(newBooking);
        await emitDiningBookingStatusUpdate(newBooking, '', 'user_request');

        res.status(201).json({
            success: true,
            message: "Table booking request sent successfully",
            data: newBooking
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Update booking status (Confirm/Reject)
export const updateBookingStatus = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { status } = req.body; // "Confirmed", "Rejected", etc.
        const restaurantId = req.restaurant?._id || req.restaurant?.id;

        if (!restaurantId) {
            return res.status(401).json({
                success: false,
                message: "Restaurant authentication required"
            });
        }

        if (!Object.values(BOOKING_STATUSES).includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking status"
            });
        }

        const booking = await DiningBooking.findById(bookingId);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        if (toObjectIdString(booking.restaurantId) !== toObjectIdString(restaurantId)) {
            return res.status(403).json({
                success: false,
                message: "You can only update bookings for your own restaurant"
            });
        }

        const currentStatus = String(booking.bookingStatus || '');

        const allowedTransitions = {
            [BOOKING_STATUSES.PENDING]: new Set([BOOKING_STATUSES.CONFIRMED, BOOKING_STATUSES.REJECTED]),
            [BOOKING_STATUSES.CONFIRMED]: new Set([BOOKING_STATUSES.COMPLETED]),
            [BOOKING_STATUSES.REJECTED]: new Set([]),
            [BOOKING_STATUSES.CANCELLED]: new Set([]),
            [BOOKING_STATUSES.COMPLETED]: new Set([])
        };

        if (currentStatus === status) {
            return res.status(200).json({
                success: true,
                message: `Booking status is already ${status}`,
                data: booking
            });
        }

        const nextAllowedStatuses = allowedTransitions[currentStatus] || new Set();
        if (!nextAllowedStatuses.has(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status transition from ${currentStatus} to ${status}`
            });
        }

        booking.bookingStatus = status;
        booking.statusUpdatedAt = new Date();
        booking.statusUpdatedByRole = "restaurant";
        booking.statusUpdatedBy = restaurantId;

        await booking.save();
        await emitDiningBookingStatusUpdate(booking, currentStatus, 'restaurant_action');

        res.status(200).json({
            success: true,
            message: `Booking status updated to ${status}`,
            data: booking
        });
    } catch (error) {
        console.error("Error updating booking status:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

// Get the restaurant's platform fee
export const getPlatformFee = async (req, res) => {
    try {
        const { id } = req.params;
        const restaurant = await Restaurant.findById(id);

        if (!restaurant) {
            return res.status(404).json({ success: false, message: 'Restaurant not found' });
        }

        const platformFee = restaurant.diningPlatformFee?.isActive ? restaurant.diningPlatformFee.amount : 0;

        res.status(200).json({
            success: true,
            data: { platformFee }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Initiate booking payment (Step 1)
export const initiateBookingPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { tableId, tableNumber, date, time } = req.body;

        if (isPastBookingSlot(date, time)) {
            return res.status(400).json({
                success: false,
                message: PAST_SLOT_BOOKING_MESSAGE
            });
        }

        if (!date || !time) {
            return res.status(400).json({
                success: false,
                message: 'Booking date and time are required'
            });
        }

        const restaurant = await getDiningEnabledRestaurant(id);
        if (!restaurant || !restaurant.diningEnabled) {
            return res.status(400).json({
                success: false,
                message: 'Dining is not enabled for this restaurant'
            });
        }

        const tableResolution = await resolveBookableTable(id, { tableId, tableNumber });
        if (!tableResolution.ok) {
            return res.status(tableResolution.statusCode).json({
                success: false,
                message: tableResolution.message
            });
        }

        // Check if table is available
        const existingBooking = await DiningBooking.findOne({
            restaurantId: id,
            tableNumber: tableResolution.tableNumber,
            date,
            time,
            bookingStatus: { $in: BOOKED_STATUSES }
        });

        if (existingBooking) {
            return res.status(400).json({
                success: false,
                message: 'Table already booked for this date and time'
            });
        }

        const platformFeeAmount = restaurant.diningPlatformFee?.isActive ? restaurant.diningPlatformFee.amount : 0;

        if (platformFeeAmount <= 0) {
            return res.status(400).json({ success: false, message: 'No platform fee configured for this restaurant' });
        }

        // Create Razorpay Order
        const orderOptions = {
            amount: platformFeeAmount * 100, // Amount in paise
            currency: "INR",
            receipt: `dpf_${id.substring(18)}_${Date.now().toString().substring(5)}`
        };

        const order = await createOrder(orderOptions);

        res.status(200).json({
            success: true,
            data: {
                orderId: order.id,
                amount: platformFeeAmount,
                currency: "INR"
            }
        });

    } catch (error) {
        console.error("Error initiating dining payment:", error);
        res.status(500).json({
            success: false,
            message: 'Failed to initiate payment',
            error: error.message
        });
    }
};

// Verify payment and create booking (Step 2)
export const verifyAndCreateBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?._id || req.user?.id;
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            bookingDetails
        } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required for dining booking'
            });
        }

        if (isPastBookingSlot(bookingDetails?.date, bookingDetails?.time)) {
            return res.status(400).json({
                success: false,
                message: PAST_SLOT_BOOKING_MESSAGE
            });
        }

        if (!bookingDetails?.date || !bookingDetails?.time) {
            return res.status(400).json({
                success: false,
                message: 'Booking date and time are required'
            });
        }

        if (
            bookingDetails?.guests === undefined ||
            bookingDetails?.guests === null ||
            String(bookingDetails?.guests).trim() === ''
        ) {
            return res.status(400).json({
                success: false,
                message: 'Guests count is required'
            });
        }

        const restaurant = await getDiningEnabledRestaurant(id);
        if (!restaurant || !restaurant.diningEnabled) {
            return res.status(400).json({
                success: false,
                message: 'Dining is not enabled for this restaurant'
            });
        }

        const tableResolution = await resolveBookableTable(id, {
            tableId: bookingDetails?.tableId,
            tableNumber: bookingDetails?.tableNumber,
            guests: bookingDetails?.guests
        });
        if (!tableResolution.ok) {
            return res.status(tableResolution.statusCode).json({
                success: false,
                message: tableResolution.message
            });
        }

        // Verify Signature
        const isValid = await verifyPayment(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        );

        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }

        // Double check table availability
        const existingBooking = await DiningBooking.findOne({
            restaurantId: id,
            tableNumber: tableResolution.tableNumber,
            date: bookingDetails.date,
            time: bookingDetails.time,
            bookingStatus: { $in: ["Pending", "Confirmed", "Completed"] }
        });

        if (existingBooking) {
            // In a real app, we would process a refund here
            return res.status(400).json({
                success: false,
                message: 'Table got booked while processing payment. Please contact support.'
            });
        }

        const platformFeeAmount = restaurant?.diningPlatformFee?.isActive ? restaurant.diningPlatformFee.amount : 0;

        // Create Booking
        const newBooking = new DiningBooking({
            restaurantId: id,
            userId,
            tableId: tableResolution.tableId,
            tableNumber: tableResolution.tableNumber,
            guests: tableResolution.guests,
            date: bookingDetails.date,
            time: bookingDetails.time,
            guestName: bookingDetails.customerDetails?.name || "Guest",
            guestPhone: bookingDetails.customerDetails?.phone || "N/A",

            // Payment fields
            diningPlatformFee: platformFeeAmount,
            paymentStatus: "Completed",
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            bookingStatus: "Confirmed" // Auto confirm since paid
        });

        await newBooking.save();
        await notifyRestaurantForConfirmedDiningBooking(newBooking);
        await emitDiningBookingStatusUpdate(newBooking, '', 'payment_auto_confirm');

        res.status(201).json({
            success: true,
            data: newBooking
        });

    } catch (error) {
        console.error("Error verifying payment and creating booking:", error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get bookings for a specific restaurant
export const getRestaurantBookings = async (req, res) => {
    try {
        const { id } = req.params;
        const restaurantId = req.restaurant?._id || req.restaurant?.id;

        if (!restaurantId) {
            return res.status(401).json({
                success: false,
                message: 'Restaurant authentication required'
            });
        }

        if (toObjectIdString(restaurantId) !== toObjectIdString(id)) {
            return res.status(403).json({
                success: false,
                message: 'You can only access your own restaurant bookings'
            });
        }

        const bookings = await DiningBooking.find({ restaurantId: id })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: bookings
        });
    } catch (error) {
        console.error("Error fetching restaurant bookings:", error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get a single booking for logged-in user
export const getUserBookingById = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const userId = req.user?._id || req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const booking = await DiningBooking.findOne({
            _id: bookingId,
            userId
        }).populate('restaurantId', 'name profileImage slug');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: booking
        });
    } catch (error) {
        console.error("Error fetching user booking details:", error);
        return res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Cancel booking by logged-in user
export const cancelUserBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { reason = '' } = req.body || {};
        const userId = req.user?._id || req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const booking = await DiningBooking.findOne({
            _id: bookingId,
            userId
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        if (!CANCELLABLE_STATUSES.has(booking.bookingStatus)) {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel a ${booking.bookingStatus} booking`
            });
        }

        const bookingDateTime = parseBookingDateTime(booking.date, booking.time);
        if (!bookingDateTime) {
            return res.status(400).json({
                success: false,
                message: 'Unable to validate booking time for cancellation'
            });
        }

        const remainingMs = bookingDateTime.getTime() - Date.now();
        if (remainingMs <= FOUR_HOURS_MS) {
            return res.status(400).json({
                success: false,
                message: 'Booking can only be cancelled more than 4 hours before booking time'
            });
        }

        const previousStatus = String(booking.bookingStatus || '');
        booking.bookingStatus = BOOKING_STATUSES.CANCELLED;
        booking.statusUpdatedAt = new Date();
        booking.statusUpdatedByRole = "user";
        booking.statusUpdatedBy = userId;
        booking.cancellationReason = reason || '';

        await booking.save();
        await emitDiningBookingStatusUpdate(booking, previousStatus, 'user_cancel');

        return res.status(200).json({
            success: true,
            message: 'Booking cancelled successfully',
            data: booking
        });
    } catch (error) {
        console.error("Error cancelling user booking:", error);
        return res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get bookings for logged-in user
export const getUserBookings = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const bookings = await DiningBooking.find({ userId })
            .populate('restaurantId', 'name profileImage slug')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: bookings
        });
    } catch (error) {
        console.error("Error fetching user dining bookings:", error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get all bookings (for Admin)
export const getAllBookings = async (req, res) => {
    try {
        const bookings = await DiningBooking.find()
            .populate('restaurantId', 'name')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: bookings
        });
    } catch (error) {
        console.error("Error fetching all bookings:", error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};
