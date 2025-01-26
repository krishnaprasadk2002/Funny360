const mongoose = require("mongoose");

const directorInviteSchema = new mongoose.Schema({
  name: { type: String, required: true },
   email: { type: String, required: true}, 
   classOfShares: { type: String, required: true }, 
   noOfShares: { type: Number, required: true, min: 1 }, 
   userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
   companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Companyaccount', required: true }, 
 }, { timestamps: true });

module.exports = mongoose.model("DirectorInvite", directorInviteSchema);
