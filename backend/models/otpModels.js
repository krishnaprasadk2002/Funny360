const mongoose = require("mongoose");

const userOtpVerificationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 58,
  },
});

const userOtpVerification = mongoose.model(
  "UserOtpVerification",
  userOtpVerificationSchema
);

module.exports = userOtpVerification;
