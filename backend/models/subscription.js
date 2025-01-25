const joi = require("joi");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

var subscriptionschema = mongoose.Schema(
  {
    userid: {
      type: Schema.Types.ObjectId,
      require: true,
      ref: "User",
    },
    companyid: {
      type: Schema.Types.ObjectId,
      require: true,
      ref: "Companyaccount",
    },
    start_date: {
      type: Date,
      require: true,
    },
    subscriptions_amount: {
      type: String,
      require: true,
    },
    end_date: {
      type: Date,
      require: true,
    },
    type: {
      type: String,
      require: true,
    },
    status: {
      type: String,
      require: true,
      default: "0",
    },
  },
  { timestamps: true }
);
const Subscription = mongoose.model("Subscription", subscriptionschema);

exports.Subscription = Subscription;

var subscribersubscriptionschema = mongoose.Schema(
  {
    userid: {
      type: Schema.Types.ObjectId,
      require: true,
      ref: "User",
    },
    companyid: [
      {
        type: Schema.Types.ObjectId,
        require: true,
        ref: "Companyaccount",
      },
    ],
    subscription_id: [
      {
        type: Schema.Types.ObjectId,
        require: true,
        ref: "Subscription",
      },
    ],
    subscriptions_amount: {
      type: String,
      require: true,
    },
    status: {
      type: String,
      require: true,
      default: "0",
    },
  },
  { timestamps: true }
);
const SubscriberSubscription = mongoose.model(
  "SubscriberSubscription",
  subscribersubscriptionschema
);

exports.SubscriberSubscription = SubscriberSubscription;
