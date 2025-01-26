const mongoose = require("mongoose");

const directorSchema = new mongoose.Schema(
  {
    surname: { type: String, required: true },
    name: { type: String, required: true },
    idNo: { type: String, required: true, unique: true },
    idProof: { type: String, required: true },
    type: { type: String, required: true },
    address: { type: String, required: true },
    addressProof: { type: String, required: true },
    email: { type: String, required: true,unique:true},
    phone: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "CompanyAccount", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Director", directorSchema);
