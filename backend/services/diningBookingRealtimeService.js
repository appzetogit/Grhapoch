import mongoose from 'mongoose';

let getIO = null;

async function getIOInstance() {
  if (!getIO) {
    const serverModule = await import('../server.js');
    getIO = serverModule.getIO;
  }
  return getIO ? getIO() : null;
}

const normalizeObjectId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  return String(value);
};

/**
 * Broadcast dining booking status updates to both restaurant and user listeners.
 * This keeps Home/Bookings views in sync without waiting for polling.
 */
export async function emitDiningBookingStatusUpdate(booking, previousStatus = '', source = 'system') {
  try {
    const io = await getIOInstance();
    if (!io || !booking) return;

    const restaurantId = normalizeObjectId(booking.restaurantId);
    const userId = normalizeObjectId(booking.userId);
    const bookingId = normalizeObjectId(booking._id || booking.id);
    const currentStatus = String(booking.bookingStatus || '');

    const payload = {
      bookingId,
      restaurantId,
      userId,
      previousStatus: String(previousStatus || ''),
      bookingStatus: currentStatus,
      source,
      updatedAt: new Date().toISOString()
    };

    // Restaurant namespace rooms
    const restaurantNamespace = io.of('/restaurant');
    const restaurantRooms = [
      `restaurant:${restaurantId}`,
      ...(mongoose.Types.ObjectId.isValid(restaurantId)
        ? [`restaurant:${new mongoose.Types.ObjectId(restaurantId).toString()}`]
        : [])
    ];
    restaurantRooms.forEach((room) => {
      restaurantNamespace.to(room).emit('dining_booking_status_update', payload);
    });

    // Global IO room for user listeners
    if (userId) {
      io.to(`user:${userId}`).emit('dining_booking_status_update', payload);
    }
  } catch (error) {
    console.error('Error emitting dining booking realtime update:', error);
  }
}

