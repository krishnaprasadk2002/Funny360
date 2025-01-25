const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Capital Schema Definition
const capitalSchema = new Schema({
  total_share: { type: Number, required: true },
  amount_share: { type: Number, required: true },
  total_capital_subscribed: { type: Number, required: true },
  unpaid_amount: { type: Number, required: true },
  share_class: { type: String, required: true },
  share_right: { type: String, required: true },
});

// Company Account Schema Definition
const companyAccountSchema = new Schema(
  {
    business_name: { type: String },
    trading_name: { type: String },
    business_name_chinese: { type: String },
    type_of_business: { type: String },
    office_address: { type: String },
    office_address1: { type: String },
    office_city: { type: String },
    office_country: { type: String },
    office_state: { type: String },
    email_id: { type: String },
    mobile_number: { type: String },
    fax: { type: String },
    reference_no: { type: String },
    company_logo: { type: Object },
    total_share: { type: Number },
    amount_share: { type: Number },
    company_number: { type: String },
    br_number: { type: String },
    incorporate_date: { type: String },
    financial_date: { type: String },
    country: { type: String },
    userid: { type: Schema.Types.ObjectId, ref: "User" },
    active: { type: String, default: "0" },
    start_date: { type: String },
    end_date: { type: String },
    share_class: { type: Object },
    share_right: { type: String },
    capital: { type: capitalSchema},
  },
  { timestamps: true }
);

const Companyaccount = mongoose.model("Companyaccount", companyAccountSchema);
exports.Companyaccount = Companyaccount;

const workflowSchema = new Schema(
  {
    userid: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    companyid: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Companyaccount",
    },
    message: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Workflow = mongoose.model("Workflow", workflowSchema);
exports.Workflow = Workflow;

const shareholderCapitalSchema = new Schema(
  {
    userid: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    companyid: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Companyaccount",
    },
    capital: {
      type: capitalSchema,
      required: true,
    },
  },
  { timestamps: true }
);

const Shareholdercapital = mongoose.model(
  "Shareholdercapital",
  shareholderCapitalSchema
);

exports.Shareholdercapital = Shareholdercapital;
