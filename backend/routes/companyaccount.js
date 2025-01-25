const express = require("express");
require("dotenv").config({ path: __dirname + "/.env" });
const router = express.Router();
var mongoose = require("mongoose");
const {
  Companyaccount,
  Workflow,
  Shareholdercapital,
  validateCompanyInfo,
} = require("../models/companyaccount");
const {
  Subscription,
  SubscriberSubscription,
} = require("../models/subscription");
const auth = require("../middleware/Auth");
const { date } = require("joi");
const { documentsetting } = require("../models/documentsetting");
const { User } = require("../models/user");
var nodemailer = require("nodemailer");
const multer = require("multer");
const path = require("path");
const uploadCloudinary = require("../configs/couldinary");
const { authenticateToken } = require("../middleware/accessToken");
const { ShareholderInfo } = require("../models/shareHoldersInfo");
var liveurlnew = "./uploads";
// var liveurlnew="../newcomsec/src/assets";
var storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "company_logo") {
      // cb(null, "../Frontend/assets/company_logo");
      cb(null, liveurlnew + "/company_logo"); //localhost
    }
  },
  filename: (req, file, cb) => {
    if (file != "") {
      cb(
        null,
        file.fieldname + "-" + Date.now() + path.extname(file.originalname)
      );
    }
  },
});
const upload = multer({ storage: storage });

