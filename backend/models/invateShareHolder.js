// models/InviteShareholder.js
const mongoose = require('mongoose');

const InviteShareholderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true }, 
  classOfShares: { type: String, required: true }, 
  noOfShares: { type: Number, required: true, min: 1 }, 
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Companyaccount', required: true }, 
}, { timestamps: true });

module.exports = mongoose.model('InviteShareholder', InviteShareholderSchema);
