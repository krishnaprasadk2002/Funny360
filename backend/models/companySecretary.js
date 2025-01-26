const mongoose = require("mongoose");

const companySecretarySchema = new mongoose.Schema({
  tcspLicenseNo: { type: String, required: true },
  tcspReason: { type: String, required: true },
  type: { type: String, required: true }, 
  surname: { type: String, required: true },
  name: { type: String, required: true },
  idProof: { type: String, required: true },
  address: { type: String, required: true },
  addressProof: { type: String, required: true },
  email: { type: String, required: true, unique: true }, 
  phone: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, 
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Companyaccount" } 
}, { timestamps: true });

module.exports = mongoose.model("CompanySecretary", companySecretarySchema);
