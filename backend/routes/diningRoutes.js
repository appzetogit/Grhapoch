import express from 'express';
import {
    getRestaurants,
    getRestaurantBySlug,
    getCategories,
    getLimelight,
    getBankOffers,
    getMustTries,
    getOfferBanners,
    getStories,
    getAvailableTables,
    createBooking,
    getPlatformFee,
    initiateBookingPayment,
    verifyAndCreateBooking,
    getRestaurantBookings,
    getAllBookings,
    updateBookingStatus,
    getUserBookings,
    getUserBookingById,
    cancelUserBooking
} from '../controllers/diningController.js';
import { authenticate } from '../middleware/auth.js';
import { authenticate as authenticateRestaurant } from '../middleware/restaurant.auth.js';
import { authenticateAdmin } from '../middleware/admin.auth.js';

const router = express.Router();

router.get('/bookings/all', authenticateAdmin, getAllBookings); // For Admin
router.get('/restaurants/:id/bookings', authenticateRestaurant, getRestaurantBookings); // For Restaurant
router.get('/bookings/user', authenticate, getUserBookings); // For logged-in User
router.get('/bookings/:bookingId', authenticate, getUserBookingById); // Booking details for user
router.patch('/bookings/:bookingId/cancel', authenticate, cancelUserBooking); // User cancel booking
router.patch('/bookings/:bookingId/status', authenticateRestaurant, updateBookingStatus); // Restaurant update status

router.get('/restaurants/:id/tables', getAvailableTables);
router.get('/restaurants/:id/platform-fee', getPlatformFee);
router.post('/restaurants/:id/bookings', authenticate, createBooking);
router.post('/restaurants/:id/bookings/initiate-payment', authenticate, initiateBookingPayment);
router.post('/restaurants/:id/bookings/verify-and-create', authenticate, verifyAndCreateBooking);

router.get('/restaurants', getRestaurants);
router.get('/restaurants/:slug', getRestaurantBySlug);
router.get('/categories', getCategories);
router.get('/limelight', getLimelight);
router.get('/bank-offers', getBankOffers);
router.get('/must-tries', getMustTries);
router.get('/offer-banners', getOfferBanners);
router.get('/stories', getStories);

export default router;
