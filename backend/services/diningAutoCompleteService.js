import DiningBooking from '../models/DiningBooking.js';
import { emitDiningBookingStatusUpdate } from './diningBookingRealtimeService.js';

const DEFAULT_AUTO_COMPLETE_MINUTES = 30;

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

const getAutoCompleteAfterMinutes = () => {
  const raw = Number(process.env.DINING_AUTO_COMPLETE_AFTER_MINUTES);
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_AUTO_COMPLETE_MINUTES;
  return raw;
};

export const processDiningAutoCompletions = async () => {
  const now = new Date();
  const autoCompleteAfterMinutes = getAutoCompleteAfterMinutes();
  const thresholdMs = autoCompleteAfterMinutes * 60 * 1000;

  const candidates = await DiningBooking.find({ bookingStatus: 'Confirmed' }).limit(500);
  let autoCompletedCount = 0;

  for (const booking of candidates) {
    const bookingDateTime = parseBookingDateTime(booking.date, booking.time, now);
    if (!bookingDateTime) continue;

    const eligibleAt = bookingDateTime.getTime() + thresholdMs;
    if (Date.now() < eligibleAt) continue;

    const previousStatus = booking.bookingStatus;
    booking.bookingStatus = 'Completed';
    booking.statusUpdatedAt = new Date();
    booking.statusUpdatedByRole = 'system';
    booking.statusUpdatedBy = null;
    await booking.save();

    await emitDiningBookingStatusUpdate(booking, previousStatus, 'auto_complete');
    autoCompletedCount += 1;
  }

  return {
    scanned: candidates.length,
    autoCompletedCount,
    autoCompleteAfterMinutes
  };
};

