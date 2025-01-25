const joi = require("joi");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

var userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    roles: {
      type: String,
      required: true,
      enum: ["Shareholder", "Director", "Company Secretary", "Employee"],
    },
    typeofuser: {
      type: String,
    },
    namechinese: {
      type: String,
    },
    surname: {
      type: String,
    },
    other_name: {
      type: String,
    },
    previous_name: {
      type: String,
    },
    company_number: {
      type: String,
    },

    mobile_number: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    is_Verified: {
      type: Boolean,
      default: false,
    },
    firstperson: {
      type: String,
      required: true,
      default: "0",
    },
    companyid: [
      {
        type: Schema.Types.ObjectId,
        required: false,
        ref: "Companyaccount",
      },
    ],

    corporate_name: {
      type: String,
    },

    coporate_address: {
      type: String,
    },
    corporate_email: {
      type: String,
    },

    identityno: {
      type: String,
    },
    passport_no: {
      type: String,
    },
    address_proof: {
      type: String,
    },
    identity_card: {
      type: String,
    },

    office_address: {
      type: String,
      // required: true, // Removed required
    },
    office_address1: {
      type: String,
      // required: true, // Removed required
    },
    office_city: {
      type: String,
      // required: true, // Removed required
    },
    office_country: {
      type: String,
      // required: true, // Removed required
    },
    office_state: {
      type: String,
      // required: true, // Removed required
    },
    number_of_share: {
      type: String,
    },
    job_title: {
      type: String,
    },
    status: {
      type: String,
      required: true,
      default: "0",
    },
    active: {
      type: String,
      required: true,
      default: "0",
    },
    company_info_esign: {
      type: String,
      required: true,
      default: "0",
    },
    esignforcompanyinfo: {
      type: String,
      // required: true, // Removed required
    },
    gsignforcompanyinfo: {
      type: String,
      // required: true, // Removed required
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

/*Login history */

var loginhistoryschema = mongoose.Schema(
  {
    userid: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
  },
  { timestamps: true }
);

const Loginuser = mongoose.model("Loginuser", loginhistoryschema);

/*Activity history */

var activityhistoryschema = mongoose.Schema(
  {
    userid: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    companyid: {
      type: Schema.Types.ObjectId,
      ref: "Companyaccount",
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Activity = mongoose.model("Activity", activityhistoryschema);

function Validateuser(user) {
  const schema = {
    name: joi.string().required(),
    roles: joi.String().required(),
    email: joi.String().required(),
    password: joi.String().required(),
  };
  return joi.validate(user, schema);
}

function Validatelogin(user) {
  const Schema = {
    email: joi.String().min(5).max(250).required(),
    password: joi.String().min(5).max(1024).required(),
  };
  return joi.validate(user, Schema);
}

// Validation for user registration
function ValidateRegister(user) {
  const schema = joi.object({
    // Ensure you use joi with a capital 'J'
    name: joi.string().required().messages({
      "any.required": "Name is required.",
      "string.empty": "Name cannot be empty.",
    }),
    roles: joi
      .string()
      .valid("Shareholder", "Director", "Company Secretary", "Employee")
      .required()
      .messages({
        "any.required": "Role is required.",
        "string.empty": "Role cannot be empty.",
        "any.only":
          "Role must be one of Shareholder, Director, Company Secretary, or Employee.",
      }),
    mobile: joi.string().required().messages({
      "any.required": "Mobile number is required.",
      "string.empty": "Mobile number cannot be empty.",
    }),
    email: joi.string().email().required().messages({
      "any.required": "Email is required.",
      "string.empty": "Email cannot be empty.",
      "string.email": "Email must be a valid email address.",
    }),
    password: joi.string().min(6).required().messages({
      "any.required": "Password is required.",
      "string.empty": "Password cannot be empty.",
      "string.min": "Password must be at least 6 characters long.",
    }),
    office_address: joi.string().optional(),
    office_address1: joi.string().optional(),
    office_city: joi.string().optional(),
    office_country: joi.string().optional(),
    office_state: joi.string().optional(),
    esignforcompanyinfo: joi.string().optional(),
    gsignforcompanyinfo: joi.string().optional(),
  });
  return schema.validate(user, { abortEarly: false });
}

/*Login history */

var esignschema = mongoose.Schema(
  {
    userid: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    company_id: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Companyaccount",
    },
    esignforcompanyinfo: {
      type: String,
      required: true,
    },
    gsignforcompanyinfo: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Esign = mongoose.model("Esign", esignschema);

exports.User = User;
exports.Loginuser = Loginuser;
exports.Esign = Esign;
exports.Activity = Activity;
exports.Validate = Validateuser;
exports.Validatelogin = Validatelogin;
exports.ValidateRegister = ValidateRegister;
