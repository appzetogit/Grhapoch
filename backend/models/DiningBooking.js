import mongoose from "mongoose";

const diningBookingSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        guestName: {
            type: String,
        },
        guestPhone: {
            type: String,
        },
        tableId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DiningTable",
        },
        tableNumber: {
            type: String,
            required: true,
        },
        guests: {
            type: Number,
            required: true,
        },
        date: {
            type: String,
            required: true,
        },
        time: {
            type: String,
            required: true,
        },
        bookingStatus: {
            type: String,
            enum: ["Pending", "Confirmed", "Rejected", "Cancelled", "Completed"],
            default: "Pending",
        },
        diningPlatformFee: {
            type: Number,
            default: 0,
            min: 0
        },
        paymentStatus: {
            type: String,
            enum: ["Pending", "Completed", "Failed", "Refunded", ""],
            default: ""
        },
        razorpayOrderId: {
            type: String,
            default: "",
            trim: true
        },
        razorpayPaymentId: {
            type: String,
            default: "",
            trim: true
        },
        cancellationReason: {
            type: String,
            default: "",
            trim: true
        },
        statusUpdatedAt: {
            type: Date,
            default: null
        },
        statusUpdatedByRole: {
            type: String,
            enum: ["user", "restaurant", "admin", "system", ""],
            default: ""
        },
        statusUpdatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        }
    },
    { timestamps: true }
);

export default mongoose.model("DiningBooking", diningBookingSchema);