// creating company info
router.post("/submitCompanyInfo", async (req, res) => {
  try {
    let companyLogoUrl = "";
    if (req.body.companyLogo) {
      companyLogoUrl = await uploadCloudinary(req.body.companyLogo);
    }

    const companyInfo = new Companyaccount({
      business_name: req.body.companyNameEN,
      trading_name: req.body.companyNameCN,
      business_name_chinese: req.body.companyNameCN,
      type_of_business: req.body.companyType,
      office_address: req.body.Flat_Address,
      office_address1: req.body.Building_Address,
      office_city: req.body.District_Address,
      office_country: req.body.country_Address,
      office_state: req.body.country_Address,
      email_id: req.body.company_Email,
      mobile_number: req.body.company_Telphone,
      fax: req.body.company_Fax,
      reference_no: req.body.presentorReferance,
      company_logo: companyLogoUrl,
    });

    const savedCompanyInfo = await companyInfo.save();

    res.status(201).json({
      message: "Company information submitted successfully!",
      companyId: savedCompanyInfo._id,
    });
  } catch (err) {
    console.error("Error submitting company information:", err);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
});


router.post("/creationOfShare", async (req, res) => {
  try {
    console.log("Inside the share creation");

    const {
      companyId: companyid,
      userid,
      total_shares_proposed: total_share,
      unit_price: amount_share,
      total_capital_subscribed,
      unpaid_amount,
      class_of_shares: share_class,
      particulars_of_rights: share_right,
    } = req.body;

    console.log("Received data:", {
      companyid,
      userid,
      total_share,
      amount_share,
      share_class,
      share_right,
      total_capital_subscribed,
      unpaid_amount,
    });

    if (!companyid || !userid || !total_share || !amount_share || !share_class || !share_right || total_capital_subscribed === undefined || unpaid_amount === undefined) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const numericTotalShare = parseInt(total_share, 10);
    const numericAmountShare = parseFloat(amount_share);

    const newShare = new Shareholdercapital({
      userid,
      companyid,
      capital: {
        total_share: numericTotalShare,
        amount_share: numericAmountShare,
        total_capital_subscribed,
        unpaid_amount,
        share_class,
        share_right,
      },
    });

    await newShare.save();

    await Companyaccount.findByIdAndUpdate(companyid, {
      $inc: { total_share: numericTotalShare },
    });

    res.status(201).json({ message: "Share created successfully!" });
  } catch (error) {
    console.error("Error creating share:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});




// create shareHoldersInfo
router.post("/shareHoldersInfo", async (req, res) => {
  try {
    const {
      surname,
      name,
      idNo,
      idProof,
      userType,
      address,
      addressProof,
      email,
      phone,
      shareDetailsNoOfShares,
      shareDetailsClassOfShares,
      userId, 
      companyId 
    } = req.body;

    console.log('Received data:', req.body);

    if (!surname || !name || !idNo || !idProof || !userType || !address || !addressProof || !email || !phone || !shareDetailsNoOfShares || !shareDetailsClassOfShares || !userId || !companyId) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const idProofUrl = await uploadCloudinary(idProof);
    const addressProofUrl = await uploadCloudinary(addressProof);

    const newShareholderInfo = new ShareholderInfo({
      surname,
      name,
      idNo,
      idProof: idProofUrl, 
      userType,
      address,
      addressProof: addressProofUrl, 
      email,
      phone,
      shareDetailsNoOfShares,
      shareDetailsClassOfShares,
      userId: mongoose.Types.ObjectId(userId), 
      companyId: mongoose.Types.ObjectId(companyId)
    });

    await newShareholderInfo.save();

    res.status(201).json({ message: "Shareholder info created successfully!" });
  } catch (error) {
    console.error("Error creating shareholder info:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});


router.get("/getShareCapitalList", async (req, res) => {
  try {
    const { companyId, userId } = req.query; 
    console.log((req.query));
    

    if (!companyId || !userId) {
      return res.status(400).json({ message: "Company ID and User ID are required." });
    }

    const shareCapitalList = await Shareholdercapital.find({
      companyid: companyId,
      userid: userId
    })
    .populate("companyid", "companyName");

    console.log('share capital list',shareCapitalList);
    

    if (shareCapitalList.length === 0) {
      return res.status(404).json({ message: "No share capital found." });
    }

    res.status(200).json({
      message: "Share capital list fetched successfully.",
      data: shareCapitalList,
    });
  } catch (error) {
    console.error("Error fetching share capital list:", error);
    res.status(500).json({ message: "Server error while fetching share capital list." });
  }
});

// Route to get the list of shareholders with populated data
router.get("/getShareHoldersList", async (req, res) => {
  const { companyId, userId } = req.query;
  try {
    const shareholders = await ShareholderInfo.find({ companyId, userId })
      .populate("userId") 
      .populate("companyId");

      console.log('getting shareholders',shareholders);
      
    res.status(200).json({ message: "Shareholders fetched successfully", data: shareholders });
  } catch (error) {
    console.error("Error fetching shareholders list:", error);
    res.status(400).json({ message: "Failed to fetch shareholders list", error });
  }
});






// ------------- create--------------------

// router.post("/create", async (req, res) => {
//   try {
//     const data = req.body;

//     Companyaccount.create(data)
//     .then((user) => {
//       return res.status(201).json({
//         status: "201",
//         message: "Company created successfully!",
//         data: data,
//       });
//     })
//     .catch((error) => {
//       console.error("Error saving user: ", error);
//       return res.status(500).json({
//         status: "500",
//         message: "Error saving user.",
//       });
//     });
//   } catch (error) {
//     // Handle errors
//     console.error("Error creating user:", error);
//     res.status(500).json({
//       message: "Error creating user",
//       error: error.message,
//     });
//   }
// });
// -------------

router.post("/getactiveaccountbyuserid", async (req, res) => {
  let data;
  if (req.body.active != "") {
    data = {
      userid: mongoose.Types.ObjectId(req.body.userid),
      active: req.body.active,
    };
  } else {
    data = { userid: mongoose.Types.ObjectId(req.body.userid) };
  }
  Companyaccount.aggregate(
    [
      { $match: data },

      {
        $lookup: {
          localField: "_id",
          from: "users",
          foreignField: "companyid",
          as: "usersinfo",
        },
      },
      {
        $lookup: {
          localField: "_id",
          from: "subscriptions",
          foreignField: "companyid",
          as: "subscriptionsinfo",
        },
      },

      { $sort: { _id: -1 } },
    ],
    (err, result) => {
      res.status(200).json({
        status: "200",
        message: "Result Found",
        result: result,
      });
    }
  );
});

router.post("/getsharecpitalbyuseridandcompanyid", auth, async (req, res) => {
  let data;
  if (req.body.userid != "" && req.body.companyid != "") {
    data = {
      userid: mongoose.Types.ObjectId(req.body.userid),
      companyid: mongoose.Types.ObjectId(req.body.companyid),
    };
  }
  Shareholdercapital.aggregate(
    [
      { $match: data },

      {
        $lookup: {
          localField: "_id",
          from: "users",
          foreignField: "companyid",
          as: "usersinfo",
        },
      },
      {
        $lookup: {
          localField: "_id",
          from: "subscriptions",
          foreignField: "companyid",
          as: "subscriptionsinfo",
        },
      },

      { $sort: { _id: -1 } },
    ],
    (err, result) => {
      res.status(200).json({
        status: "200",
        message: "Result Found",
        result: result,
      });
    }
  );
});

// router.post("/getactiveaccountbyuserid", auth, async function (req, res) {
//   let data;
//   if (req.body.active != "") {
//     data = {
//       userid: mongoose.Types.ObjectId(req.body.userid),
//       active: req.body.active,
//     };
//   } else {
//     data = { userid: mongoose.Types.ObjectId(req.body.userid) };
//   }
//   Companyaccount.find(data).populate('userid').exec(async (err, result) => {
//     if (err) {
//       res.status(200).json({
//         status: "400",
//         message: "Something Went Wrong",
//       });
//     }
//     if (!result) {
//       res.status(200).json({
//         status: "400",
//         message: "No Result Found",
//       });
//     } else {
//       res.status(200).json({
//         status: "200",
//         message: "Result Found",
//         result: result,
//       });
//     }
//   }).sort({ active: -1 });
// });

router.post(
  "/getallcompanyaccountbysubscriberid",
  auth,
  async function (req, res) {
    let data;
    if (req.body.active != "") {
      data = {
        userid: mongoose.Types.ObjectId(req.body.userid),
        active: req.body.active,
      };
    } else {
      data = { userid: mongoose.Types.ObjectId(req.body.userid) };
    }

    Companyaccount.aggregate(
      [
        { $match: data },

        {
          $lookup: {
            localField: "_id",
            from: "subscriptions",
            foreignField: "companyid",
            as: "subscriptioninfo",
          },
        },
        { $unwind: "$subscriptioninfo" },
        // { "$project": {
        //   "business_name": 1,
        //   "active": 1,
        //   "subscriptioninfo": 1,
        // } },
        {
          $group: {
            _id: "$subscriptioninfo.companyid",
            subscriptioninfo: { $last: "$subscriptioninfo" },
            business_name: { $last: "$business_name" },
          },
        },
        { $sort: { _id: -1 } },
      ],
      (err, result) => {
        res.status(200).json({
          status: "200",
          message: "Result Found",
          result: result,
        });
      }
    );

    // Companyaccount.find(data).exec((err, ids) => {
    //   Subscription.find({'_id':{$in : ids._id}},function(err,result) {
    //     console.log(result);
    //     res.status(200).json({
    //       status: "200",
    //       message: "Result Found",
    //       result: result,
    //     });
    //   });
    // });
  }
);

router.post("/getsubscriptionbycompanyid", auth, async function (req, res) {
  let data;

  if (req.body.companyid == "" || req.body.companyid == undefined) {
    console.log("muskan gupta");

    data = {};
  } else {
    data = {
      companyid: mongoose.Types.ObjectId(req.body.companyid),
    };
  }

  Subscription.aggregate([
    { $match: data },
    {
      $lookup: {
        from: "companyaccounts",
        localField: "companyid",
        foreignField: "_id",
        as: "companyinfo",
      },
    },
  ])
    .sort({ companyid: -1 }, { _id: -1 })
    .then((result, err) => {
      if (err) {
        res.status(200).json({
          status: "400",
          message: "Something Went Wrong",
        });
      }
      if (result.length > 0) {
        res.status(200).json({
          status: "200",
          message: "Result Found",
          result: result,
        });
      } else {
        res.status(200).json({
          status: "400",
          message: "No Result Found",
        });
      }
    })
    .catch((err) => {
      res.send(err);
    });
});

router.post(
  "/getsubscribersubscriptionbyuserid",
  auth,
  async function (req, res) {
    let data;

    if (req.body.userid == "" || req.body.userid == undefined) {
      console.log("muskan gupta");

      data = {};
    } else {
      data = {
        userid: mongoose.Types.ObjectId(req.body.userid),
      };
    }

    SubscriberSubscription.aggregate([
      { $match: data },
      {
        $lookup: {
          from: "companyaccounts",
          localField: "companyid",
          foreignField: "_id",
          as: "companyinfo",
        },
      },
    ])
      .sort({ createdAt: -1 }, { _id: -1 })
      .then((result, err) => {
        if (err) {
          res.status(200).json({
            status: "400",
            message: "Something Went Wrong",
          });
        }
        if (result.length > 0) {
          res.status(200).json({
            status: "200",
            message: "Result Found",
            result: result,
          });
        } else {
          res.status(200).json({
            status: "400",
            message: "No Result Found",
          });
        }
      })
      .catch((err) => {
        res.send(err);
      });
  }
);

router.post("/getsubscribersubscriptionbyid", auth, async function (req, res) {
  let data;

  if (req.body.id == "" || req.body.id == undefined) {
    data = {};
  } else {
    data = {
      _id: mongoose.Types.ObjectId(req.body.id),
    };
  }

  SubscriberSubscription.aggregate([
    { $match: data },
    {
      $lookup: {
        from: "companyaccounts",
        localField: "companyid",
        foreignField: "_id",
        as: "companyinfo",
      },
    },
  ])
    .sort({ createdAt: -1 }, { _id: -1 })
    .then((result, err) => {
      if (err) {
        res.status(200).json({
          status: "400",
          message: "Something Went Wrong",
        });
      }
      if (result.length > 0) {
        res.status(200).json({
          status: "200",
          message: "Result Found",
          result: result,
        });
      } else {
        res.status(200).json({
          status: "400",
          message: "No Result Found",
        });
      }
    })
    .catch((err) => {
      res.send(err);
    });
});

router.post("/getcompanybyid", auth, async function (req, res) {
  let data;

  data = {
    _id: mongoose.Types.ObjectId(req.body.companyid),
  };

  Companyaccount.find(data, (err, result) => {
    if (err) {
      res.status(200).json({
        status: "400",
        message: "Something Went Wrong",
      });
    }
    if (!result) {
      res.status(200).json({
        status: "400",
        message: "No Result Found",
      });
    } else {
      res.status(200).json({
        status: "200",
        message: "Result Found",
        result: result,
      });
    }
  }).sort({ _id: -1 });
});

router.post("/getcompanybymultipleid", async function (req, res) {
  let data;
  let array = [];
  for (k = 0; k < req.body.companyid.length; k++) {
    array.push(mongoose.Types.ObjectId(req.body.companyid[k]));
  }
  data = {
    _id: { $in: array },
  };

  Companyaccount.aggregate(
    [
      { $match: data },

      {
        $lookup: {
          localField: "_id",
          from: "users",
          foreignField: "companyid",
          as: "usersinfo",
        },
      },
      {
        $lookup: {
          localField: "_id",
          from: "subscriptions",
          foreignField: "companyid",
          as: "subscriptionsinfo",
        },
      },
      // { $unwind: "$usersinfo" },
      // { "$project": {
      //   "business_name": 1,
      //   "active": 1,
      //   "subscriptioninfo": 1,
      // } },
      // {
      //   $group: {
      //     _id: {_id},
      //     usersinfo: {usersinfo},
      //     business_name: {$business_name},
      //     trading_name: {$trading_name},
      //     incorporate_date: {$incorporate_date},
      //     financial_date: {$financial_date},
      //     company_number: {$company_number},
      //     br_number: {$br_number},
      //     related_company: {$related_company},
      //   },
      // },
      { $sort: { _id: -1 } },
    ],
    (err, result) => {
      res.status(200).json({
        status: "200",
        message: "Result Found",
        result: result,
      });
    }
  );
  // Companyaccount.find(data, (err, result) => {
  //   if (err) {
  //     res.status(200).json({
  //       status: "400",
  //       message: "Something Went Wrong",
  //     });
  //   }
  //   if (!result) {
  //     res.status(200).json({
  //       status: "400",
  //       message: "No Result Found",
  //     });
  //   } else {
  //     res.status(200).json({
  //       status: "200",
  //       message: "Result Found",
  //       result: result,
  //     });
  //   }
  // }).sort({ _id: -1 });
});

router.post("/getlastsubscriptionbycompanyid", auth, async function (req, res) {
  let data;

  data = {
    companyid: mongoose.Types.ObjectId(req.body.companyid),
  };

  Subscription.find(data, (err, result) => {
    if (err) {
      res.status(200).json({
        status: "400",
        message: "Something Went Wrong",
      });
    }
    if (!result) {
      res.status(200).json({
        status: "400",
        message: "No Result Found",
      });
    } else {
      res.status(200).json({
        status: "200",
        message: "Result Found",
        result: result,
      });
    }
  })
    .sort({ _id: -1 })
    .limit(1);
});

router.post("/getsubscriptionbyid", auth, async function (req, res) {
  let data;

  data = {
    _id: mongoose.Types.ObjectId(req.body.id),
  };

  Subscription.find(data, (err, result) => {
    if (err) {
      res.status(200).json({
        status: "400",
        message: "Something Went Wrong",
      });
    }
    if (!result) {
      res.status(200).json({
        status: "400",
        message: "No Result Found",
      });
    } else {
      res.status(200).json({
        status: "200",
        message: "Result Found",
        result: result,
      });
    }
  }).sort({ _id: -1 });
});

function formatDate(date) {
  var d = new Date(date),
    month = "" + (d.getMonth() + 1),
    day = "" + d.getDate(),
    year = d.getFullYear();

  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;
  return [year, month, day].join("-");
}

router.post("/addcompanyaccount", auth, async (req, res) => {
  let api_url = process.env.APP_URL;
  let liveAPP_URL = process.env.liveAPP_URL;
  if (req.body.business_name != "" && req.body.type_of_business != "") {
    let userdata = {
      business_name: req.body.business_name,
      business_name_chinese: req.body.business_name_chinese,
      type_of_business: req.body.type_of_business,
      office_address: req.body.office_address,
      office_address1: req.body.office_address1,
      office_city: req.body.office_city,
      office_state: req.body.office_state,
      office_country: req.body.office_country,
      // "share_class":req.body.share_class,
      // "total_share":req.body.total_share,
      // "total_amount":req.body.total_amount,
      capital: req.body.capital,
      share_right: req.body.share_right,
      country: req.body.country,
      userid: req.body.userid,
      active: req.body.active,
      application_date: req.body.application_date,
    };
    Companyaccount.findOne(
      { business_name: req.body.business_name },
      async (err, result) => {
        if (err) {
          res.status(200).json({
            status: "400",
            msg: "Something Went Wrong",
          });
        }
        if (!result) {
          let userresult = Companyaccount(userdata);
          let resultusernew = await userresult.save();

          if (resultusernew) {
            let end_date = new Date();
            end_date.setDate(end_date.getDate() + 13);
            let subscriptiondata = {
              companyid: mongoose.Types.ObjectId(resultusernew._id),
              end_date: formatDate(end_date),
              subscriptions_amount: "0",
              start_date: formatDate(new Date()),
              userid: mongoose.Types.ObjectId(req.body.userid),
              type: "trial",
            };
            let subscriptiondataresult = Subscription(subscriptiondata);
            let resultsubscriptiondata = await subscriptiondataresult.save();
            let newdata = 0;
            let userdata = {
              email_id: req.body.email_id,
              name: req.body.first_name,
              surname: req.body.last_name,
              mobile_number: req.body.mobile_number,
              companyid: mongoose.Types.ObjectId(resultusernew._id),
              roles: req.body.roles,
              typeofuser: "Natural Person",
              firstperson: "1",
              password: "",
            };
            User.findOne(
              { email_id: req.body.email_id },
              async (err, result) => {
                if (err) {
                  // res.status(200).json({
                  //   status: "400",
                  //   msg: "Something Went Wrong",
                  // });
                }
                if (!result) {
                  let userresult = User(userdata);
                  let resultuser = await userresult.save();

                  if (resultuser) {
                    if (req.body.roles != "Employee") {
                      if (req.body.roles == "shareholder") {
                        let newcapital = [];
                        for (
                          let capitalnew = 0;
                          capitalnew < req.body.capital.length;
                          capitalnew++
                        ) {
                          newcapital.push({
                            share_class:
                              req.body.capital[capitalnew].share_class,
                            total_share: "",
                            total_amount_paid: "",
                            currency: "HKD",
                          });
                        }

                        let shareholdercapital = {
                          companyid: mongoose.Types.ObjectId(resultusernew._id),
                          userid: mongoose.Types.ObjectId(resultshare._id),
                          capital: newcapital,
                        };
                        let shareholdercapitaldata =
                          Shareholdercapital(shareholdercapital);
                        let shareholdercapitalreponse =
                          await shareholdercapitaldata.save();
                      }
                      var transporter = nodemailer.createTransport({
                        host: "smtp.gmail.com",
                        port: 465,
                        secure: true,
                        auth: {
                          user: "vikas@synram.co",
                          pass: "Synram@2019",
                        },
                      });

                      var mailOptions = {
                        from: "vikas@synram.co",
                        to: req.body.email_id,
                        subject:
                          "" +
                          req.body.caname +
                          " has invited you to collaborate as a " +
                          req.body.roles +
                          "",
                        html:
                          "<!DOCTYPE html>" +
                          "<html><head>" +
                          "    <title>ComSec360 Invitation</title>" +
                          '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
                          "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
                          '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
                          '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
                          '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
                          '    <style type="text/css">' +
                          "     " +
                          "        /* CLIENT-SPECIFIC STYLES */" +
                          "        body," +
                          "        table," +
                          "        td," +
                          "        a {" +
                          "            -webkit-text-size-adjust: 100%;" +
                          "            -ms-text-size-adjust: 100%;" +
                          "        }" +
                          "" +
                          "        table," +
                          "        td {" +
                          "            mso-table-lspace: 0pt;" +
                          "            mso-table-rspace: 0pt;" +
                          "        }" +
                          "" +
                          "        img {" +
                          "            -ms-interpolation-mode: bicubic;" +
                          "        }" +
                          "" +
                          "        /* RESET STYLES */" +
                          "        img {" +
                          "            border: 0;" +
                          "            height: auto;" +
                          "            line-height: 100%;" +
                          "            outline: none;" +
                          "            text-decoration: none;" +
                          "        }" +
                          "" +
                          "        table {" +
                          "            border-collapse: collapse !important;" +
                          "        }" +
                          "" +
                          "        body {" +
                          "            height: 100% !important;" +
                          "            margin: 0 !important;" +
                          "            padding: 0 !important;" +
                          "            width: 100% !important;" +
                          "        }" +
                          "" +
                          "        /* iOS BLUE LINKS */" +
                          "        a[x-apple-data-detectors] {" +
                          "            color: inherit !important;" +
                          "            text-decoration: none !important;" +
                          "            font-size: inherit !important;" +
                          "            font-family: inherit !important;" +
                          "            font-weight: inherit !important;" +
                          "            line-height: inherit !important;" +
                          "        }" +
                          "" +
                          "        /* MOBILE STYLES */" +
                          "        @media screen and (max-width:600px) {" +
                          "            h1 {" +
                          "                font-size: 32px !important;" +
                          "                line-height: 32px !important;" +
                          "            }" +
                          "        }" +
                          "" +
                          "        /* ANDROID CENTER FIX */" +
                          '        div[style*="margin: 16px 0;"] {' +
                          "            margin: 0 !important;" +
                          "        }" +
                          "    </style>" +
                          "</head>" +
                          " <style>" +
                          " #para_text {" +
                          "  padding: 0px 20px;" +
                          "  color: #111111;" +
                          "  font-family: 'Raleway Light', Arial, sans-serif;" +
                          "  font-size: 1.5em;" +
                          "  text-align: center;" +
                          "}" +
                          "#grad1 {" +
                          "  background-color: #E5E5E5;" +
                          "}" +
                          "#link_social" +
                          "{" +
                          "	padding: 5px;" +
                          "	color: #666666;" +
                          "}" +
                          "</style>" +
                          '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
                          "    " +
                          '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                          "        <!-- LOGO -->" +
                          "        <tbody><tr>" +
                          "           " +
                          '<td align="center">' +
                          '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                          "                    <tbody><tr>" +
                          '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
                          "                    </tr>" +
                          "                </tbody></table>" +
                          "            </td>" +
                          "        </tr>" +
                          "        <tr>" +
                          '            <td align="center">' +
                          '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                          "                    <tbody><tr>" +
                          '                        <td style="padding: 30px;  " valign="top" align="center">' +
                          '                           <img style="max-width: 29%; max-height: 50%; " src="' +
                          api_url +
                          '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
                          "                        </td>" +
                          "                    </tr>" +
                          "                </tbody></table>" +
                          "            </td>" +
                          "        </tr>" +
                          "        " +
                          "		<!-- MESSAGE -->" +
                          "		<tr>" +
                          '        <td align="center">' +
                          '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                          "        <tbody>" +
                          "		<tr>" +
                          '            <td align="center">' +
                          '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                          "                    <tbody>" +
                          "					<tr>" +
                          '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
                          "                           <h1>CA " +
                          req.body.caname +
                          " has invited you to collaborate as a owner  in " +
                          liveAPP_URL +
                          "</h1>" +
                          "						   " +
                          "						" +
                          "						   " +
                          '							<a href="' +
                          api_url +
                          "/registeration/" +
                          resultuser._id +
                          '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">Accept Invitation</a>' +
                          '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
                          '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
                          liveAPP_URL +
                          "</p>" +
                          '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
                          req.body.email_id +
                          "</p>" +
                          "                        </td>" +
                          "" +
                          "                    </tr><tr><td><hr><td></tr>" +
                          "" +
                          "                </tbody></table>" +
                          "            </td>" +
                          "        </tr>" +
                          "		</tbody>" +
                          "		</table>" +
                          "        </td>" +
                          "        </tr>" +
                          "        <tr>" +
                          '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
                          '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                          "                <tbody>" +
                          "				" +
                          "					<tr>" +
                          '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
                          "				" +
                          "			" +
                          "				" +
                          "				<!-- COPYRIGHT TEXT -->" +
                          '					<p id="footer_text">' +
                          "If you have any questions you can get in touch at support.comsec360.com</p>" +
                          "					<p>© 2021 ComSec360</p>" +
                          "                    </td>" +
                          "                    </tr>" +
                          "				" +
                          "	" +
                          "                </tbody>" +
                          "				</table>" +
                          "            </td>" +
                          "        </tr>" +
                          "    </tbody></table>" +
                          "" +
                          "" +
                          "</body></html>",
                      };

                      transporter.sendMail(mailOptions, function (error, info) {
                        if (error) {
                          console.log("error" + error);
                        } else {
                          console.log("Email sent: " + info.response);
                        }
                      });
                    }

                    // res.status(200).json({
                    //   status: "200",
                    //   msg: "Successfully Invited",
                    //   result: resultuser,
                    // });
                  } else {
                    // res.status(200).json({
                    //   status: "400",
                    //   msg: "Something Went Wrong",
                    // });
                  }
                }
                if (result) {
                  console.log("email:" + result.companyid);
                  let companyid = result.companyid;
                  companyid.push(mongoose.Types.ObjectId(resultusernew._id));
                  User.updateOne(
                    { email_id: req.body.email_id },
                    {
                      $set: {
                        companyid: companyid,
                      },
                    },
                    (err, result) => {
                      if (err) {
                        // res.status(200).json({
                        //   status: "400",
                        //   msg: "Updation failed",
                        // });
                      } else {
                        // return res.status(200).json({
                        //   status: "200",
                        //   msg: "Sucessfully Updated",
                        // });
                      }
                    }
                  );

                  if (req.body.roles != "Employee") {
                    if (req.body.roles == "shareholder") {
                      let newcapital = [];
                      for (
                        let capitalnew = 0;
                        capitalnew < req.body.capital.length;
                        capitalnew++
                      ) {
                        newcapital.push({
                          share_class: req.body.capital[capitalnew].share_class,
                          total_share: "",
                          total_amount_paid: "",
                          currency: "HKD",
                        });
                      }

                      let shareholdercapital = {
                        companyid: mongoose.Types.ObjectId(resultusernew._id),
                        userid: mongoose.Types.ObjectId(resultshare._id),
                        capital: newcapital,
                      };
                      let shareholdercapitaldata =
                        Shareholdercapital(shareholdercapital);
                      let shareholdercapitalreponse =
                        await shareholdercapitaldata.save();
                    }
                    var transporter = nodemailer.createTransport({
                      host: "smtp.gmail.com",
                      port: 465,
                      secure: true,
                      auth: {
                        user: "vikas@synram.co",
                        pass: "Synram@2019",
                      },
                    });

                    var mailOptions = {
                      from: "vikas@synram.co",
                      to: req.body.email_id,
                      subject:
                        "" +
                        req.body.caname +
                        " has invited you to collaborate as a " +
                        req.body.roles +
                        "",
                      html:
                        "<!DOCTYPE html>" +
                        "<html><head>" +
                        "    <title>ComSec360 Invitation</title>" +
                        '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
                        "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
                        '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
                        '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
                        '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
                        '    <style type="text/css">' +
                        "     " +
                        "        /* CLIENT-SPECIFIC STYLES */" +
                        "        body," +
                        "        table," +
                        "        td," +
                        "        a {" +
                        "            -webkit-text-size-adjust: 100%;" +
                        "            -ms-text-size-adjust: 100%;" +
                        "        }" +
                        "" +
                        "        table," +
                        "        td {" +
                        "            mso-table-lspace: 0pt;" +
                        "            mso-table-rspace: 0pt;" +
                        "        }" +
                        "" +
                        "        img {" +
                        "            -ms-interpolation-mode: bicubic;" +
                        "        }" +
                        "" +
                        "        /* RESET STYLES */" +
                        "        img {" +
                        "            border: 0;" +
                        "            height: auto;" +
                        "            line-height: 100%;" +
                        "            outline: none;" +
                        "            text-decoration: none;" +
                        "        }" +
                        "" +
                        "        table {" +
                        "            border-collapse: collapse !important;" +
                        "        }" +
                        "" +
                        "        body {" +
                        "            height: 100% !important;" +
                        "            margin: 0 !important;" +
                        "            padding: 0 !important;" +
                        "            width: 100% !important;" +
                        "        }" +
                        "" +
                        "        /* iOS BLUE LINKS */" +
                        "        a[x-apple-data-detectors] {" +
                        "            color: inherit !important;" +
                        "            text-decoration: none !important;" +
                        "            font-size: inherit !important;" +
                        "            font-family: inherit !important;" +
                        "            font-weight: inherit !important;" +
                        "            line-height: inherit !important;" +
                        "        }" +
                        "" +
                        "        /* MOBILE STYLES */" +
                        "        @media screen and (max-width:600px) {" +
                        "            h1 {" +
                        "                font-size: 32px !important;" +
                        "                line-height: 32px !important;" +
                        "            }" +
                        "        }" +
                        "" +
                        "        /* ANDROID CENTER FIX */" +
                        '        div[style*="margin: 16px 0;"] {' +
                        "            margin: 0 !important;" +
                        "        }" +
                        "    </style>" +
                        "</head>" +
                        " <style>" +
                        " #para_text {" +
                        "  padding: 0px 20px;" +
                        "  color: #111111;" +
                        "  font-family: 'Raleway Light', Arial, sans-serif;" +
                        "  font-size: 1.5em;" +
                        "  text-align: center;" +
                        "}" +
                        "#grad1 {" +
                        "  background-color: #E5E5E5;" +
                        "}" +
                        "#link_social" +
                        "{" +
                        "	padding: 5px;" +
                        "	color: #666666;" +
                        "}" +
                        "</style>" +
                        '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
                        "    " +
                        '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                        "        <!-- LOGO -->" +
                        "        <tbody><tr>" +
                        "           " +
                        '<td align="center">' +
                        '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                        "                    <tbody><tr>" +
                        '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
                        "                    </tr>" +
                        "                </tbody></table>" +
                        "            </td>" +
                        "        </tr>" +
                        "        <tr>" +
                        '            <td align="center">' +
                        '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                        "                    <tbody><tr>" +
                        '                        <td style="padding: 30px;  " valign="top" align="center">' +
                        '                           <img style="max-width: 29%; max-height: 50%; " src="' +
                        api_url +
                        '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
                        "                        </td>" +
                        "                    </tr>" +
                        "                </tbody></table>" +
                        "            </td>" +
                        "        </tr>" +
                        "        " +
                        "		<!-- MESSAGE -->" +
                        "		<tr>" +
                        '        <td align="center">' +
                        '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                        "        <tbody>" +
                        "		<tr>" +
                        '            <td align="center">' +
                        '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                        "                    <tbody>" +
                        "					<tr>" +
                        '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
                        "                           <h1>CA " +
                        req.body.caname +
                        " has invited you to collaborate as a owner  in " +
                        liveAPP_URL +
                        "</h1>" +
                        "						   " +
                        "						" +
                        "						   " +
                        '							<a href="' +
                        api_url +
                        "/registeration/" +
                        resultuser._id +
                        '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">Accept Invitation</a>' +
                        '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
                        '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
                        liveAPP_URL +
                        "</p>" +
                        '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
                        req.body.email_id +
                        "</p>" +
                        "                        </td>" +
                        "" +
                        "                    </tr><tr><td><hr><td></tr>" +
                        "" +
                        "                </tbody></table>" +
                        "            </td>" +
                        "        </tr>" +
                        "		</tbody>" +
                        "		</table>" +
                        "        </td>" +
                        "        </tr>" +
                        "        <tr>" +
                        '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
                        '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                        "                <tbody>" +
                        "				" +
                        "					<tr>" +
                        '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
                        "				" +
                        "			" +
                        "				" +
                        "				<!-- COPYRIGHT TEXT -->" +
                        '					<p id="footer_text">' +
                        "If you have any questions you can get in touch at support.comsec360.com</p>" +
                        "					<p>© 2021 ComSec360</p>" +
                        "                    </td>" +
                        "                    </tr>" +
                        "				" +
                        "	" +
                        "                </tbody>" +
                        "				</table>" +
                        "            </td>" +
                        "        </tr>" +
                        "    </tbody></table>" +
                        "" +
                        "" +
                        "</body></html>",
                    };

                    transporter.sendMail(mailOptions, function (error, info) {
                      if (error) {
                        console.log("error" + error);
                      } else {
                        console.log("Email sent: " + info.response);
                      }
                    });
                  }

                  // res.status(200).json({
                  //   status: "400",
                  //   msg: "Email Id is already register",
                  // });
                }
              }
            );
            console.log(req.body.shareholder.length);

            for (let sh = 0; sh < req.body.shareholder.length; sh++) {
              if (
                req.body.shareholder[sh].shareemail_id != "" &&
                req.body.shareholder[sh].sharefirst_name != ""
              ) {
                let userdata = {
                  email_id: req.body.shareholder[sh].shareemail_id,
                  name: req.body.shareholder[sh].sharefirst_name,
                  surname: req.body.shareholder[sh].sharelast_name,
                  mobile_number: "",
                  companyid: mongoose.Types.ObjectId(resultusernew._id),
                  roles: "Shareholder",
                  typeofuser: "Natural Person",
                  firstperson: sh + 1,
                  password: "",
                };

                console.log(userdata);

                User.findOne(
                  { email_id: req.body.shareholder[sh].shareemail_id },
                  async (err, share) => {
                    if (err) {
                      // res.status(200).json({
                      //   status: "400",
                      //   msg: "Something Went Wrong",
                      // });
                    }
                    if (!share) {
                      let usershare = User(userdata);
                      let resultshare = await usershare.save();

                      if (resultshare) {
                        let newcapital = [];
                        for (
                          let capitalnew = 0;
                          capitalnew < req.body.capital.length;
                          capitalnew++
                        ) {
                          newcapital.push({
                            share_class:
                              req.body.capital[capitalnew].share_class,
                            total_share: "",
                            total_amount_paid: "",
                            currency: "HKD",
                          });
                        }

                        let shareholdercapital = {
                          companyid: mongoose.Types.ObjectId(resultusernew._id),
                          userid: mongoose.Types.ObjectId(resultshare._id),
                          capital: newcapital,
                        };
                        let shareholdercapitaldata =
                          Shareholdercapital(shareholdercapital);
                        let shareholdercapitalreponse =
                          await shareholdercapitaldata.save();

                        var transporter = nodemailer.createTransport({
                          host: "smtp.gmail.com",
                          port: 465,
                          secure: true,
                          auth: {
                            user: "vikas@synram.co",
                            pass: "Synram@2019",
                          },
                        });

                        var mailOptionsshare = {
                          from: "vikas@synram.co",
                          to: req.body.shareholder[sh].shareemail_id,
                          subject:
                            "" +
                            req.body.caname +
                            " has invited you to collaborate as a Shareholder ",
                          html:
                            "<!DOCTYPE html>" +
                            "<html><head>" +
                            "    <title>ComSec360 Invitation</title>" +
                            '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
                            "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
                            '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
                            '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
                            '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
                            '    <style type="text/css">' +
                            "     " +
                            "        /* CLIENT-SPECIFIC STYLES */" +
                            "        body," +
                            "        table," +
                            "        td," +
                            "        a {" +
                            "            -webkit-text-size-adjust: 100%;" +
                            "            -ms-text-size-adjust: 100%;" +
                            "        }" +
                            "" +
                            "        table," +
                            "        td {" +
                            "            mso-table-lspace: 0pt;" +
                            "            mso-table-rspace: 0pt;" +
                            "        }" +
                            "" +
                            "        img {" +
                            "            -ms-interpolation-mode: bicubic;" +
                            "        }" +
                            "" +
                            "        /* RESET STYLES */" +
                            "        img {" +
                            "            border: 0;" +
                            "            height: auto;" +
                            "            line-height: 100%;" +
                            "            outline: none;" +
                            "            text-decoration: none;" +
                            "        }" +
                            "" +
                            "        table {" +
                            "            border-collapse: collapse !important;" +
                            "        }" +
                            "" +
                            "        body {" +
                            "            height: 100% !important;" +
                            "            margin: 0 !important;" +
                            "            padding: 0 !important;" +
                            "            width: 100% !important;" +
                            "        }" +
                            "" +
                            "        /* iOS BLUE LINKS */" +
                            "        a[x-apple-data-detectors] {" +
                            "            color: inherit !important;" +
                            "            text-decoration: none !important;" +
                            "            font-size: inherit !important;" +
                            "            font-family: inherit !important;" +
                            "            font-weight: inherit !important;" +
                            "            line-height: inherit !important;" +
                            "        }" +
                            "" +
                            "        /* MOBILE STYLES */" +
                            "        @media screen and (max-width:600px) {" +
                            "            h1 {" +
                            "                font-size: 32px !important;" +
                            "                line-height: 32px !important;" +
                            "            }" +
                            "        }" +
                            "" +
                            "        /* ANDROID CENTER FIX */" +
                            '        div[style*="margin: 16px 0;"] {' +
                            "            margin: 0 !important;" +
                            "        }" +
                            "    </style>" +
                            "</head>" +
                            " <style>" +
                            " #para_text {" +
                            "  padding: 0px 20px;" +
                            "  color: #111111;" +
                            "  font-family: 'Raleway Light', Arial, sans-serif;" +
                            "  font-size: 1.5em;" +
                            "  text-align: center;" +
                            "}" +
                            "#grad1 {" +
                            "  background-color: #E5E5E5;" +
                            "}" +
                            "#link_social" +
                            "{" +
                            "	padding: 5px;" +
                            "	color: #666666;" +
                            "}" +
                            "</style>" +
                            '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
                            "    " +
                            '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "        <!-- LOGO -->" +
                            "        <tbody><tr>" +
                            "           " +
                            '<td align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                    <tbody><tr>" +
                            '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
                            "                    </tr>" +
                            "                </tbody></table>" +
                            "            </td>" +
                            "        </tr>" +
                            "        <tr>" +
                            '            <td align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                    <tbody><tr>" +
                            '                        <td style="padding: 30px;  " valign="top" align="center">' +
                            '                           <img style="max-width: 29%; max-height: 50%; " src="' +
                            api_url +
                            '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
                            "                        </td>" +
                            "                    </tr>" +
                            "                </tbody></table>" +
                            "            </td>" +
                            "        </tr>" +
                            "        " +
                            "		<!-- MESSAGE -->" +
                            "		<tr>" +
                            '        <td align="center">' +
                            '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "        <tbody>" +
                            "		<tr>" +
                            '            <td align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                    <tbody>" +
                            "					<tr>" +
                            '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
                            "                           <h1>CA " +
                            req.body.caname +
                            " has invited you to collaborate as a Shareholder in " +
                            liveAPP_URL +
                            "</h1>" +
                            "						   " +
                            "						" +
                            "						   " +
                            '							<a href="' +
                            api_url +
                            "/registeration/" +
                            resultshare._id +
                            '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">Accept Invitation</a>' +
                            '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
                            '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
                            liveAPP_URL +
                            "</p>" +
                            '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
                            req.body.shareholder[sh].shareemail_id +
                            "</p>" +
                            "                        </td>" +
                            "" +
                            "                    </tr><tr><td><hr><td></tr>" +
                            "" +
                            "                </tbody></table>" +
                            "            </td>" +
                            "        </tr>" +
                            "		</tbody>" +
                            "		</table>" +
                            "        </td>" +
                            "        </tr>" +
                            "        <tr>" +
                            '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                <tbody>" +
                            "				" +
                            "					<tr>" +
                            '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
                            "				" +
                            "			" +
                            "				" +
                            "				<!-- COPYRIGHT TEXT -->" +
                            '					<p id="footer_text">' +
                            "If you have any questions you can get in touch at support.comsec360.com</p>" +
                            "					<p>© 2021 ComSec360</p>" +
                            "                    </td>" +
                            "                    </tr>" +
                            "				" +
                            "	" +
                            "                </tbody>" +
                            "				</table>" +
                            "            </td>" +
                            "        </tr>" +
                            "    </tbody></table>" +
                            "" +
                            "" +
                            "</body></html>",
                        };

                        transporter.sendMail(
                          mailOptionsshare,
                          function (error, info) {
                            if (error) {
                              console.log("error" + error);
                            } else {
                              console.log("Email sent: " + info.response);
                            }
                          }
                        );
                        // res.status(200).json({
                        //   status: "200",
                        //   msg: "Successfully Added",
                        //   result: resultusernew,
                        // });
                        // res.status(200).json({
                        //   status: "200",
                        //   msg: "Successfully Invited",
                        //   result: resultuser,
                        // });
                      } else {
                        // res.status(200).json({
                        //   status: "400",
                        //   msg: "Something Went Wrong",
                        // });
                      }
                    }
                    if (share) {
                      let companyid = share.companyid;
                      if (companyid.includes(resultusernew._id)) {
                      } else {
                        companyid.push(
                          mongoose.Types.ObjectId(resultusernew._id)
                        );
                        User.updateOne(
                          { email_id: req.body.shareholder[sh].shareemail_id },
                          {
                            $set: {
                              companyid: companyid,
                            },
                          },
                          (err, result) => {
                            if (err) {
                              // res.status(200).json({
                              //   status: "400",
                              //   msg: "Updation failed",
                              // });
                            } else {
                              // return res.status(200).json({
                              //   status: "200",
                              //   msg: "Sucessfully Updated",
                              // });
                            }
                          }
                        );
                        let shareholdercapital = {
                          companyid: mongoose.Types.ObjectId(resultusernew._id),
                          userid: mongoose.Types.ObjectId(share._id),
                          capital: [
                            {
                              share_class: "Ordinary",
                              total_share: "",
                              total_amount_paid: "",
                              currency: "HKD",
                            },
                            {
                              share_class: "Preference",
                              total_share: "",
                              total_amount_paid: "",
                              currency: "HKD",
                            },
                          ],
                        };
                        let shareholdercapitaldata =
                          Shareholdercapital(shareholdercapital);
                        let shareholdercapitalreponse =
                          await shareholdercapitaldata.save();

                        var transporter = nodemailer.createTransport({
                          host: "smtp.gmail.com",
                          port: 465,
                          secure: true,
                          auth: {
                            user: "vikas@synram.co",
                            pass: "Synram@2019",
                          },
                        });

                        var mailOptionsshare = {
                          from: "vikas@synram.co",
                          to: req.body.shareholder[sh].shareemail_id,
                          subject:
                            "" +
                            req.body.caname +
                            " has invited you to collaborate as a Shareholder ",
                          html:
                            "<!DOCTYPE html>" +
                            "<html><head>" +
                            "    <title>ComSec360 Invitation</title>" +
                            '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
                            "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
                            '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
                            '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
                            '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
                            '    <style type="text/css">' +
                            "     " +
                            "        /* CLIENT-SPECIFIC STYLES */" +
                            "        body," +
                            "        table," +
                            "        td," +
                            "        a {" +
                            "            -webkit-text-size-adjust: 100%;" +
                            "            -ms-text-size-adjust: 100%;" +
                            "        }" +
                            "" +
                            "        table," +
                            "        td {" +
                            "            mso-table-lspace: 0pt;" +
                            "            mso-table-rspace: 0pt;" +
                            "        }" +
                            "" +
                            "        img {" +
                            "            -ms-interpolation-mode: bicubic;" +
                            "        }" +
                            "" +
                            "        /* RESET STYLES */" +
                            "        img {" +
                            "            border: 0;" +
                            "            height: auto;" +
                            "            line-height: 100%;" +
                            "            outline: none;" +
                            "            text-decoration: none;" +
                            "        }" +
                            "" +
                            "        table {" +
                            "            border-collapse: collapse !important;" +
                            "        }" +
                            "" +
                            "        body {" +
                            "            height: 100% !important;" +
                            "            margin: 0 !important;" +
                            "            padding: 0 !important;" +
                            "            width: 100% !important;" +
                            "        }" +
                            "" +
                            "        /* iOS BLUE LINKS */" +
                            "        a[x-apple-data-detectors] {" +
                            "            color: inherit !important;" +
                            "            text-decoration: none !important;" +
                            "            font-size: inherit !important;" +
                            "            font-family: inherit !important;" +
                            "            font-weight: inherit !important;" +
                            "            line-height: inherit !important;" +
                            "        }" +
                            "" +
                            "        /* MOBILE STYLES */" +
                            "        @media screen and (max-width:600px) {" +
                            "            h1 {" +
                            "                font-size: 32px !important;" +
                            "                line-height: 32px !important;" +
                            "            }" +
                            "        }" +
                            "" +
                            "        /* ANDROID CENTER FIX */" +
                            '        div[style*="margin: 16px 0;"] {' +
                            "            margin: 0 !important;" +
                            "        }" +
                            "    </style>" +
                            "</head>" +
                            " <style>" +
                            " #para_text {" +
                            "  padding: 0px 20px;" +
                            "  color: #111111;" +
                            "  font-family: 'Raleway Light', Arial, sans-serif;" +
                            "  font-size: 1.5em;" +
                            "  text-align: center;" +
                            "}" +
                            "#grad1 {" +
                            "  background-color: #E5E5E5;" +
                            "}" +
                            "#link_social" +
                            "{" +
                            "	padding: 5px;" +
                            "	color: #666666;" +
                            "}" +
                            "</style>" +
                            '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
                            "    " +
                            '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "        <!-- LOGO -->" +
                            "        <tbody><tr>" +
                            "           " +
                            '<td align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                    <tbody><tr>" +
                            '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
                            "                    </tr>" +
                            "                </tbody></table>" +
                            "            </td>" +
                            "        </tr>" +
                            "        <tr>" +
                            '            <td align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                    <tbody><tr>" +
                            '                        <td style="padding: 30px;  " valign="top" align="center">' +
                            '                           <img style="max-width: 29%; max-height: 50%; " src="' +
                            api_url +
                            '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
                            "                        </td>" +
                            "                    </tr>" +
                            "                </tbody></table>" +
                            "            </td>" +
                            "        </tr>" +
                            "        " +
                            "		<!-- MESSAGE -->" +
                            "		<tr>" +
                            '        <td align="center">' +
                            '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "        <tbody>" +
                            "		<tr>" +
                            '            <td align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                    <tbody>" +
                            "					<tr>" +
                            '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
                            "                           <h1>CA " +
                            req.body.caname +
                            " has invited you to collaborate as a Shareholder in " +
                            liveAPP_URL +
                            "</h1>" +
                            "						   " +
                            "						" +
                            "						   " +
                            '							<a href="' +
                            api_url +
                            "/registeration/" +
                            resultshare._id +
                            '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">Accept Invitation</a>' +
                            '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
                            '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
                            liveAPP_URL +
                            "</p>" +
                            '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
                            req.body.shareholder[sh].shareemail_id +
                            "</p>" +
                            "                        </td>" +
                            "" +
                            "                    </tr><tr><td><hr><td></tr>" +
                            "" +
                            "                </tbody></table>" +
                            "            </td>" +
                            "        </tr>" +
                            "		</tbody>" +
                            "		</table>" +
                            "        </td>" +
                            "        </tr>" +
                            "        <tr>" +
                            '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                <tbody>" +
                            "				" +
                            "					<tr>" +
                            '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
                            "				" +
                            "			" +
                            "				" +
                            "				<!-- COPYRIGHT TEXT -->" +
                            '					<p id="footer_text">' +
                            "If you have any questions you can get in touch at support.comsec360.com</p>" +
                            "					<p>© 2021 ComSec360</p>" +
                            "                    </td>" +
                            "                    </tr>" +
                            "				" +
                            "	" +
                            "                </tbody>" +
                            "				</table>" +
                            "            </td>" +
                            "        </tr>" +
                            "    </tbody></table>" +
                            "" +
                            "" +
                            "</body></html>",
                        };

                        transporter.sendMail(
                          mailOptionsshare,
                          function (error, info) {
                            if (error) {
                              console.log("error" + error);
                            } else {
                              console.log("Email sent: " + info.response);
                            }
                          }
                        );
                      }
                    }
                  }
                );
              }
            }

            for (let sh = 0; sh < req.body.director.length; sh++) {
              if (
                req.body.director[sh].directoremail_id != "" &&
                req.body.director[sh].directorfirst_name != ""
              ) {
                let userdata = {
                  email_id: req.body.director[sh].directoremail_id,
                  name: req.body.director[sh].directorfirst_name,
                  surname: req.body.director[sh].directorlast_name,
                  mobile_number: "",
                  companyid: mongoose.Types.ObjectId(resultusernew._id),
                  roles: "Director",
                  typeofuser: "Natural Person",
                  firstperson: sh + 1,
                  password: "",
                };
                User.findOne(
                  { email_id: req.body.director[sh].directoremail_id },
                  async (err, director) => {
                    if (err) {
                      // res.status(200).json({
                      //   status: "400",
                      //   msg: "Something Went Wrong",
                      // });
                    }
                    if (!director) {
                      let userdirector = User(userdata);
                      let resultdirector = await userdirector.save();

                      if (resultdirector) {
                        var transporter = nodemailer.createTransport({
                          host: "smtp.gmail.com",
                          port: 465,
                          secure: true,
                          auth: {
                            user: "vikas@synram.co",
                            pass: "Synram@2019",
                          },
                        });

                        var mailOptionsdirector = {
                          from: "vikas@synram.co",
                          to: req.body.director[sh].directoremail_id,
                          subject:
                            "" +
                            req.body.caname +
                            " has invited you to collaborate as a Director ",
                          html:
                            "<!DOCTYPE html>" +
                            "<html><head>" +
                            "    <title>ComSec360 Invitation</title>" +
                            '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
                            "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
                            '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
                            '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
                            '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
                            '    <style type="text/css">' +
                            "     " +
                            "        /* CLIENT-SPECIFIC STYLES */" +
                            "        body," +
                            "        table," +
                            "        td," +
                            "        a {" +
                            "            -webkit-text-size-adjust: 100%;" +
                            "            -ms-text-size-adjust: 100%;" +
                            "        }" +
                            "" +
                            "        table," +
                            "        td {" +
                            "            mso-table-lspace: 0pt;" +
                            "            mso-table-rspace: 0pt;" +
                            "        }" +
                            "" +
                            "        img {" +
                            "            -ms-interpolation-mode: bicubic;" +
                            "        }" +
                            "" +
                            "        /* RESET STYLES */" +
                            "        img {" +
                            "            border: 0;" +
                            "            height: auto;" +
                            "            line-height: 100%;" +
                            "            outline: none;" +
                            "            text-decoration: none;" +
                            "        }" +
                            "" +
                            "        table {" +
                            "            border-collapse: collapse !important;" +
                            "        }" +
                            "" +
                            "        body {" +
                            "            height: 100% !important;" +
                            "            margin: 0 !important;" +
                            "            padding: 0 !important;" +
                            "            width: 100% !important;" +
                            "        }" +
                            "" +
                            "        /* iOS BLUE LINKS */" +
                            "        a[x-apple-data-detectors] {" +
                            "            color: inherit !important;" +
                            "            text-decoration: none !important;" +
                            "            font-size: inherit !important;" +
                            "            font-family: inherit !important;" +
                            "            font-weight: inherit !important;" +
                            "            line-height: inherit !important;" +
                            "        }" +
                            "" +
                            "        /* MOBILE STYLES */" +
                            "        @media screen and (max-width:600px) {" +
                            "            h1 {" +
                            "                font-size: 32px !important;" +
                            "                line-height: 32px !important;" +
                            "            }" +
                            "        }" +
                            "" +
                            "        /* ANDROID CENTER FIX */" +
                            '        div[style*="margin: 16px 0;"] {' +
                            "            margin: 0 !important;" +
                            "        }" +
                            "    </style>" +
                            "</head>" +
                            " <style>" +
                            " #para_text {" +
                            "  padding: 0px 20px;" +
                            "  color: #111111;" +
                            "  font-family: 'Raleway Light', Arial, sans-serif;" +
                            "  font-size: 1.5em;" +
                            "  text-align: center;" +
                            "}" +
                            "#grad1 {" +
                            "  background-color: #E5E5E5;" +
                            "}" +
                            "#link_social" +
                            "{" +
                            "	padding: 5px;" +
                            "	color: #666666;" +
                            "}" +
                            "</style>" +
                            '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
                            "    " +
                            '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "        <!-- LOGO -->" +
                            "        <tbody><tr>" +
                            "           " +
                            '<td align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                    <tbody><tr>" +
                            '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
                            "                    </tr>" +
                            "                </tbody></table>" +
                            "            </td>" +
                            "        </tr>" +
                            "        <tr>" +
                            '            <td align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                    <tbody><tr>" +
                            '                        <td style="padding: 30px;  " valign="top" align="center">' +
                            '                           <img style="max-width: 29%; max-height: 50%; " src="' +
                            api_url +
                            '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
                            "                        </td>" +
                            "                    </tr>" +
                            "                </tbody></table>" +
                            "            </td>" +
                            "        </tr>" +
                            "        " +
                            "		<!-- MESSAGE -->" +
                            "		<tr>" +
                            '        <td align="center">' +
                            '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "        <tbody>" +
                            "		<tr>" +
                            '            <td align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                    <tbody>" +
                            "					<tr>" +
                            '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
                            "                           <h1>CA " +
                            req.body.caname +
                            " has invited you to collaborate as a Director in " +
                            liveAPP_URL +
                            "</h1>" +
                            "						   " +
                            "						" +
                            "						   " +
                            '							<a href="' +
                            api_url +
                            "/registeration/" +
                            resultdirector._id +
                            '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">Accept Invitation</a>' +
                            '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
                            '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
                            liveAPP_URL +
                            "</p>" +
                            '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
                            req.body.director[sh].directoremail_id +
                            "</p>" +
                            "                        </td>" +
                            "" +
                            "                    </tr><tr><td><hr><td></tr>" +
                            "" +
                            "                </tbody></table>" +
                            "            </td>" +
                            "        </tr>" +
                            "		</tbody>" +
                            "		</table>" +
                            "        </td>" +
                            "        </tr>" +
                            "        <tr>" +
                            '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                <tbody>" +
                            "				" +
                            "					<tr>" +
                            '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
                            "				" +
                            "			" +
                            "				" +
                            "				<!-- COPYRIGHT TEXT -->" +
                            '					<p id="footer_text">' +
                            "If you have any questions you can get in touch at support.comsec360.com</p>" +
                            "					<p>© 2021 ComSec360</p>" +
                            "                    </td>" +
                            "                    </tr>" +
                            "				" +
                            "	" +
                            "                </tbody>" +
                            "				</table>" +
                            "            </td>" +
                            "        </tr>" +
                            "    </tbody></table>" +
                            "" +
                            "" +
                            "</body></html>",
                        };

                        transporter.sendMail(
                          mailOptionsdirector,
                          function (error, info) {
                            if (error) {
                              console.log("error" + error);
                            } else {
                              console.log("Email sent: " + info.response);
                            }
                          }
                        );
                        // res.status(200).json({
                        //   status: "200",
                        //   msg: "Successfully Added",
                        //   result: resultusernew,
                        // });
                        // res.status(200).json({
                        //   status: "200",
                        //   msg: "Successfully Invited",
                        //   result: resultuser,
                        // });
                      } else {
                        res.status(200).json({
                          status: "400",
                          msg: "Something Went Wrong",
                        });
                      }
                    }
                    if (director) {
                      let companyid = director.companyid;
                      if (companyid.includes(resultusernew._id)) {
                      } else {
                        companyid.push(
                          mongoose.Types.ObjectId(resultusernew._id)
                        );

                        User.updateOne(
                          { email_id: req.body.director[sh].directoremail_id },
                          {
                            $set: {
                              companyid: companyid,
                            },
                          },
                          (err, result) => {
                            if (err) {
                              // res.status(200).json({
                              //   status: "400",
                              //   msg: "Updation failed",
                              // });
                            } else {
                              // return res.status(200).json({
                              //   status: "200",
                              //   msg: "Sucessfully Updated",
                              // });
                            }
                          }
                        );

                        var transporter = nodemailer.createTransport({
                          host: "smtp.gmail.com",
                          port: 465,
                          secure: true,
                          auth: {
                            user: "vikas@synram.co",
                            pass: "Synram@2019",
                          },
                        });

                        var mailOptionsdirector = {
                          from: "vikas@synram.co",
                          to: req.body.director[sh].directoremail_id,
                          subject:
                            "" +
                            req.body.caname +
                            " has invited you to collaborate as a Director ",
                          html:
                            "<!DOCTYPE html>" +
                            "<html><head>" +
                            "    <title>ComSec360 Invitation</title>" +
                            '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
                            "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
                            '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
                            '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
                            '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
                            '    <style type="text/css">' +
                            "     " +
                            "        /* CLIENT-SPECIFIC STYLES */" +
                            "        body," +
                            "        table," +
                            "        td," +
                            "        a {" +
                            "            -webkit-text-size-adjust: 100%;" +
                            "            -ms-text-size-adjust: 100%;" +
                            "        }" +
                            "" +
                            "        table," +
                            "        td {" +
                            "            mso-table-lspace: 0pt;" +
                            "            mso-table-rspace: 0pt;" +
                            "        }" +
                            "" +
                            "        img {" +
                            "            -ms-interpolation-mode: bicubic;" +
                            "        }" +
                            "" +
                            "        /* RESET STYLES */" +
                            "        img {" +
                            "            border: 0;" +
                            "            height: auto;" +
                            "            line-height: 100%;" +
                            "            outline: none;" +
                            "            text-decoration: none;" +
                            "        }" +
                            "" +
                            "        table {" +
                            "            border-collapse: collapse !important;" +
                            "        }" +
                            "" +
                            "        body {" +
                            "            height: 100% !important;" +
                            "            margin: 0 !important;" +
                            "            padding: 0 !important;" +
                            "            width: 100% !important;" +
                            "        }" +
                            "" +
                            "        /* iOS BLUE LINKS */" +
                            "        a[x-apple-data-detectors] {" +
                            "            color: inherit !important;" +
                            "            text-decoration: none !important;" +
                            "            font-size: inherit !important;" +
                            "            font-family: inherit !important;" +
                            "            font-weight: inherit !important;" +
                            "            line-height: inherit !important;" +
                            "        }" +
                            "" +
                            "        /* MOBILE STYLES */" +
                            "        @media screen and (max-width:600px) {" +
                            "            h1 {" +
                            "                font-size: 32px !important;" +
                            "                line-height: 32px !important;" +
                            "            }" +
                            "        }" +
                            "" +
                            "        /* ANDROID CENTER FIX */" +
                            '        div[style*="margin: 16px 0;"] {' +
                            "            margin: 0 !important;" +
                            "        }" +
                            "    </style>" +
                            "</head>" +
                            " <style>" +
                            " #para_text {" +
                            "  padding: 0px 20px;" +
                            "  color: #111111;" +
                            "  font-family: 'Raleway Light', Arial, sans-serif;" +
                            "  font-size: 1.5em;" +
                            "  text-align: center;" +
                            "}" +
                            "#grad1 {" +
                            "  background-color: #E5E5E5;" +
                            "}" +
                            "#link_social" +
                            "{" +
                            "	padding: 5px;" +
                            "	color: #666666;" +
                            "}" +
                            "</style>" +
                            '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
                            "    " +
                            '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "        <!-- LOGO -->" +
                            "        <tbody><tr>" +
                            "           " +
                            '<td align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                    <tbody><tr>" +
                            '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
                            "                    </tr>" +
                            "                </tbody></table>" +
                            "            </td>" +
                            "        </tr>" +
                            "        <tr>" +
                            '            <td align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                    <tbody><tr>" +
                            '                        <td style="padding: 30px;  " valign="top" align="center">' +
                            '                           <img style="max-width: 29%; max-height: 50%; " src="' +
                            api_url +
                            '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
                            "                        </td>" +
                            "                    </tr>" +
                            "                </tbody></table>" +
                            "            </td>" +
                            "        </tr>" +
                            "        " +
                            "		<!-- MESSAGE -->" +
                            "		<tr>" +
                            '        <td align="center">' +
                            '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "        <tbody>" +
                            "		<tr>" +
                            '            <td align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                    <tbody>" +
                            "					<tr>" +
                            '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
                            "                           <h1>CA " +
                            req.body.caname +
                            " has invited you to collaborate as a Director in " +
                            liveAPP_URL +
                            "</h1>" +
                            "						   " +
                            "						" +
                            "						   " +
                            '							<a href="' +
                            api_url +
                            "/registeration/" +
                            resultdirector._id +
                            '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">Accept Invitation</a>' +
                            '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
                            '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
                            liveAPP_URL +
                            "</p>" +
                            '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
                            req.body.director[sh].directoremail_id +
                            "</p>" +
                            "                        </td>" +
                            "" +
                            "                    </tr><tr><td><hr><td></tr>" +
                            "" +
                            "                </tbody></table>" +
                            "            </td>" +
                            "        </tr>" +
                            "		</tbody>" +
                            "		</table>" +
                            "        </td>" +
                            "        </tr>" +
                            "        <tr>" +
                            '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                <tbody>" +
                            "				" +
                            "					<tr>" +
                            '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
                            "				" +
                            "			" +
                            "				" +
                            "				<!-- COPYRIGHT TEXT -->" +
                            '					<p id="footer_text">' +
                            "If you have any questions you can get in touch at support.comsec360.com</p>" +
                            "					<p>© 2021 ComSec360</p>" +
                            "                    </td>" +
                            "                    </tr>" +
                            "				" +
                            "	" +
                            "                </tbody>" +
                            "				</table>" +
                            "            </td>" +
                            "        </tr>" +
                            "    </tbody></table>" +
                            "" +
                            "" +
                            "</body></html>",
                        };

                        transporter.sendMail(
                          mailOptionsdirector,
                          function (error, info) {
                            if (error) {
                              console.log("error" + error);
                            } else {
                              console.log("Email sent: " + info.response);
                            }
                          }
                        );
                      }
                    }
                  }
                );
              }
            }

            for (let sh = 0; sh < req.body.cs.length; sh++) {
              if (
                req.body.cs[sh].csemail_id != "" &&
                req.body.cs[sh].csfirst_name != ""
              ) {
                let userdata = {
                  email_id: req.body.cs[sh].csemail_id,
                  name: req.body.cs[sh].csfirst_name,
                  surname: req.body.cs[sh].cslast_name,
                  mobile_number: "",
                  companyid: mongoose.Types.ObjectId(resultusernew._id),
                  roles: "Company Secretory",
                  typeofuser: "Natural Person",
                  firstperson: sh + 1,
                  password: "",
                };
                User.findOne(
                  { email_id: req.body.cs[sh].csemail_id },
                  async (err, cs) => {
                    if (err) {
                      // res.status(200).json({
                      //   status: "400",
                      //   msg: "Something Went Wrong",
                      // });
                    }
                    if (!cs) {
                      let usercs = User(userdata);
                      let resultcs = await usercs.save();

                      if (resultcs) {
                        var transporter = nodemailer.createTransport({
                          host: "smtp.gmail.com",
                          port: 465,
                          secure: true,
                          auth: {
                            user: "vikas@synram.co",
                            pass: "Synram@2019",
                          },
                        });

                        var mailOptionscs = {
                          from: "vikas@synram.co",
                          to: req.body.cs[sh].csemail_id,
                          subject:
                            "" +
                            req.body.caname +
                            " has invited you to collaborate as a Company Secretory ",
                          html:
                            "<!DOCTYPE html>" +
                            "<html><head>" +
                            "    <title>ComSec360 Invitation</title>" +
                            '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
                            "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
                            '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
                            '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
                            '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
                            '    <style type="text/css">' +
                            "     " +
                            "        /* CLIENT-SPECIFIC STYLES */" +
                            "        body," +
                            "        table," +
                            "        td," +
                            "        a {" +
                            "            -webkit-text-size-adjust: 100%;" +
                            "            -ms-text-size-adjust: 100%;" +
                            "        }" +
                            "" +
                            "        table," +
                            "        td {" +
                            "            mso-table-lspace: 0pt;" +
                            "            mso-table-rspace: 0pt;" +
                            "        }" +
                            "" +
                            "        img {" +
                            "            -ms-interpolation-mode: bicubic;" +
                            "        }" +
                            "" +
                            "        /* RESET STYLES */" +
                            "        img {" +
                            "            border: 0;" +
                            "            height: auto;" +
                            "            line-height: 100%;" +
                            "            outline: none;" +
                            "            text-decoration: none;" +
                            "        }" +
                            "" +
                            "        table {" +
                            "            border-collapse: collapse !important;" +
                            "        }" +
                            "" +
                            "        body {" +
                            "            height: 100% !important;" +
                            "            margin: 0 !important;" +
                            "            padding: 0 !important;" +
                            "            width: 100% !important;" +
                            "        }" +
                            "" +
                            "        /* iOS BLUE LINKS */" +
                            "        a[x-apple-data-detectors] {" +
                            "            color: inherit !important;" +
                            "            text-decoration: none !important;" +
                            "            font-size: inherit !important;" +
                            "            font-family: inherit !important;" +
                            "            font-weight: inherit !important;" +
                            "            line-height: inherit !important;" +
                            "        }" +
                            "" +
                            "        /* MOBILE STYLES */" +
                            "        @media screen and (max-width:600px) {" +
                            "            h1 {" +
                            "                font-size: 32px !important;" +
                            "                line-height: 32px !important;" +
                            "            }" +
                            "        }" +
                            "" +
                            "        /* ANDROID CENTER FIX */" +
                            '        div[style*="margin: 16px 0;"] {' +
                            "            margin: 0 !important;" +
                            "        }" +
                            "    </style>" +
                            "</head>" +
                            " <style>" +
                            " #para_text {" +
                            "  padding: 0px 20px;" +
                            "  color: #111111;" +
                            "  font-family: 'Raleway Light', Arial, sans-serif;" +
                            "  font-size: 1.5em;" +
                            "  text-align: center;" +
                            "}" +
                            "#grad1 {" +
                            "  background-color: #E5E5E5;" +
                            "}" +
                            "#link_social" +
                            "{" +
                            "	padding: 5px;" +
                            "	color: #666666;" +
                            "}" +
                            "</style>" +
                            '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
                            "    " +
                            '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "        <!-- LOGO -->" +
                            "        <tbody><tr>" +
                            "           " +
                            '<td align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                    <tbody><tr>" +
                            '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
                            "                    </tr>" +
                            "                </tbody></table>" +
                            "            </td>" +
                            "        </tr>" +
                            "        <tr>" +
                            '            <td align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                    <tbody><tr>" +
                            '                        <td style="padding: 30px;  " valign="top" align="center">' +
                            '                           <img style="max-width: 29%; max-height: 50%; " src="' +
                            api_url +
                            '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
                            "                        </td>" +
                            "                    </tr>" +
                            "                </tbody></table>" +
                            "            </td>" +
                            "        </tr>" +
                            "        " +
                            "		<!-- MESSAGE -->" +
                            "		<tr>" +
                            '        <td align="center">' +
                            '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "        <tbody>" +
                            "		<tr>" +
                            '            <td align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                    <tbody>" +
                            "					<tr>" +
                            '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
                            "                           <h1>CA " +
                            req.body.caname +
                            " has invited you to collaborate as a Company Secretory in" +
                            liveAPP_URL +
                            "</h1>" +
                            "						   " +
                            "						" +
                            "						   " +
                            '							<a href="' +
                            api_url +
                            "/registeration/" +
                            resultcs._id +
                            '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">Accept Invitation</a>' +
                            '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
                            '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
                            liveAPP_URL +
                            "</p>" +
                            '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
                            req.body.cs[sh].csemail_id +
                            "</p>" +
                            "                        </td>" +
                            "" +
                            "                    </tr><tr><td><hr><td></tr>" +
                            "" +
                            "                </tbody></table>" +
                            "            </td>" +
                            "        </tr>" +
                            "		</tbody>" +
                            "		</table>" +
                            "        </td>" +
                            "        </tr>" +
                            "        <tr>" +
                            '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                <tbody>" +
                            "				" +
                            "					<tr>" +
                            '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
                            "				" +
                            "			" +
                            "				" +
                            "				<!-- COPYRIGHT TEXT -->" +
                            '					<p id="footer_text">' +
                            "If you have any questions you can get in touch at support.comsec360.com</p>" +
                            "					<p>© 2021 ComSec360</p>" +
                            "                    </td>" +
                            "                    </tr>" +
                            "				" +
                            "	" +
                            "                </tbody>" +
                            "				</table>" +
                            "            </td>" +
                            "        </tr>" +
                            "    </tbody></table>" +
                            "" +
                            "" +
                            "</body></html>",
                        };

                        transporter.sendMail(
                          mailOptionscs,
                          function (error, info) {
                            if (error) {
                              console.log("error" + error);
                            } else {
                              console.log("Email sent: " + info.response);
                            }
                          }
                        );
                        // res.status(200).json({
                        //   status: "200",
                        //   msg: "Successfully Added",
                        //   result: resultusernew,
                        // });
                        // res.status(200).json({
                        //   status: "200",
                        //   msg: "Successfully Invited",
                        //   result: resultuser,
                        // });
                      } else {
                        // res.status(200).json({
                        //   status: "400",
                        //   msg: "Something Went Wrong",
                        // });
                      }
                    }
                    if (cs) {
                      let companyid = cs.companyid;
                      if (companyid.includes(resultusernew._id)) {
                      } else {
                        companyid.push(
                          mongoose.Types.ObjectId(resultusernew._id)
                        );

                        User.updateOne(
                          { email_id: req.body.cs[sh].csemail_id },
                          {
                            $set: {
                              companyid: companyid,
                            },
                          },
                          (err, result) => {
                            if (err) {
                              // res.status(200).json({
                              //   status: "400",
                              //   msg: "Updation failed",
                              // });
                            } else {
                              // return res.status(200).json({
                              //   status: "200",
                              //   msg: "Sucessfully Updated",
                              // });
                            }
                          }
                        );

                        var transporter = nodemailer.createTransport({
                          host: "smtp.gmail.com",
                          port: 465,
                          secure: true,
                          auth: {
                            user: "vikas@synram.co",
                            pass: "Synram@2019",
                          },
                        });

                        var mailOptionscs = {
                          from: "vikas@synram.co",
                          to: req.body.cs[sh].csemail_id,
                          subject:
                            "" +
                            req.body.caname +
                            " has invited you to collaborate as a Company Secretory ",
                          html:
                            "<!DOCTYPE html>" +
                            "<html><head>" +
                            "    <title>ComSec360 Invitation</title>" +
                            '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
                            "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
                            '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
                            '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
                            '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
                            '    <style type="text/css">' +
                            "     " +
                            "        /* CLIENT-SPECIFIC STYLES */" +
                            "        body," +
                            "        table," +
                            "        td," +
                            "        a {" +
                            "            -webkit-text-size-adjust: 100%;" +
                            "            -ms-text-size-adjust: 100%;" +
                            "        }" +
                            "" +
                            "        table," +
                            "        td {" +
                            "            mso-table-lspace: 0pt;" +
                            "            mso-table-rspace: 0pt;" +
                            "        }" +
                            "" +
                            "        img {" +
                            "            -ms-interpolation-mode: bicubic;" +
                            "        }" +
                            "" +
                            "        /* RESET STYLES */" +
                            "        img {" +
                            "            border: 0;" +
                            "            height: auto;" +
                            "            line-height: 100%;" +
                            "            outline: none;" +
                            "            text-decoration: none;" +
                            "        }" +
                            "" +
                            "        table {" +
                            "            border-collapse: collapse !important;" +
                            "        }" +
                            "" +
                            "        body {" +
                            "            height: 100% !important;" +
                            "            margin: 0 !important;" +
                            "            padding: 0 !important;" +
                            "            width: 100% !important;" +
                            "        }" +
                            "" +
                            "        /* iOS BLUE LINKS */" +
                            "        a[x-apple-data-detectors] {" +
                            "            color: inherit !important;" +
                            "            text-decoration: none !important;" +
                            "            font-size: inherit !important;" +
                            "            font-family: inherit !important;" +
                            "            font-weight: inherit !important;" +
                            "            line-height: inherit !important;" +
                            "        }" +
                            "" +
                            "        /* MOBILE STYLES */" +
                            "        @media screen and (max-width:600px) {" +
                            "            h1 {" +
                            "                font-size: 32px !important;" +
                            "                line-height: 32px !important;" +
                            "            }" +
                            "        }" +
                            "" +
                            "        /* ANDROID CENTER FIX */" +
                            '        div[style*="margin: 16px 0;"] {' +
                            "            margin: 0 !important;" +
                            "        }" +
                            "    </style>" +
                            "</head>" +
                            " <style>" +
                            " #para_text {" +
                            "  padding: 0px 20px;" +
                            "  color: #111111;" +
                            "  font-family: 'Raleway Light', Arial, sans-serif;" +
                            "  font-size: 1.5em;" +
                            "  text-align: center;" +
                            "}" +
                            "#grad1 {" +
                            "  background-color: #E5E5E5;" +
                            "}" +
                            "#link_social" +
                            "{" +
                            "	padding: 5px;" +
                            "	color: #666666;" +
                            "}" +
                            "</style>" +
                            '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
                            "    " +
                            '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "        <!-- LOGO -->" +
                            "        <tbody><tr>" +
                            "           " +
                            '<td align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                    <tbody><tr>" +
                            '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
                            "                    </tr>" +
                            "                </tbody></table>" +
                            "            </td>" +
                            "        </tr>" +
                            "        <tr>" +
                            '            <td align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                    <tbody><tr>" +
                            '                        <td style="padding: 30px;  " valign="top" align="center">' +
                            '                           <img style="max-width: 29%; max-height: 50%; " src="' +
                            api_url +
                            '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
                            "                        </td>" +
                            "                    </tr>" +
                            "                </tbody></table>" +
                            "            </td>" +
                            "        </tr>" +
                            "        " +
                            "		<!-- MESSAGE -->" +
                            "		<tr>" +
                            '        <td align="center">' +
                            '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "        <tbody>" +
                            "		<tr>" +
                            '            <td align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                    <tbody>" +
                            "					<tr>" +
                            '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
                            "                           <h1>CA " +
                            req.body.caname +
                            " has invited you to collaborate as a Company Secretory in" +
                            liveAPP_URL +
                            "</h1>" +
                            "						   " +
                            "						" +
                            "						   " +
                            '							<a href="' +
                            api_url +
                            "/registeration/" +
                            resultcs._id +
                            '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">Accept Invitation</a>' +
                            '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
                            '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
                            liveAPP_URL +
                            "</p>" +
                            '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
                            req.body.cs[sh].csemail_id +
                            "</p>" +
                            "                        </td>" +
                            "" +
                            "                    </tr><tr><td><hr><td></tr>" +
                            "" +
                            "                </tbody></table>" +
                            "            </td>" +
                            "        </tr>" +
                            "		</tbody>" +
                            "		</table>" +
                            "        </td>" +
                            "        </tr>" +
                            "        <tr>" +
                            '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
                            '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                            "                <tbody>" +
                            "				" +
                            "					<tr>" +
                            '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
                            "				" +
                            "			" +
                            "				" +
                            "				<!-- COPYRIGHT TEXT -->" +
                            '					<p id="footer_text">' +
                            "If you have any questions you can get in touch at support.comsec360.com</p>" +
                            "					<p>© 2021 ComSec360</p>" +
                            "                    </td>" +
                            "                    </tr>" +
                            "				" +
                            "	" +
                            "                </tbody>" +
                            "				</table>" +
                            "            </td>" +
                            "        </tr>" +
                            "    </tbody></table>" +
                            "" +
                            "" +
                            "</body></html>",
                        };

                        transporter.sendMail(
                          mailOptionscs,
                          function (error, info) {
                            if (error) {
                              console.log("error" + error);
                            } else {
                              console.log("Email sent: " + info.response);
                            }
                          }
                        );
                      }
                    }
                  }
                );
              }
            }

            res.status(200).json({
              status: "200",
              msg: "Successfully Invited",
              result: resultusernew,
            });
          } else {
            res.status(200).json({
              status: "400",
              msg: "Something Went Wrong",
            });
          }
        }
        if (result) {
          res.status(200).json({
            status: "400",
            msg: "Business Name is already register",
          });
        }
      }
    );
  } else {
    res.status(200).json({
      status: "400",
      msg: "Invalid Data",
    });
  }
});

router.post("/adddocumentsetting", async (req, res) => {
  let api_url = process.env.APP_URL;
  let liveAPP_URL = process.env.liveAPP_URL;

  let userdata = {
    name: "dddd",
    content: myvar,
  };

  let userresult = documentsetting(userdata);
  let resultuser = await userresult.save();
});

router.post("/getdocumentsettingbyid", async (req, res) => {
  let userid = req.body.userid;
  let name = req.body.name;

  documentsetting.findOne(
    { userid: mongoose.Types.ObjectId(userid), name: name },
    async (err, result) => {
      if (err) {
        res.status(400).json({
          message: "Something went wrong",
          status: "400",
        });
      }
      if (result) {
        res.status(200).json({
          message: "Data Found",
          status: "200",
          result: result,
        });
      } else {
        res.status(200).json({
          message: "No Data Found",
          status: "200",
          result: [],
        });
      }
    }
  );

  // let userdata ={
  //   name:"dddd",
  //   content:myvar
  // };
  // let userresult = documentsetting(userdata);
  // let resultuser = await userresult.save();
});

router.post("/updatecompanyaccount", auth, async (req, res) => {
  let api_url = process.env.APP_URL;
  let liveAPP_URL = process.env.liveAPP_URL;
  let createdby = req.decoded.id;
  let createdname = req.decoded.name;
  let rolesname = req.decoded.roles;
  if (req.body.business_name != "" && req.body.type_of_business != "") {
    let userdata = req.body;
    Companyaccount.findOne(
      {
        business_name: req.body.business_name,
        _id: { $ne: mongoose.Types.ObjectId(req.body.id) },
      },
      async (err, result) => {
        if (err) {
          res.status(200).json({
            status: "400",
            msg: "Something Went Wrong",
          });
        }
        if (!result) {
          Companyaccount.findOne(
            { _id: mongoose.Types.ObjectId(req.body.id) },
            async (ernew, getcompanydetails) => {
              console.log(String(req.body.business_name));
              console.log(String(getcompanydetails.business_name));

              if (
                String(getcompanydetails.business_name) !=
                String(req.body.business_name)
              ) {
                let msg =
                  "Previous Company name '" +
                  getcompanydetails.business_name +
                  "' has been changed by " +
                  rolesname +
                  " (" +
                  createdname +
                  ")";
                let data = {
                  userid: mongoose.Types.ObjectId(createdby),
                  message: msg,
                  companyid: mongoose.Types.ObjectId(req.body.id),
                };
                let saveworkflowresponse = await Workflow(data).save();
              }

              if (
                String(getcompanydetails.business_name_chinese) !=
                String(req.body.business_name_chinese)
              ) {
                let msg =
                  "Previous Company name in chinese '" +
                  getcompanydetails.business_name_chinese +
                  "' has been changed by " +
                  rolesname +
                  " (" +
                  createdname +
                  ")";
                let data = {
                  userid: mongoose.Types.ObjectId(createdby),
                  message: msg,
                  companyid: mongoose.Types.ObjectId(req.body.id),
                };
                let saveworkflowresponse = await Workflow(data).save();
              }
              if (
                String(getcompanydetails.type_of_business) !=
                String(req.body.type_of_business)
              ) {
                let msg =
                  "Company Type '" +
                  getcompanydetails.type_of_business +
                  "' has been changed by " +
                  rolesname +
                  " (" +
                  createdname +
                  ") for Company name '" +
                  req.body.business_name +
                  "'";
                let data = {
                  userid: mongoose.Types.ObjectId(createdby),
                  message: msg,
                  companyid: mongoose.Types.ObjectId(req.body.id),
                };
                let saveworkflowresponse = await Workflow(data).save();
              }
            }
          );

          Companyaccount.updateOne(
            { _id: mongoose.Types.ObjectId(req.body.id) },
            {
              $set: {
                business_name: req.body.business_name,
                business_name_chinese: req.body.business_name_chinese,
                type_of_business: req.body.type_of_business,
                office_address: req.body.office_address,
                office_address1: req.body.office_address1,
                office_city: req.body.office_city,
                office_country: req.body.office_country,
                office_state: req.body.office_state,
                office_address_physical: req.body.office_address_physical,
                office_address1_physical: req.body.office_address1_physical,
                office_city_physical: req.body.office_city_physical,
                office_country_physical: req.body.office_country_physical,
                office_state_physical: req.body.office_state_physical,
                // email_id: req.body.email_id,
                // mobile_number: req.body.mobile_number,
                // fax: req.body.fax,
                // reference_no: req.body.reference_no,
                // total_share: req.body.total_share,
                // amount_share: req.body.amount_share,
                // company_number: req.body.company_number,
                // incorporate_date: req.body.incorporate_date,
              },
            },
            (err, result) => {
              if (err) {
                res.status(200).json({
                  status: "400",
                  msg: "Updation failed",
                });
              } else {
                return res.status(200).json({
                  status: "200",
                  msg: "Sucessfully Updated",
                });
              }
            }
          );
        }
        if (result) {
          res.status(200).json({
            status: "400",
            msg: "Business Name is already register",
          });
        }
      }
    );
  } else {
    res.status(200).json({
      status: "400",
      msg: "Invalid Data",
    });
  }
});

router.post("/updatecompanyaccountinshareholder", auth, async (req, res) => {
  let api_url = process.env.APP_URL;
  let liveAPP_URL = process.env.liveAPP_URL;
  let createdby = req.decoded.id;
  let createdname = req.decoded.name;
  let rolesname = req.decoded.roles;
  if (req.body.business_name != "" && req.body.type_of_business != "") {
    let userdata = req.body;
    Companyaccount.findOne(
      {
        business_name: req.body.business_name,
        _id: { $ne: mongoose.Types.ObjectId(req.body.id) },
      },
      async (err, result) => {
        if (err) {
          res.status(200).json({
            status: "400",
            msg: "Something Went Wrong",
          });
        }
        if (!result) {
          Companyaccount.findOne(
            { _id: mongoose.Types.ObjectId(req.body.id) },
            async (ernew, getcompanydetails) => {
              console.log(String(req.body.business_name));
              console.log(String(getcompanydetails.business_name));

              if (
                String(getcompanydetails.business_name) !=
                String(req.body.business_name)
              ) {
                let msg =
                  "Previous Company name '" +
                  getcompanydetails.business_name +
                  "' has been changed by " +
                  rolesname +
                  " (" +
                  createdname +
                  ")";
                let data = {
                  userid: mongoose.Types.ObjectId(createdby),
                  message: msg,
                  companyid: mongoose.Types.ObjectId(req.body.id),
                };
                let saveworkflowresponse = await Workflow(data).save();
              }

              if (
                String(getcompanydetails.business_name_chinese) !=
                String(req.body.business_name_chinese)
              ) {
                let msg =
                  "Previous Company name in chinese '" +
                  getcompanydetails.business_name_chinese +
                  "' has been changed by " +
                  rolesname +
                  " (" +
                  createdname +
                  ")";
                let data = {
                  userid: mongoose.Types.ObjectId(createdby),
                  message: msg,
                  companyid: mongoose.Types.ObjectId(req.body.id),
                };
                let saveworkflowresponse = await Workflow(data).save();
              }
              if (
                String(getcompanydetails.type_of_business) !=
                String(req.body.type_of_business)
              ) {
                let msg =
                  "Company Type '" +
                  getcompanydetails.type_of_business +
                  "' has been changed by " +
                  rolesname +
                  " (" +
                  createdname +
                  ") for Company name '" +
                  req.body.business_name +
                  "'";
                let data = {
                  userid: mongoose.Types.ObjectId(createdby),
                  message: msg,
                  companyid: mongoose.Types.ObjectId(req.body.id),
                };
                let saveworkflowresponse = await Workflow(data).save();
              }
            }
          );

          Companyaccount.updateOne(
            { _id: mongoose.Types.ObjectId(req.body.id) },
            {
              $set: {
                business_name: req.body.business_name,
                business_name_chinese: req.body.business_name_chinese,
                type_of_business: req.body.type_of_business,
                office_address: req.body.office_address,
                office_address1: req.body.office_address1,
                office_city: req.body.office_city,
                office_country: req.body.office_country,
                office_state: req.body.office_state,
                office_address_physical: req.body.office_address_physical,
                office_address1_physical: req.body.office_address1_physical,
                office_city_physical: req.body.office_city_physical,
                office_country_physical: req.body.office_country_physical,
                office_state_physical: req.body.office_state_physical,
              },
            },
            (err, result) => {
              if (err) {
                res.status(200).json({
                  status: "400",
                  msg: "Updation failed",
                });
              } else {
                let newcapital = [];
                for (
                  let capitalnew = 0;
                  capitalnew < req.body.capital.length;
                  capitalnew++
                ) {
                  newcapital.push({
                    share_class: req.body.capital[capitalnew].share_class,
                    total_share: req.body.capital[capitalnew].total_share,
                    total_amount_paid:
                      req.body.capital[capitalnew].total_amount_paid,
                    currency: req.body.capital[capitalnew].currency,
                  });
                }

                Shareholdercapital.updateOne(
                  {
                    _id: mongoose.Types.ObjectId(req.body.shareholdercpaitalid),
                  },
                  {
                    $set: {
                      capital: newcapital,
                    },
                  },
                  (err, result) => {}
                );

                return res.status(200).json({
                  status: "200",
                  msg: "Sucessfully Updated",
                });
              }
            }
          );
        }
        if (result) {
          res.status(200).json({
            status: "400",
            msg: "Business Name is already register",
          });
        }
      }
    );
  } else {
    res.status(200).json({
      status: "400",
      msg: "Invalid Data",
    });
  }
});

router.post(
  "/updatecompanyaccountformultipart",
  upload.single("company_logo"),
  auth,
  async (req, res) => {
    let Data = JSON.parse(req.body.Data);
    let api_url = process.env.APP_URL;
    let liveAPP_URL = process.env.liveAPP_URL;
    let createdby = req.decoded.id;
    let createdname = req.decoded.name;
    let rolesname = req.decoded.roles;
    if (Data.business_name != "" && Data.type_of_business != "") {
      let userdata = req.body;
      Companyaccount.findOne(
        {
          business_name: Data.business_name,
          _id: { $ne: mongoose.Types.ObjectId(Data.id) },
        },
        async (err, result) => {
          if (err) {
            res.status(200).json({
              status: "400",
              msg: "Something Went Wrong",
            });
          }
          if (!result) {
            Companyaccount.findOne(
              { _id: mongoose.Types.ObjectId(Data.id) },
              async (ernew, getcompanydetails) => {
                console.log(String(Data.business_name));
                console.log(String(getcompanydetails.business_name));

                if (
                  String(getcompanydetails.business_name) !=
                  String(Data.business_name)
                ) {
                  let msg =
                    "Previous Company name '" +
                    getcompanydetails.business_name +
                    "' has been changed by " +
                    rolesname +
                    " (" +
                    createdname +
                    ")";
                  let data = {
                    userid: mongoose.Types.ObjectId(createdby),
                    message: msg,
                    companyid: mongoose.Types.ObjectId(Data.id),
                  };
                  let saveworkflowresponse = await Workflow(data).save();
                }

                if (
                  String(getcompanydetails.business_name_chinese) !=
                  String(Data.business_name_chinese)
                ) {
                  let msg =
                    "Previous Company name in chinese '" +
                    getcompanydetails.business_name_chinese +
                    "' has been changed by " +
                    rolesname +
                    " (" +
                    createdname +
                    ")";
                  let data = {
                    userid: mongoose.Types.ObjectId(createdby),
                    message: msg,
                    companyid: mongoose.Types.ObjectId(Data.id),
                  };
                  let saveworkflowresponse = await Workflow(data).save();
                }
                if (
                  String(getcompanydetails.type_of_business) !=
                  String(Data.type_of_business)
                ) {
                  let msg =
                    "Company Type '" +
                    getcompanydetails.type_of_business +
                    "' has been changed by " +
                    rolesname +
                    " (" +
                    createdname +
                    ") for Company name '" +
                    Data.business_name +
                    "'";
                  let data = {
                    userid: mongoose.Types.ObjectId(createdby),
                    message: msg,
                    companyid: mongoose.Types.ObjectId(Data.id),
                  };
                  let saveworkflowresponse = await Workflow(data).save();
                }
              }
            );

            let company_logo;
            console.log(req.file);
            if (req.file != undefined) {
              company_logo = req.file.filename;

              Companyaccount.updateOne(
                { _id: mongoose.Types.ObjectId(Data.id) },
                {
                  $set: {
                    business_name: Data.business_name,
                    business_name_chinese: Data.business_name_chinese,
                    type_of_business: Data.type_of_business,
                    office_address: Data.office_address,
                    office_address1: Data.office_address1,
                    office_city: Data.office_city,
                    office_country: Data.office_country,
                    office_state: Data.office_state,
                    office_address_physical: Data.office_address_physical,
                    office_address1_physical: Data.office_address1_physical,
                    office_city_physical: Data.office_city_physical,
                    office_country_physical: Data.office_country_physical,
                    office_state_physical: Data.office_state_physical,
                    company_logo: company_logo,
                    incorporate_date: Data.incorporate_date,
                    financial_date: Data.financial_date,
                    share_right: Data.share_right,
                    capital: Data.capital,
                    company_number: Data.company_number,
                  },
                },
                (err, result) => {
                  if (err) {
                    res.status(200).json({
                      status: "400",
                      msg: "Updation failed",
                    });
                  } else {
                    return res.status(200).json({
                      status: "200",
                      msg: "Sucessfully Updated",
                    });
                  }
                }
              );
            } else {
              Companyaccount.updateOne(
                { _id: mongoose.Types.ObjectId(Data.id) },
                {
                  $set: {
                    business_name: Data.business_name,
                    business_name_chinese: Data.business_name_chinese,
                    type_of_business: Data.type_of_business,
                    office_address: Data.office_address,
                    office_address1: Data.office_address1,
                    office_city: Data.office_city,
                    office_country: Data.office_country,
                    office_state: Data.office_state,
                    office_address_physical: Data.office_address_physical,
                    office_address1_physical: Data.office_address1_physical,
                    office_city_physical: Data.office_city_physical,
                    office_country_physical: Data.office_country_physical,
                    office_state_physical: Data.office_state_physical,
                    incorporate_date: Data.incorporate_date,
                    financial_date: Data.financial_date,
                    share_right: Data.share_right,
                    capital: Data.capital,
                    company_number: Data.company_number,
                  },
                },
                (err, result) => {
                  if (err) {
                    res.status(200).json({
                      status: "400",
                      msg: "Updation failed",
                    });
                  } else {
                    return res.status(200).json({
                      status: "200",
                      msg: "Sucessfully Updated",
                    });
                  }
                }
              );
            }
          }
          if (result) {
            res.status(200).json({
              status: "400",
              msg: "Business Name is already register",
            });
          }
        }
      );
    } else {
      res.status(200).json({
        status: "400",
        msg: "Invalid Data",
      });
    }
  }
);

router.post("/changeactiveaccount", auth, async (req, res) => {
  if (req.body.activeid != "" && req.body.newid != "") {
    await Companyaccount.updateOne(
      { _id: mongoose.Types.ObjectId(req.body.activeid) },
      { $set: { active: "0" } }
    );
    let newidupdate = await Companyaccount.updateOne(
      { _id: mongoose.Types.ObjectId(req.body.newid) },
      { $set: { active: "1" } }
    );
    if (newidupdate) {
      res.status(200).json({
        status: "200",
        msg: "Changed Successfully",
      });
    } else {
      res.status(200).json({
        status: "400",
        msg: "No Update",
      });
    }
  } else {
    res.status(200).json({
      status: "400",
      msg: "All Field Required",
    });
  }
});

router.post("/addsubscription", auth, async (req, res) => {
  if (
    req.body.userid != "" &&
    req.body.companyid != "" &&
    req.body.subscriptions_amount != "" &&
    req.body.end_date != "" &&
    req.body.start_date != "" &&
    req.body.type != ""
  ) {
    let subscriptiondata = {
      companyid: req.body.companyid,
      end_date: new Date(req.body.end_date),
      subscriptions_amount: req.body.subscriptions_amount,
      start_date: req.body.start_date,
      userid: req.body.userid,
      type: req.body.type,
    };
    let subscriptiondataresult = Subscription(subscriptiondata);
    let resultsubscriptiondata = await subscriptiondataresult.save();

    let year = new Date(req.body.start_date).getFullYear();
    let newdate = "10-31-" + year;
    if (new Date(req.body.start_date).getTime() > new Date(newdate).getTime()) {
      let enddatenew = new Date(req.body.end_date);
      let startdate = enddatenew.setDate(enddatenew.getDate() + 1);
      let date = new Date(startdate);
      let newenddate = "12-31-" + date.getFullYear();
      let nextsubscriptiondata = {
        companyid: req.body.companyid,
        end_date: new Date(newenddate),
        subscriptions_amount: "500",
        start_date: new Date(startdate),
        userid: req.body.userid,
        type: "subscription",
      };
      let nextsubscriptiondataresult = Subscription(nextsubscriptiondata);
      let nextresultsubscriptiondata = await nextsubscriptiondataresult.save();
    }

    if (resultsubscriptiondata) {
      res.status(200).json({
        status: "200",
        msg: "Added Successfully",
      });
    } else {
      res.status(200).json({
        status: "400",
        msg: "No Added",
      });
    }
  } else {
    res.status(200).json({
      status: "400",
      msg: "All Field Required",
    });
  }
});

router.post("/addallsubscription", auth, async (req, res) => {
  if (req.body.length > 0) {
    let resultsubscriptiondata = "";
    let companyidnew = [];
    let subscription_id = [];
    let subscriptions_amount = 0;
    for (let i = 0; i < req.body.length; i++) {
      companyidnew.push(mongoose.Types.ObjectId(req.body[i].companyid));
      subscriptions_amount =
        subscriptions_amount + req.body[i].subscriptions_amount;
      let subscriptiondata = "";
      let year = new Date(req.body[i].start_date).getFullYear();
      let newdate = "10-31-" + year;
      if (
        new Date(req.body[i].start_date).getTime() > new Date(newdate).getTime()
      ) {
        subscriptiondata = {
          companyid: req.body[i].companyid,
          end_date: req.body[i].end_date,
          subscriptions_amount: req.body[i].subscriptions_amount - 500,
          start_date: req.body[i].start_date,
          userid: req.body[i].userid,
          type: req.body[i].type,
        };
      } else {
        subscriptiondata = {
          companyid: req.body[i].companyid,
          end_date: req.body[i].end_date,
          subscriptions_amount: req.body[i].subscriptions_amount,
          start_date: req.body[i].start_date,
          userid: req.body[i].userid,
          type: req.body[i].type,
        };
      }
      let subscriptiondataresult = Subscription(subscriptiondata);
      resultsubscriptiondata = await subscriptiondataresult.save();
      subscription_id.push(mongoose.Types.ObjectId(resultsubscriptiondata._id));

      if (
        new Date(req.body[i].start_date).getTime() > new Date(newdate).getTime()
      ) {
        let enddatenew = new Date(req.body[i].end_date);
        let startdate = enddatenew.setDate(enddatenew.getDate() + 1);

        let date = new Date(startdate);
        console.log("date" + date);
        console.log("date" + date.getFullYear());
        let newenddate = "12-31-" + date.getFullYear();
        let nextsubscriptiondata = {
          companyid: req.body[i].companyid,
          end_date: new Date(newenddate),
          subscriptions_amount: "500",
          start_date: new Date(startdate),
          userid: req.body[i].userid,
          type: "subscription",
        };
        let nextsubscriptiondataresult = Subscription(nextsubscriptiondata);
        let nextresultsubscriptiondata =
          await nextsubscriptiondataresult.save();
        subscription_id.push(
          mongoose.Types.ObjectId(nextresultsubscriptiondata._id)
        );
      }
    }
    if (resultsubscriptiondata != "") {
      let nextsubscriptiondata11 = {
        companyid: companyidnew,
        subscription_id: subscription_id,
        subscriptions_amount: subscriptions_amount,
        userid: req.body[0].userid,
      };
      let nextsubscriptiondataresult11 = SubscriberSubscription(
        nextsubscriptiondata11
      );
      let nextresultsubscriptiondata11 =
        await nextsubscriptiondataresult11.save();

      res.status(200).json({
        status: "200",
        msg: "Added Successfully",
      });
    } else {
      res.status(200).json({
        status: "400",
        msg: "No Added",
      });
    }
  } else {
    res.status(200).json({
      status: "400",
      msg: "All Field Required",
    });
  }
});

module.exports = router;
