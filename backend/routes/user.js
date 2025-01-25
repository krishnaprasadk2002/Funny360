const dotenv = require("dotenv");
const express = require("express");
const router = express.Router();
const {
  User,
  Loginuser,
  Esign,
  Activity,
  ValidateRegister,
} = require("../models/user");
const {
  Companyaccount,
  Shareholdercapital,
} = require("../models/companyaccount");
let bcrypt = require("bcryptjs");
const crypto = require('crypto');
const jwt = require("jsonwebtoken");
let nodemailer = require("nodemailer");
let mongoose = require("mongoose");

// Config Environments
dotenv.config();

const auth = require("../middleware/Auth");
const path = require("path");
const multiparty = require("multiparty");
let fs = require("fs");
const { upload, liveurlnew } = require("../configs/multer.config");
const { hashPassword } = require("../utils/hashPassword");
const { sendOtpEmail } = require("../configs/mailer");
const userOtpVerification = require("../models/otpModels");

//User registeration
router.post("/register", async (req, res) => {
  try {
    const { error } = ValidateRegister(req.body);
    if (error) {
      const errorMessages = error.details.map((detail) => detail.message);
      return res.status(400).json({ errors: errorMessages });
    }

    const { name, roles, email, password, mobile } = req.body;

    // Check if email is already registered
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      return res.status(400).json({ error: "This email is already used." });
    }

    // Hashing password
    const hashedPassword = await hashPassword(password);

    const user = new User({
      name,
      roles,
      email,
      password: hashedPassword,
      mobile_number: mobile,
    });

    await user.save();
    res.status(201).json({ message: "User registered successfully!" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

function generateOtp(){
  return crypto.randomInt(100000, 999999).toString();
}

// login 
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        status: "400",
        message: "Email and Password are required.",
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email });
    console.log('user data in login', user);

    if (!user) {
      return res.status(400).json({
        status: "400",
        message: "Invalid email",
      });
    }

    // Checking password is right
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(400).json({
        status: "400",
        message: "Invalid password",
      });
    }

    if (user.active !== "0") {
      return res.status(403).json({
        status: "403",
        message: "Your account is inactive. Please contact admin.",
      });
    }

    if (user.is_Verified) {
      const payload = {
        id: user._id,
        roles: user.roles,
        name: user.name,
        email: user.email,
      };

      const token = jwt.sign(payload, process.env.SECRET_KEY || 'Token', { expiresIn: '30m' });

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 60 * 1000, 
        sameSite: "None",
      });

      console.log("Cookies set in response:", token);

      return res.status(200).json({
        status: "200",
        message: "User successfully logged in.",
        user: {
          id: user._id, 
          name: user.name,
          email: user.email,
          roles: user.roles,
        },
        token: token, 
      });
    }

    // If user is not verified, generate and send OTP
    const otp = generateOtp();

    // Save OTP
    const otpRecord = new userOtpVerification({ email, otp });
    await otpRecord.save();

    // Send OTP to the user's email
    await sendOtpEmail(email, otp);

    return res.status(200).json({
      status: "200",
      message: "OTP sent for two-factor authentication.",
      requiresOtp: true,
      email,
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      status: "500",
      message: "Internal server error.",
    });
  }
});



// Updated OTP verification route
router.post("/verify-otp", async (req, res) => {
  const { email, twoFactorCode } = req.body;

  try {
    if (!email || !twoFactorCode) {
      return res.status(400).json({
        status: "400",
        message: "Email and OTP are required.",
      });
    }

    // Find the OTP record for the user
    const otpRecord = await userOtpVerification.findOne({ email });

    if (!otpRecord) {
      return res.status(400).json({
        status: "400",
        message: "No OTP record found for this email.",
      });
    }

    // Verify the OTP
    if (twoFactorCode !== otpRecord.otp) {
      return res.status(400).json({
        status: "400",
        message: "Invalid CODE.",
      });
    }

    // If OTP is valid, mark the user as verified
    await User.updateOne({ email }, { is_Verified: true });

    // Delete the OTP record after verification
    await userOtpVerification.deleteOne({ email });

    // Generate JWT token
    const user = await User.findOne({ email });
    const payload = {
      id: user._id,
      roles: user.roles,
      name: user.name,
      email: user.email,
    };

    // Change expiration to 30 minutes
    const token = jwt.sign(payload, process.env.SECRET_KEY || 'Token', {
      expiresIn: '30m',
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 60 * 1000, // 30 minutes
      sameSite: "None",
    });

    return res.status(200).json({
      status: "200",
      message: "User successfully logged in.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
      },
    });

  } catch (error) {
    console.error("twoFactorCode verification error:", error);
    return res.status(500).json({
      status: "500",
      message: "Internal server error.",
    });
  }
});



router.post("/resendCode", async (req, res) => {
  const { email } = req.body;

  try {
    // Validate email
    if (!email) {
      return res.status(400).json({
        status: "400",
        message: "Email is required.",
      });
    }

    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        status: "400",
        message: "No user found with this email.",
      });
    }

    // Generating new otp
    const otp = generateOtp();
    const otpRecord = new userOtpVerification({ email, otp });
    //deleting last otp
    await userOtpVerification.deleteMany({ email });
    //saving new otp
    await otpRecord.save();

    await sendOtpEmail(email, otp);

    return res.status(200).json({
      status: "200",
      message: "OTP resent successfully.",
    });
  } catch (error) {
    console.error("Error resending OTP:", error);
    return res.status(500).json({
      status: "500",
      message: "Internal server error.",
    });
  }
});


// router.post("/createReg", async (req, res) => {
//   try {
//     const data = req.body;

//     const saltRounds = 10;
//     bcrypt.genSalt(saltRounds, (err, salt) => {
//       if (err) {
//         console.log(err);
//         res.status(400).json({
//           status: "400",
//           message: "Some error occurred!",
//         });
//       }
//       if (!salt) {
//         console.log("salt false");
//         res.status(400).json({
//           status: "400",
//           message: "Some error occurred!",
//         });
//       }
//       bcrypt.hash(data.password, salt, (err, hash) => {
//         if (err) {
//           console.log("bcrypt error = ", err);
//           res.status(400).json({
//             status: "400",
//             message: "Some error occurred!",
//           });
//         }
//         delete data.password;
//         data.password = hash;

//         // Save the user to the database (assuming you have a User model)
//         User.create(data)
//           .then((user) => {
//             return res.status(201).json({
//               status: "201",
//               message: "User created successfully!",
//               user: user,
//             });
//           })
//           .catch((error) => {
//             console.error("Error saving user: ", error);
//             return res.status(500).json({
//               status: "500",
//               message: "Error saving user.",
//             });
//           });
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

// router.post("/loginwithpassword", async function (req, res) {
//   console.log("password" + password);
//   let email = req.body.email;
//   let password = req.body.password;
//   console.log("password" + password);

//   User.findOne({ email: email }, function (err, result) {
//     console.log("gggg" + result);

//     if (err) {
//       return res.status(200).json({
//         status: "400",
//         message: "Some error occurred!",
//       });
//     }
//     if (!result) {
//       return res.status(200).json({
//         status: "400",
//         message: "Email Id and Password is wrong",
//       });
//     }
//     if (result.password) {
//       // const isValid = bcrypt.compareSync(password, result.password);
//       // console.log(isValid);
//       if (result.password == password) {
//         payload = {
//           id: result._id,
//           roles: result.roles,
//           name: result.name,
//           email: result.email,
//         };

//         jwt.sign(
//           payload,
//           process.env.SECRET_KEY,
//           { expiresIn: "4h" },
//           (err, token) => {
//             if (err) {
//               return res.status(200).json({
//                 status: "400",
//                 message: "Some error occurred!",
//               });
//             }
//             if (!token) {
//               return res.status(200).json({
//                 status: "400",
//                 message: "Some error occurred!",
//               });
//             }
//             if (token) {
//               let logindata = { userid: result._id };
//               let loginresult = Loginuser(logindata);
//               loginresult.save();
//               if (result.active == "0") {
//                 return res.status(200).json({
//                   status: "200",
//                   message: "User Successfully Login",
//                   result: result,
//                   token: token,
//                 });
//               } else {
//                 return res.status(200).json({
//                   status: "400",
//                   message:
//                     "Your Account is inactive now. please contact to admin",
//                 });
//               }
//             }
//           }
//         );
//       } else {
//         return res.status(200).json({
//           status: "400",
//           message: "Email Id and Password is wrong1",
//         });
//       }
//     } else {
//       return res.status(200).json({
//         status: "400",
//         message: "Email Id and Password is wrong2",
//       });
//     }
//   });
// });

// router.post("/changepassword", async function (req, res) {
//   let old_password = req.body.old_password;
//   let new_password = req.body.new_password;
//   let comfirm_new_password = req.body.comfirm_new_password;
//   let id = req.body.id;

//   User.findOne({ _id: mongoose.Types.ObjectId(id) }, function (err, result) {
//     if (err) {
//       return res.status(200).json({
//         status: "400",
//         message: "Some error occurred!",
//       });
//     }
//     if (!result) {
//       return res.status(200).json({
//         status: "400",
//         message: "Login Id is wrong",
//       });
//     }
//     if (result.password) {
//       const isValid = bcrypt.compareSync(old_password, result.password);
//       console.log(isValid);
//       if (isValid) {
//         if (new_password == comfirm_new_password) {
//           const saltRounds = 10;
//           bcrypt.genSalt(saltRounds, (err, salt) => {
//             if (err) {
//               console.log(err);
//               res.status(400).json({
//                 status: "400",
//                 message: "Some error occurred!",
//               });
//             }
//             if (!salt) {
//               console.log("salt false");
//               res.status(400).json({
//                 status: "400",
//                 message: "Some error occurred!",
//               });
//             }
//             bcrypt.hash(comfirm_new_password, salt, (err, hash) => {
//               if (err) {
//                 console.log("bcrypt error = ", err);
//                 res.status(400).json({
//                   status: "400",
//                   message: "Some error occurred!",
//                 });
//               }

//               if (!hash) {
//                 console.log("Hash could not be generated!");
//                 res.status(400).json({
//                   status: "400",
//                   message: "Some error occurred!",
//                 });
//               }

//               User.updateOne(
//                 { _id: mongoose.Types.ObjectId(id) },
//                 {
//                   $set: {
//                     password: hash,
//                   },
//                 },
//                 (err, result) => {
//                   if (err) {
//                     res.status(200).json({
//                       status: "400",
//                       message: "Password Failed",
//                     });
//                   } else {
//                     return res.status(200).json({
//                       status: "200",
//                       message: "Password has been changed successfully",
//                     });
//                   }
//                 }
//               );
//             });
//           });
//         } else {
//           return res.status(200).json({
//             status: "400",
//             message: "New Password and Confirm New Password do not match",
//           });
//         }
//       } else {
//         return res.status(200).json({
//           status: "400",
//           message: "Old Password is wrong",
//         });
//       }
//     } else {
//       return res.status(200).json({
//         status: "400",
//         message: "Email Id and Password is wrong",
//       });
//     }
//   });
// });

// router.post("/forgotpassword", async function (req, res) {
//   let api_url = process.env.APP_URL;
//   let liveAPP_URL = process.env.liveAPP_URL;
//   let email = req.body.email;

//   User.findOne({ email: email }, function (err, result) {
//     if (err) {
//       return res.status(200).json({
//         status: "400",
//         message: "Some error occurred!",
//       });
//     }
//     if (!result) {
//       return res.status(200).json({
//         status: "400",
//         message: "Email Id is not registered",
//       });
//     }
//     if (result) {
//       let transporter = nodemailer.createTransport({
//         host: "smtp.gmail.com",
//         port: 465,
//         secure: true,
//         auth: {
//           user: "vikas@synram.co",
//           pass: "Synram@2019",
//         },
//       });

//       let mailOptionscs = {
//         from: "vikas@synram.co",
//         to: email,
//         subject: "Forgot Password",
//         html:
//           "<!DOCTYPE html>" +
//           "<html><head>" +
//           "    <title>ComSec360 Invitation</title>" +
//           '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
//           "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
//           '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
//           '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
//           '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
//           '    <style type="text/css">' +
//           "     " +
//           "        /* CLIENT-SPECIFIC STYLES */" +
//           "        body," +
//           "        table," +
//           "        td," +
//           "        a {" +
//           "            -webkit-text-size-adjust: 100%;" +
//           "            -ms-text-size-adjust: 100%;" +
//           "        }" +
//           "" +
//           "        table," +
//           "        td {" +
//           "            mso-table-lspace: 0pt;" +
//           "            mso-table-rspace: 0pt;" +
//           "        }" +
//           "" +
//           "        img {" +
//           "            -ms-interpolation-mode: bicubic;" +
//           "        }" +
//           "" +
//           "        /* RESET STYLES */" +
//           "        img {" +
//           "            border: 0;" +
//           "            height: auto;" +
//           "            line-height: 100%;" +
//           "            outline: none;" +
//           "            text-decoration: none;" +
//           "        }" +
//           "" +
//           "        table {" +
//           "            border-collapse: collapse !important;" +
//           "        }" +
//           "" +
//           "        body {" +
//           "            height: 100% !important;" +
//           "            margin: 0 !important;" +
//           "            padding: 0 !important;" +
//           "            width: 100% !important;" +
//           "        }" +
//           "" +
//           "        /* iOS BLUE LINKS */" +
//           "        a[x-apple-data-detectors] {" +
//           "            color: inherit !important;" +
//           "            text-decoration: none !important;" +
//           "            font-size: inherit !important;" +
//           "            font-family: inherit !important;" +
//           "            font-weight: inherit !important;" +
//           "            line-height: inherit !important;" +
//           "        }" +
//           "" +
//           "        /* MOBILE STYLES */" +
//           "        @media screen and (max-width:600px) {" +
//           "            h1 {" +
//           "                font-size: 32px !important;" +
//           "                line-height: 32px !important;" +
//           "            }" +
//           "        }" +
//           "" +
//           "        /* ANDROID CENTER FIX */" +
//           '        div[style*="margin: 16px 0;"] {' +
//           "            margin: 0 !important;" +
//           "        }" +
//           "    </style>" +
//           "</head>" +
//           " <style>" +
//           " #para_text {" +
//           "  padding: 0px 20px;" +
//           "  color: #111111;" +
//           "  font-family: 'Raleway Light', Arial, sans-serif;" +
//           "  font-size: 1.5em;" +
//           "  text-align: center;" +
//           "}" +
//           "#grad1 {" +
//           "  background-color: #E5E5E5;" +
//           "}" +
//           "#link_social" +
//           "{" +
//           "	padding: 5px;" +
//           "	color: #666666;" +
//           "}" +
//           "</style>" +
//           '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
//           "    " +
//           '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//           "        <!-- LOGO -->" +
//           "        <tbody><tr>" +
//           "           " +
//           '<td align="center">' +
//           '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//           "                    <tbody><tr>" +
//           '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
//           "                    </tr>" +
//           "                </tbody></table>" +
//           "            </td>" +
//           "        </tr>" +
//           "        <tr>" +
//           '            <td align="center">' +
//           '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//           "                    <tbody><tr>" +
//           '                        <td style="padding: 30px;  " valign="top" align="center">' +
//           '                           <img style="max-width: 29%; max-height: 50%; " src="' +
//           api_url +
//           '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
//           "                        </td>" +
//           "                    </tr>" +
//           "                </tbody></table>" +
//           "            </td>" +
//           "        </tr>" +
//           "        " +
//           "		<!-- MESSAGE -->" +
//           "		<tr>" +
//           '        <td align="center">' +
//           '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//           "        <tbody>" +
//           "		<tr>" +
//           '            <td align="center">' +
//           '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//           "                    <tbody>" +
//           "					<tr>" +
//           '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
//           "                           <h1> Please click the button for reset your password" +
//           "</h1>" +
//           "						   " +
//           "						" +
//           "						   " +
//           '							<a href="' +
//           api_url +
//           "/resetpassword/" +
//           result._id +
//           '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">Reset Password</a>' +
//           '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
//           '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
//           liveAPP_URL +
//           "</p>" +
//           '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
//           email +
//           "</p>" +
//           "                        </td>" +
//           "" +
//           "                    </tr><tr><td><hr><td></tr>" +
//           "" +
//           "                </tbody></table>" +
//           "            </td>" +
//           "        </tr>" +
//           "		</tbody>" +
//           "		</table>" +
//           "        </td>" +
//           "        </tr>" +
//           "        <tr>" +
//           '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
//           '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//           "                <tbody>" +
//           "				" +
//           "					<tr>" +
//           '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
//           "				" +
//           "			" +
//           "				" +
//           "				<!-- COPYRIGHT TEXT -->" +
//           '					<p id="footer_text">' +
//           "If you have any questions you can get in touch at support.comsec360.com</p>" +
//           "					<p>© 2021 ComSec360</p>" +
//           "                    </td>" +
//           "                    </tr>" +
//           "				" +
//           "	" +
//           "                </tbody>" +
//           "				</table>" +
//           "            </td>" +
//           "        </tr>" +
//           "    </tbody></table>" +
//           "" +
//           "" +
//           "</body></html>",
//       };

//       transporter.sendMail(mailOptionscs, function (error, info) {
//         if (error) {
//           console.log("error" + error);
//         } else {
//           console.log("Email sent: " + info.response);
//           res.status(200).json({
//             status: "200",
//             message: "successfully send",
//           });
//         }
//       });
//     }
//   });
// });

// router.post("/resetpassword", async function (req, res) {
//   let api_url = process.env.APP_URL;
//   let liveAPP_URL = process.env.liveAPP_URL;
//   let email = req.body.email;
//   let newpassword = req.body.newpassword;
//   let newpasswordconfirm = req.body.newpasswordconfirm;
//   let _id = req.body.id;
//   User.findOne({ email: email }, function (err, result) {
//     if (err) {
//       return res.status(200).json({
//         status: "400",
//         message: "Some error occurred!",
//       });
//     }
//     if (!result) {
//       return res.status(200).json({
//         status: "400",
//         message: "Email Id is not registered",
//       });
//     }
//     if (result) {
//       const saltRounds = 10;

//       bcrypt.genSalt(saltRounds, (err, salt) => {
//         if (err) {
//           console.log(err);
//           res.status(400).json({
//             status: "400",
//             msg: "Some error occurred!",
//           });
//         }
//         if (!salt) {
//           console.log("salt false");
//           res.status(400).json({
//             status: "400",
//             msg: "Some error occurred!",
//           });
//         }
//         bcrypt.hash(newpasswordconfirm, salt, async (err, hash) => {
//           if (err) {
//             console.log("bcrypt error = ", err);
//             res.status(400).json({
//               status: "400",
//               msg: "Some error occurred!",
//             });
//           }

//           if (!hash) {
//             console.log("Hash could not be generated!");
//             res.status(400).json({
//               status: "400",
//               msg: "Some error occurred!",
//             });
//           }

//           User.updateOne(
//             { _id: mongoose.Types.ObjectId(_id) },
//             {
//               $set: {
//                 password: hash,
//               },
//             },
//             async (err, result) => {
//               if (err) {
//                 res.status(200).json({
//                   status: "400",
//                   msg: "Registeration failed",
//                 });
//               } else {
//                 let transporter = nodemailer.createTransport({
//                   host: "smtp.gmail.com",
//                   port: 465,
//                   secure: true,
//                   auth: {
//                     user: "vikas@synram.co",
//                     pass: "Synram@2019",
//                   },
//                 });

//                 let mailOptionscs = {
//                   from: "vikas@synram.co",
//                   to: email,
//                   subject: "Reset Password Successfully",
//                   html:
//                     "<!DOCTYPE html>" +
//                     "<html><head>" +
//                     "    <title>ComSec360 Invitation</title>" +
//                     '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
//                     "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
//                     '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
//                     '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
//                     '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
//                     '    <style type="text/css">' +
//                     "     " +
//                     "        /* CLIENT-SPECIFIC STYLES */" +
//                     "        body," +
//                     "        table," +
//                     "        td," +
//                     "        a {" +
//                     "            -webkit-text-size-adjust: 100%;" +
//                     "            -ms-text-size-adjust: 100%;" +
//                     "        }" +
//                     "" +
//                     "        table," +
//                     "        td {" +
//                     "            mso-table-lspace: 0pt;" +
//                     "            mso-table-rspace: 0pt;" +
//                     "        }" +
//                     "" +
//                     "        img {" +
//                     "            -ms-interpolation-mode: bicubic;" +
//                     "        }" +
//                     "" +
//                     "        /* RESET STYLES */" +
//                     "        img {" +
//                     "            border: 0;" +
//                     "            height: auto;" +
//                     "            line-height: 100%;" +
//                     "            outline: none;" +
//                     "            text-decoration: none;" +
//                     "        }" +
//                     "" +
//                     "        table {" +
//                     "            border-collapse: collapse !important;" +
//                     "        }" +
//                     "" +
//                     "        body {" +
//                     "            height: 100% !important;" +
//                     "            margin: 0 !important;" +
//                     "            padding: 0 !important;" +
//                     "            width: 100% !important;" +
//                     "        }" +
//                     "" +
//                     "        /* iOS BLUE LINKS */" +
//                     "        a[x-apple-data-detectors] {" +
//                     "            color: inherit !important;" +
//                     "            text-decoration: none !important;" +
//                     "            font-size: inherit !important;" +
//                     "            font-family: inherit !important;" +
//                     "            font-weight: inherit !important;" +
//                     "            line-height: inherit !important;" +
//                     "        }" +
//                     "" +
//                     "        /* MOBILE STYLES */" +
//                     "        @media screen and (max-width:600px) {" +
//                     "            h1 {" +
//                     "                font-size: 32px !important;" +
//                     "                line-height: 32px !important;" +
//                     "            }" +
//                     "        }" +
//                     "" +
//                     "        /* ANDROID CENTER FIX */" +
//                     '        div[style*="margin: 16px 0;"] {' +
//                     "            margin: 0 !important;" +
//                     "        }" +
//                     "    </style>" +
//                     "</head>" +
//                     " <style>" +
//                     " #para_text {" +
//                     "  padding: 0px 20px;" +
//                     "  color: #111111;" +
//                     "  font-family: 'Raleway Light', Arial, sans-serif;" +
//                     "  font-size: 1.5em;" +
//                     "  text-align: center;" +
//                     "}" +
//                     "#grad1 {" +
//                     "  background-color: #E5E5E5;" +
//                     "}" +
//                     "#link_social" +
//                     "{" +
//                     "	padding: 5px;" +
//                     "	color: #666666;" +
//                     "}" +
//                     "</style>" +
//                     '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
//                     "    " +
//                     '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "        <!-- LOGO -->" +
//                     "        <tbody><tr>" +
//                     "           " +
//                     '<td align="center">' +
//                     '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "                    <tbody><tr>" +
//                     '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
//                     "                    </tr>" +
//                     "                </tbody></table>" +
//                     "            </td>" +
//                     "        </tr>" +
//                     "        <tr>" +
//                     '            <td align="center">' +
//                     '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "                    <tbody><tr>" +
//                     '                        <td style="padding: 30px;  " valign="top" align="center">' +
//                     '                           <img style="max-width: 29%; max-height: 50%; " src="' +
//                     api_url +
//                     '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
//                     "                        </td>" +
//                     "                    </tr>" +
//                     "                </tbody></table>" +
//                     "            </td>" +
//                     "        </tr>" +
//                     "        " +
//                     "		<!-- MESSAGE -->" +
//                     "		<tr>" +
//                     '        <td align="center">' +
//                     '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "        <tbody>" +
//                     "		<tr>" +
//                     '            <td align="center">' +
//                     '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "                    <tbody>" +
//                     "					<tr>" +
//                     '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
//                     "                           <h1> Your Password is successfully reset. please login to use new  password" +
//                     "</h1>" +
//                     "						   " +
//                     "						" +
//                     "						   " +
//                     '							<a href="' +
//                     api_url +
//                     '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">Login</a>' +
//                     '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
//                     '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
//                     liveAPP_URL +
//                     "</p>" +
//                     '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
//                     email +
//                     "</p>" +
//                     "                        </td>" +
//                     "" +
//                     "                    </tr><tr><td><hr><td></tr>" +
//                     "" +
//                     "                </tbody></table>" +
//                     "            </td>" +
//                     "        </tr>" +
//                     "		</tbody>" +
//                     "		</table>" +
//                     "        </td>" +
//                     "        </tr>" +
//                     "        <tr>" +
//                     '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
//                     '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "                <tbody>" +
//                     "				" +
//                     "					<tr>" +
//                     '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
//                     "				" +
//                     "			" +
//                     "				" +
//                     "				<!-- COPYRIGHT TEXT -->" +
//                     '					<p id="footer_text">' +
//                     "If you have any questions you can get in touch at support.comsec360.com</p>" +
//                     "					<p>© 2021 ComSec360</p>" +
//                     "                    </td>" +
//                     "                    </tr>" +
//                     "				" +
//                     "	" +
//                     "                </tbody>" +
//                     "				</table>" +
//                     "            </td>" +
//                     "        </tr>" +
//                     "    </tbody></table>" +
//                     "" +
//                     "" +
//                     "</body></html>",
//                 };
//                 transporter.sendMail(mailOptionscs, function (error, info) {
//                   if (error) {
//                     console.log("error" + error);
//                   } else {
//                     console.log("Email sent: " + info.response);

//                     return res.status(200).json({
//                       status: "200",
//                       msg: "Sucessfully Password Changed",
//                     });
//                   }
//                 });
//               }
//             }
//           );
//         });
//       });
//     }
//   });
// });
// router.post("/listuser", async (req, res) => {
//   User.find({ roles: req.body.roles }, async (err, result) => {
//     if (err) {
//       res.status(200).json({
//         status: "400",
//         msg: "Something Went Wrong",
//       });
//     } else {
//       res.status(200).json({
//         status: "200",
//         msg: "Successfully List",
//         result: result,
//       });
//     }
//     console.log(result);
//   });
// });

// router.post("/activitylist", async (req, res) => {
//   Activity.find(
//     { userid: mongoose.Types.ObjectId(req.body.user_id) },
//     async (err, result) => {
//       if (err) {
//         res.status(200).json({
//           status: "400",
//           msg: "Something Went Wrong",
//         });
//       } else {
//         res.status(200).json({
//           status: "200",
//           msg: "Successfully List",
//           result: result,
//         });
//       }
//       console.log(result);
//     }
//   );
// });

// router.post("/listuserbymultiplerole", async (req, res) => {
//   let data;
//   if (req.body.companyid != "") {
//     data = {
//       roles: {
//         $in: ["Guest", "Director", "Company Secretory", "Shareholder", "Owner"],
//       },
//       companyid: mongoose.Types.ObjectId(req.body.companyid),
//     };
//   } else {
//     data = {
//       roles: {
//         $in: ["Guest", "Director", "Company Secretory", "Shareholder", "Owner"],
//       },
//     };
//   }

//   User.aggregate(
//     [
//       { $match: data },
//       {
//         $lookup: {
//           from: "esigns",
//           localField: "_id",
//           foreignField: "userid",
//           as: "esigndetails",
//         },
//       },
//     ],
//     async (err, result) => {
//       if (err) {
//         res.status(200).json({
//           status: "400",
//           msg: "Something Went Wrong",
//         });
//       } else {
//         res.status(200).json({
//           status: "200",
//           msg: "Successfully List",
//           result: result,
//         });
//       }
//     }
//   );
// });

// router.post("/listofuserbymultiplerolewithcomplete", async (req, res) => {
//   let data;
//   if (req.body.companyid != "") {
//     data = {
//       roles: {
//         $in: ["Guest", "Director", "Company Secretory", "Shareholder", "Owner"],
//       },
//       companyid: mongoose.Types.ObjectId(req.body.companyid),
//       status: "3",
//     };
//   } else {
//     data = {
//       roles: {
//         $in: ["Guest", "Director", "Company Secretory", "Shareholder", "Owner"],
//       },
//       status: "3",
//     };
//   }

//   User.find(data, async (err, result) => {
//     if (err) {
//       res.status(200).json({
//         status: "400",
//         msg: "Something Went Wrong",
//       });
//     } else {
//       res.status(200).json({
//         status: "200",
//         msg: "Successfully List",
//         result: result,
//       });
//     }
//     // console.log(result);
//   });
// });

// router.post("/listofuserbymultipleroleallactive", async (req, res) => {
//   let data;
//   if (req.body.companyid != "") {
//     data = {
//       roles: {
//         $in: ["Guest", "Director", "Company Secretory", "Shareholder", "Owner"],
//       },
//       companyid: mongoose.Types.ObjectId(req.body.companyid),
//       // status:{$ne:"4"},
//       status: "3",
//     };
//   } else {
//     data = {
//       roles: {
//         $in: ["Guest", "Director", "Company Secretory", "Shareholder", "Owner"],
//       },
//       //  ,   status:{$ne:"4"},
//     };
//   }

//   User.find(data, async (err, result) => {
//     if (err) {
//       res.status(200).json({
//         status: "400",
//         msg: "Something Went Wrong",
//       });
//     } else {
//       res.status(200).json({
//         status: "200",
//         msg: "Successfully List",
//         result: result,
//       });
//     }
//     // console.log(result);
//   });
// });

// router.post("/listofloginuser", async (req, res) => {
//   Loginuser.find({})
//     .populate("userid")
//     .sort({ $natural: -1 })
//     .limit(200)
//     .exec(async (err, result) => {
//       if (err) {
//         res.status(200).json({
//           status: "400",
//           msg: "Something Went Wrong",
//         });
//       } else {
//         res.status(200).json({
//           status: "200",
//           msg: "Successfully List",
//           result: result,
//         });
//       }
//       // console.log(result);
//     });
// });

// router.post("/getbyid", async (req, res) => {
//   User.find(
//     { _id: mongoose.Types.ObjectId(req.body.id) },
//     async (err, result) => {
//       if (err) {
//         res.status(200).json({
//           status: "400",
//           msg: "Something Went Wrong",
//         });
//       } else {
//         res.status(200).json({
//           status: "200",
//           msg: "Successfully List",
//           result: result,
//         });
//       }
//     }
//   );
// });

// router.post("/registeruser1", async (req, res) => {
//   let api_url = process.env.APP_URL;
//   console.log("text", req.body);
//   if (
//     req.body.id != "" &&
//     req.body.mobile_number != "" &&
//     req.body.name != "" &&
//     req.body.password != ""
//   ) {
//     let userdata = { _id: mongoose.Types.ObjectId(req.body.id) };
//     User.findOne(
//       { _id: mongoose.Types.ObjectId(req.body.id) },
//       async (err, result) => {
//         if (err) {
//           res.status(200).json({
//             status: "400",
//             msg: "Something Went Wrong",
//           });
//         }
//         if (!result) {
//           res.status(200).json({
//             status: "400",
//             msg: "Invalid Id",
//           });
//         }
//         if (result) {
//           const saltRounds = 10;

//           bcrypt.genSalt(saltRounds, (err, salt) => {
//             if (err) {
//               console.log(err);
//               res.status(400).json({
//                 status: "400",
//                 msg: "Some error occurred!",
//               });
//             }
//             if (!salt) {
//               console.log("salt false");
//               res.status(400).json({
//                 status: "400",
//                 msg: "Some error occurred!",
//               });
//             }
//             bcrypt.hash(req.body.password, salt, (err, hash) => {
//               if (err) {
//                 console.log("bcrypt error = ", err);
//                 res.status(400).json({
//                   status: "400",
//                   msg: "Some error occurred!",
//                 });
//               }

//               if (!hash) {
//                 console.log("Hash could not be generated!");
//                 res.status(400).json({
//                   status: "400",
//                   msg: "Some error occurred!",
//                 });
//               }

//               User.updateOne(
//                 { _id: mongoose.Types.ObjectId(req.body.id) },
//                 {
//                   $set: {
//                     mobile_number: req.body.mobile_number,
//                     name: req.body.name,
//                     password: hash,
//                   },
//                 },
//                 (err, result) => {
//                   if (err) {
//                     res.status(200).json({
//                       status: "400",
//                       msg: "Registeration failed",
//                     });
//                   } else {
//                     return res.status(200).json({
//                       status: "200",
//                       msg: "Sucessfully Registered",
//                     });
//                   }
//                 }
//               );
//             });
//           });

//           //   res.status(200).json({
//           //     status: "200",
//           //     msg: "Email Id is already register",
//           //   });
//         }
//       }
//     );
//   } else {
//     res.status(200).json({
//       status: "400",
//       msg: "Invalid Data",
//     });
//   }
// });

// router.post("/inactiveuser", async (req, res) => {
//   let api_url = process.env.APP_URL;
//   console.log("text", req.body);
//   if (req.body.id != "") {
//     let userdata = { _id: mongoose.Types.ObjectId(req.body.id) };
//     User.findOne(
//       { _id: mongoose.Types.ObjectId(req.body.id) },
//       async (err, result) => {
//         if (err) {
//           res.status(200).json({
//             status: "400",
//             msg: "Something Went Wrong",
//           });
//         }
//         if (!result) {
//           res.status(200).json({
//             status: "400",
//             msg: "Invalid Id",
//           });
//         }
//         if (result) {
//           User.updateOne(
//             { _id: mongoose.Types.ObjectId(req.body.id) },
//             {
//               $set: {
//                 active: 1,
//               },
//             },
//             (err, result) => {
//               if (err) {
//                 res.status(200).json({
//                   status: "400",
//                   msg: "Registeration failed",
//                 });
//               } else {
//                 return res.status(200).json({
//                   status: "200",
//                   msg: "User Inactive Successfully",
//                 });
//               }
//             }
//           );

//           //   res.status(200).json({
//           //     status: "200",
//           //     msg: "Email Id is already register",
//           //   });
//         }
//       }
//     );
//   } else {
//     res.status(200).json({
//       status: "400",
//       msg: "Invalid Data",
//     });
//   }
// });

// router.post("/viewformnew", async (req, res) => {
//   let api_url = process.env.APP_URL;
//   console.log("text", req.body);
//   if (req.body.id != "") {
//     let userdata = { _id: mongoose.Types.ObjectId(req.body.id) };
//     User.findOne(
//       { _id: mongoose.Types.ObjectId(req.body.id) },
//       async (err, result) => {
//         if (err) {
//           res.status(200).json({
//             status: "400",
//             msg: "Something Went Wrong",
//           });
//         }
//         if (!result) {
//           res.status(200).json({
//             status: "400",
//             msg: "Invalid Id",
//           });
//         }
//         if (result) {
//           User.updateOne(
//             { _id: mongoose.Types.ObjectId(req.body.id), status: 0 },
//             {
//               $set: {
//                 status: 1,
//               },
//             },
//             (err, result) => {
//               if (err) {
//                 res.status(200).json({
//                   status: "400",
//                   msg: "Registeration failed",
//                 });
//               } else {
//                 return res.status(200).json({
//                   status: "200",
//                   msg: "Profile Sucessfully Updated",
//                 });
//               }
//             }
//           );

//           //   res.status(200).json({
//           //     status: "200",
//           //     msg: "Email Id is already register",
//           //   });
//         }
//       }
//     );
//   } else {
//     res.status(200).json({
//       status: "400",
//       msg: "Invalid Data",
//     });
//   }
// });

// router.post("/updateprofile", auth, async (req, res) => {
//   let api_url = process.env.APP_URL;
//   console.log("text", req.body);
//   if (
//     req.body.id != "" &&
//     req.body.mobile_number != "" &&
//     req.body.name != ""
//   ) {
//     let userdata = { _id: mongoose.Types.ObjectId(req.body.id) };
//     User.findOne(
//       { _id: mongoose.Types.ObjectId(req.body.id) },
//       async (err, result) => {
//         if (err) {
//           res.status(200).json({
//             status: "400",
//             msg: "Something Went Wrong",
//           });
//         }
//         if (!result) {
//           res.status(200).json({
//             status: "400",
//             msg: "Invalid Id",
//           });
//         }
//         if (result) {
//           const saltRounds = 10;

//           User.updateOne(
//             { _id: mongoose.Types.ObjectId(req.body.id) },
//             {
//               $set: {
//                 mobile_number: req.body.mobile_number,
//                 name: req.body.name,
//               },
//             },
//             (err, result) => {
//               if (err) {
//                 res.status(200).json({
//                   status: "400",
//                   msg: "Registeration failed",
//                 });
//               } else {
//                 return res.status(200).json({
//                   status: "200",
//                   msg: "Profile Sucessfully Updated",
//                 });
//               }
//             }
//           );

//           //   res.status(200).json({
//           //     status: "200",
//           //     msg: "Email Id is already register",
//           //   });
//         }
//       }
//     );
//   } else {
//     res.status(200).json({
//       status: "400",
//       msg: "Invalid Data",
//     });
//   }
// });

// router.post("/registeruser", upload.single("uploads"), async (req, res) => {
//   let Data = JSON.parse(req.body.Data);

//   if (
//     Data.id != "" &&
//     Data.mobile_number != "" &&
//     Data.name != "" &&
//     Data.password != ""
//   ) {
//     let userdata = { _id: mongoose.Types.ObjectId(Data.id) };
//     User.findOne(
//       { _id: mongoose.Types.ObjectId(Data.id) },
//       async (err, result) => {
//         if (err) {
//           res.status(200).json({
//             status: "400",
//             msg: "Something Went Wrong",
//           });
//         }
//         if (!result) {
//           res.status(200).json({
//             status: "400",
//             msg: "Invalid Id",
//           });
//         }
//         if (result) {
//           const saltRounds = 10;

//           bcrypt.genSalt(saltRounds, (err, salt) => {
//             if (err) {
//               console.log(err);
//               res.status(400).json({
//                 status: "400",
//                 msg: "Some error occurred!",
//               });
//             }
//             if (!salt) {
//               console.log("salt false");
//               res.status(400).json({
//                 status: "400",
//                 msg: "Some error occurred!",
//               });
//             }
//             bcrypt.hash(Data.password, salt, async (err, hash) => {
//               if (err) {
//                 console.log("bcrypt error = ", err);
//                 res.status(400).json({
//                   status: "400",
//                   msg: "Some error occurred!",
//                 });
//               }

//               if (!hash) {
//                 console.log("Hash could not be generated!");
//                 res.status(400).json({
//                   status: "400",
//                   msg: "Some error occurred!",
//                 });
//               }

//               User.updateOne(
//                 { _id: mongoose.Types.ObjectId(Data.id) },
//                 {
//                   $set: {
//                     name: Data.name,
//                     password: hash,
//                     surname: Data.surname,
//                     status: "2",
//                   },
//                 },
//                 async (err, result) => {
//                   if (err) {
//                     res.status(200).json({
//                       status: "400",
//                       msg: "Registeration failed",
//                     });
//                   } else {
//                     let dataactivity = {
//                       userid: Data.id,
//                       message: "Registeration Successfully Done",
//                       type: "Registeration",
//                     };

//                     let dataactivity1 = Activity(dataactivity);
//                     let dataactivityresponse = await dataactivity1.save();
//                     return res.status(200).json({
//                       status: "200",
//                       msg: "Sucessfully Registered",
//                     });
//                   }
//                 }
//               );
//             });
//           });

//           //   res.status(200).json({
//           //     status: "200",
//           //     msg: "Email Id is already register",
//           //   });
//         }
//       }
//     );
//   } else {
//     res.status(200).json({
//       status: "400",
//       msg: "Invalid Data",
//     });
//   }
// });

// router.post(
//   "/updateprofileforsubscriber",
//   auth,
//   // upload.multiple("uploads"),
//   // upload.array('uploads', 10),
//   upload.fields([
//     {
//       name: "address_proof",
//       maxCount: 1,
//     },
//     {
//       name: "identity_card",
//       maxCount: 1,
//     },
//   ]),
//   async (req, res) => {
//     let Data = JSON.parse(req.body.Data);

//     if (
//       Data.id != "" &&
//       Data.mobile_number != "" &&
//       Data.name != "" &&
//       Data.type != ""
//     ) {
//       let userdata = { _id: mongoose.Types.ObjectId(Data.id) };
//       User.findOne(
//         { _id: mongoose.Types.ObjectId(Data.id) },
//         async (err, result) => {
//           if (err) {
//             res.status(200).json({
//               status: "400",
//               msg: "Something Went Wrong",
//             });
//           }
//           if (!result) {
//             res.status(200).json({
//               status: "400",
//               msg: "Invalid Id",
//             });
//           }
//           if (result) {
//             if (Data.type == "share") {
//               console.log("file" + JSON.stringify(result));
//               let address_proof;
//               if (req.files.address_proof != undefined) {
//                 address_proof = req.files.address_proof[0].filename;
//               } else {
//                 address_proof = result.address_proof;
//               }
//               let identity_card;
//               if (req.files.identity_card != undefined) {
//                 identity_card = req.files.identity_card[0].filename;
//               } else {
//                 identity_card = result.identity_card;
//               }
//               User.updateOne(
//                 { _id: mongoose.Types.ObjectId(Data.id) },
//                 {
//                   $set: {
//                     mobile_number: Data.mobile_number,
//                     name: Data.name,
//                     own_address: Data.own_address,
//                     namechinese: Data.namechinese,
//                     surname: Data.surname,
//                     // other_name: Data.other_name,
//                     // previous_name: Data.previous_name,
//                     identityno: Data.identityno,
//                     passport_no: Data.passport_no,
//                     company_number: Data.company_number,
//                     office_address: Data.office_address,
//                     office_address1: Data.office_address1,
//                     office_city: Data.office_city,
//                     office_country: Data.office_country,
//                     office_state: Data.office_state,
//                     job_title: Data.job_title,
//                     address_proof: address_proof,
//                     identity_card: identity_card,
//                     status: "3",
//                   },
//                 },
//                 (err, result) => {
//                   if (err) {
//                     res.status(200).json({
//                       status: "400",
//                       msg: "Profile Updated Failed",
//                     });
//                   } else {
//                     return res.status(200).json({
//                       status: "200",
//                       msg: "Profile Sucessfully Updated",
//                     });
//                   }
//                 }
//               );
//             } else if (Data.type == "cs") {
//               console.log("file" + JSON.stringify(result));
//               let address_proof;
//               if (req.files.address_proof != undefined) {
//                 address_proof = req.files.address_proof[0].filename;
//               } else {
//                 address_proof = result.address_proof;
//               }
//               let identity_card;
//               if (req.files.identity_card != undefined) {
//                 identity_card = req.files.identity_card[0].filename;
//               } else {
//                 identity_card = result.identity_card;
//               }
//               User.updateOne(
//                 { _id: mongoose.Types.ObjectId(Data.id) },
//                 {
//                   $set: {
//                     mobile_number: Data.mobile_number,
//                     name: Data.name,
//                     own_address: Data.own_address,
//                     namechinese: Data.namechinese,
//                     surname: Data.surname,
//                     // other_name: Data.other_name,
//                     // previous_name: Data.previous_name,
//                     identityno: Data.identityno,
//                     passport_no: Data.passport_no,
//                     company_number: Data.company_number,
//                     office_address: Data.office_address,
//                     office_address1: Data.office_address1,
//                     office_city: Data.office_city,
//                     office_country: Data.office_country,
//                     office_state: Data.office_state,
//                     job_title: Data.job_title,
//                     address_proof: address_proof,
//                     identity_card: identity_card,
//                     status: "3",
//                   },
//                 },
//                 (err, result) => {
//                   if (err) {
//                     res.status(200).json({
//                       status: "400",
//                       msg: "Profile Updated Failed",
//                     });
//                   } else {
//                     return res.status(200).json({
//                       status: "200",
//                       msg: "Profile Sucessfully Updated",
//                     });
//                   }
//                 }
//               );
//             } else if (Data.type == "director") {
//               console.log("file" + JSON.stringify(result));
//               let address_proof;
//               if (req.files.address_proof != undefined) {
//                 address_proof = req.files.address_proof[0].filename;
//               } else {
//                 address_proof = result.address_proof;
//               }
//               let identity_card;
//               if (req.files.identity_card != undefined) {
//                 identity_card = req.files.identity_card[0].filename;
//               } else {
//                 identity_card = result.identity_card;
//               }
//               User.updateOne(
//                 { _id: mongoose.Types.ObjectId(Data.id) },
//                 {
//                   $set: {
//                     mobile_number: Data.mobile_number,
//                     name: Data.name,
//                     own_address: Data.own_address,
//                     namechinese: Data.namechinese,
//                     surname: Data.surname,
//                     // other_name: Data.other_name,
//                     // previous_name: Data.previous_name,
//                     identityno: Data.identityno,
//                     passport_no: Data.passport_no,
//                     company_number: Data.company_number,
//                     office_address: Data.office_address,
//                     office_address1: Data.office_address1,
//                     office_city: Data.office_city,
//                     office_country: Data.office_country,
//                     office_state: Data.office_state,
//                     job_title: Data.job_title,
//                     address_proof: address_proof,
//                     identity_card: identity_card,
//                     status: "3",
//                   },
//                 },
//                 (err, result) => {
//                   if (err) {
//                     res.status(200).json({
//                       status: "400",
//                       msg: "Profile Updated Failed",
//                     });
//                   } else {
//                     return res.status(200).json({
//                       status: "200",
//                       msg: "Profile Sucessfully Updated",
//                     });
//                   }
//                 }
//               );
//             } else {
//               if (req.file) {
//                 User.updateOne(
//                   { _id: mongoose.Types.ObjectId(Data.id) },
//                   {
//                     $set: {
//                       mobile_number: Data.mobile_number,
//                       name: Data.name,
//                       corporate_name: Data.corporate_name,
//                       coporate_address: Data.coporate_address,
//                       corporate_email: Data.corporate_email,
//                       identityno: Data.identityno,
//                       passport_no: Data.passport_no,
//                       address_proof: req.file.filename,
//                     },
//                   },
//                   (err, result) => {
//                     if (err) {
//                       res.status(200).json({
//                         status: "400",
//                         msg: "Profile Updated Failed",
//                       });
//                     } else {
//                       return res.status(200).json({
//                         status: "200",
//                         msg: "Profile Sucessfully Updated",
//                       });
//                     }
//                   }
//                 );
//               } else {
//                 User.updateOne(
//                   { _id: mongoose.Types.ObjectId(Data.id) },
//                   {
//                     $set: {
//                       mobile_number: Data.mobile_number,
//                       name: Data.name,
//                       corporate_name: Data.corporate_name,
//                       coporate_address: Data.coporate_address,
//                       corporate_email: Data.corporate_email,
//                       identityno: Data.identityno,
//                       passport_no: Data.passport_no,
//                     },
//                   },
//                   (err, result) => {
//                     if (err) {
//                       res.status(200).json({
//                         status: "400",
//                         msg: "Profile Updated Failed",
//                       });
//                     } else {
//                       return res.status(200).json({
//                         status: "200",
//                         msg: "Profile Sucessfully Updated",
//                       });
//                     }
//                   }
//                 );
//               }
//             }

//             if (Data.id == Data.loginid) {
//               let dataactivity = {
//                 userid: Data.id,
//                 message: "Profile Updated by own",
//                 type: "profile_updated",
//               };
//               let dataactivity1 = Activity(dataactivity);
//               let dataactivityresponse = await dataactivity1.save();
//             } else {
//               let dataactivity = {
//                 userid: Data.id,
//                 message: "Profile Updated by subscriber",
//                 type: "profile_updated",
//               };
//               let dataactivity1 = Activity(dataactivity);
//               let dataactivityresponse = await dataactivity1.save();
//             }

//             //   res.status(200).json({
//             //     status: "200",
//             //     msg: "Email Id is already register",
//             //   });
//           }
//         }
//       );
//     } else {
//       res.status(200).json({
//         status: "400",
//         msg: "Invalid Data",
//       });
//     }
//   }
// );

// router.post("/checkesign", auth, async (req, res) => {
//   Esign.find(
//     {
//       userid: mongoose.Types.ObjectId(req.body.userid),
//       company_id: mongoose.Types.ObjectId(req.body.company_id),
//     },
//     async (err, result) => {
//       if (err) {
//         res.status(200).json({
//           status: "400",
//           msg: "Something went wrong",
//         });
//       }

//       if (result.length > 0) {
//         res.status(200).json({
//           status: "200",
//           msg: "Data Found",
//           result: result,
//         });
//       } else {
//         res.status(200).json({
//           status: "400",
//           msg: "No Data Found",
//         });
//       }
//     }
//   );
// });
// router.post("/esignlist", auth, async (req, res) => {
//   let data = "";
//   if (req.body.sign == "esign") {
//     data = {
//       company_id: mongoose.Types.ObjectId(req.body.company_id),
//       sendemailesign: "1",
//     };
//   } else {
//     data = {
//       company_id: mongoose.Types.ObjectId(req.body.company_id),
//       sendemailgsign: "1",
//     };
//   }

//   Esign.find(data, async (err, result) => {
//     if (err) {
//       res.status(200).json({
//         status: "400",
//         msg: "Something went wrong",
//       });
//     }

//     if (result.length > 0) {
//       res.status(200).json({
//         status: "200",
//         msg: "Data Found",
//         result: result,
//       });
//     } else {
//       res.status(200).json({
//         status: "400",
//         msg: "No Data Found",
//       });
//     }
//   }).populate("userid");
// });

// router.post(
//   "/createesignforcompanyincorporation",
//   upload.single("esign"),
//   auth,
//   async (req, res) => {
//     let createdby = req.decoded.id;
//     let company_id = req.body.company_id;
//     if (createdby != "") {
//       let userdata = req.body;
//       User.findOne(
//         { _id: mongoose.Types.ObjectId(createdby) },
//         async (err, result) => {
//           if (err) {
//             res.status(200).json({
//               status: "400",
//               msg: "Something Went Wrong",
//             });
//           }
//           console.log(result);
//           if (result) {
//             let finddata = {
//               company_id: mongoose.Types.ObjectId(company_id),
//               userid: mongoose.Types.ObjectId(createdby),
//             };

//             Esign.findOne(finddata, async (esignerr, esignresult) => {
//               if (esignerr) {
//                 console.log("esignforcompanyinfo" + esignerr);
//               }
//               console.log(
//                 "esignforcompanyinfo" + esignresult + company_id + createdby
//               );
//               if (esignresult.esignforcompanyinfo != "") {
//                 let filePath =
//                   liveurlnew + "/esign/" + esignresult.esignforcompanyinfo;
//                 fs.unlinkSync(filePath);
//               }
//               esign = req.file.filename;
//               Esign.updateOne(
//                 { _id: mongoose.Types.ObjectId(esignresult._id) },
//                 {
//                   $set: {
//                     esignforcompanyinfo: esign,
//                   },
//                 },
//                 (err, result) => {
//                   if (err) {
//                     res.status(200).json({
//                       status: "400",
//                       msg: "Updation failed",
//                     });
//                   } else {
//                     return res.status(200).json({
//                       status: "200",
//                       result: result,
//                       msg: "Sucessfully Signed",
//                     });
//                   }
//                 }
//               );
//             });

//             // console.log(result.esignforcompanyinfo)
//             // if(result.esignforcompanyinfo)
//             // {
//             // let filePath = liveurlnew+'/esign/'+result.esignforcompanyinfo;
//             // fs.unlinkSync(filePath);
//             // }
//             // esign=req.file.filename;
//             //   let company_logo;
//             //     User.updateOne(
//             //       { _id: mongoose.Types.ObjectId(createdby) },
//             //       {
//             //         $set: {
//             //           esignforcompanyinfo: esign,
//             //         },
//             //       },
//             //       (err, result) => {
//             //         if (err) {
//             //           res.status(200).json({
//             //             status: "400",
//             //             msg: "Updation failed",
//             //           });
//             //         } else {
//             //           return res.status(200).json({
//             //             status: "200",
//             //             msg: "Sucessfully Signed",
//             //           });
//             //         }
//             //       }
//             //     );
//           }
//           if (!result) {
//             res.status(200).json({
//               status: "400",
//               msg: "Invalid User",
//             });
//           }
//         }
//       );
//     } else {
//       res.status(200).json({
//         status: "400",
//         msg: "Invalid Data",
//       });
//     }
//   }
// );

// router.post(
//   "/creategsignforcompanyincorporation",
//   upload.single("gsign"),
//   auth,
//   async (req, res) => {
//     let createdby = req.decoded.id;
//     let company_id = req.body.company_id;
//     if (createdby != "") {
//       let userdata = req.body;
//       User.findOne(
//         { _id: mongoose.Types.ObjectId(createdby) },
//         async (err, result) => {
//           if (err) {
//             res.status(200).json({
//               status: "400",
//               msg: "Something Went Wrong",
//             });
//           }
//           console.log(result);
//           if (result) {
//             let finddata = {
//               company_id: mongoose.Types.ObjectId(company_id),
//               userid: mongoose.Types.ObjectId(createdby),
//             };

//             Esign.findOne(finddata, async (esignerr, esignresult) => {
//               if (esignerr) {
//                 console.log("gsignforcompanyinfo" + esignerr);
//               }
//               console.log(
//                 "gsignforcompanyinfo" + esignresult + company_id + createdby
//               );
//               if (esignresult.gsignforcompanyinfo != "") {
//                 let filePath =
//                   liveurlnew + "/gsign/" + esignresult.gsignforcompanyinfo;
//                 fs.unlinkSync(filePath);
//               }
//               esign = req.file.filename;
//               Esign.updateOne(
//                 { _id: mongoose.Types.ObjectId(esignresult._id) },
//                 {
//                   $set: {
//                     gsignforcompanyinfo: esign,
//                   },
//                 },
//                 (err, result) => {
//                   if (err) {
//                     res.status(200).json({
//                       status: "400",
//                       msg: "Updation failed",
//                     });
//                   } else {
//                     return res.status(200).json({
//                       status: "200",
//                       msg: "Sucessfully Uploaded",
//                     });
//                   }
//                 }
//               );
//             });

//             // console.log(result.esignforcompanyinfo)
//             // if(result.esignforcompanyinfo)
//             // {
//             // let filePath = liveurlnew+'/esign/'+result.esignforcompanyinfo;
//             // fs.unlinkSync(filePath);
//             // }
//             // esign=req.file.filename;
//             //   let company_logo;
//             //     User.updateOne(
//             //       { _id: mongoose.Types.ObjectId(createdby) },
//             //       {
//             //         $set: {
//             //           esignforcompanyinfo: esign,
//             //         },
//             //       },
//             //       (err, result) => {
//             //         if (err) {
//             //           res.status(200).json({
//             //             status: "400",
//             //             msg: "Updation failed",
//             //           });
//             //         } else {
//             //           return res.status(200).json({
//             //             status: "200",
//             //             msg: "Sucessfully Signed",
//             //           });
//             //         }
//             //       }
//             //     );
//           }
//           if (!result) {
//             res.status(200).json({
//               status: "400",
//               msg: "Invalid User",
//             });
//           }
//         }
//       );
//     } else {
//       res.status(200).json({
//         status: "400",
//         msg: "Invalid Data",
//       });
//     }
//   }
// );

// router.post("/adduserbysubscriber", async (req, res) => {
//   let api_url = process.env.APP_URL;
//   let liveAPP_URL = process.env.liveAPP_URL;
//   console.log("text", req.body);
//   if (req.body.companyid != "" && req.body.caname != "") {
//     let transporter = nodemailer.createTransport({
//       host: "smtp.gmail.com",
//       port: 465,
//       secure: true,
//       auth: {
//         user: "chandank@synram.co",
//         pass: "Synram@125",
//         // user: "vikas@synram.co",
//         // pass: "Synram@2019",
//       },
//     });
//     for (let sh = 0; sh < req.body.shareholder.length; sh++) {
//       if (
//         req.body.shareholder[sh].shareemail != "" &&
//         req.body.shareholder[sh].sharefirst_name != ""
//       ) {
//         let userdata = {
//           email: req.body.shareholder[sh].shareemail,
//           name: req.body.shareholder[sh].sharefirst_name,
//           surname: req.body.shareholder[sh].sharelast_name,
//           mobile_number: "",
//           companyid: mongoose.Types.ObjectId(req.body.companyid),
//           roles: "Shareholder",
//           typeofuser: "Natural Person",
//           firstperson: sh + 1,
//           password: "",
//         };

//         User.findOne(
//           { email: req.body.shareholder[sh].shareemail },
//           async (err, share) => {
//             if (err) {
//               // res.status(200).json({
//               //   status: "400",
//               //   msg: "Something Went Wrong",
//               // });
//             }
//             if (!share) {
//               let usershare = User(userdata);
//               let resultshare = await usershare.save();

//               if (resultshare) {
//                 let newcapital = [];

//                 for (
//                   let capitalnew = 0;
//                   capitalnew < companycapital.length;
//                   capitalnew++
//                 ) {
//                   newcapital.push({
//                     share_class: companycapital[capitalnew].share_class,
//                     total_share: "",
//                     total_amount_paid: "",
//                     currency: "HKD",
//                   });
//                 }
//                 let shareholdercapital = {
//                   companyid: mongoose.Types.ObjectId(req.body.companyid),
//                   userid: mongoose.Types.ObjectId(resultshare._id),
//                   capital: newcapital,
//                 };
//                 let shareholdercapitaldata =
//                   Shareholdercapital(shareholdercapital);
//                 let shareholdercapitalreponse =
//                   await shareholdercapitaldata.save();
//                 let mailOptionsshare = {
//                   from: "vikas@synram.co",
//                   to: req.body.shareholder[sh].shareemail,
//                   subject:
//                     "" +
//                     req.body.caname +
//                     " has invited you to collaborate as a Shareholder ",
//                   html:
//                     "<!DOCTYPE html>" +
//                     "<html><head>" +
//                     "    <title>ComSec360 Invitation</title>" +
//                     '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
//                     "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
//                     '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
//                     '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
//                     '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
//                     '    <style type="text/css">' +
//                     "     " +
//                     "        /* CLIENT-SPECIFIC STYLES */" +
//                     "        body," +
//                     "        table," +
//                     "        td," +
//                     "        a {" +
//                     "            -webkit-text-size-adjust: 100%;" +
//                     "            -ms-text-size-adjust: 100%;" +
//                     "        }" +
//                     "" +
//                     "        table," +
//                     "        td {" +
//                     "            mso-table-lspace: 0pt;" +
//                     "            mso-table-rspace: 0pt;" +
//                     "        }" +
//                     "" +
//                     "        img {" +
//                     "            -ms-interpolation-mode: bicubic;" +
//                     "        }" +
//                     "" +
//                     "        /* RESET STYLES */" +
//                     "        img {" +
//                     "            border: 0;" +
//                     "            height: auto;" +
//                     "            line-height: 100%;" +
//                     "            outline: none;" +
//                     "            text-decoration: none;" +
//                     "        }" +
//                     "" +
//                     "        table {" +
//                     "            border-collapse: collapse !important;" +
//                     "        }" +
//                     "" +
//                     "        body {" +
//                     "            height: 100% !important;" +
//                     "            margin: 0 !important;" +
//                     "            padding: 0 !important;" +
//                     "            width: 100% !important;" +
//                     "        }" +
//                     "" +
//                     "        /* iOS BLUE LINKS */" +
//                     "        a[x-apple-data-detectors] {" +
//                     "            color: inherit !important;" +
//                     "            text-decoration: none !important;" +
//                     "            font-size: inherit !important;" +
//                     "            font-family: inherit !important;" +
//                     "            font-weight: inherit !important;" +
//                     "            line-height: inherit !important;" +
//                     "        }" +
//                     "" +
//                     "        /* MOBILE STYLES */" +
//                     "        @media screen and (max-width:600px) {" +
//                     "            h1 {" +
//                     "                font-size: 32px !important;" +
//                     "                line-height: 32px !important;" +
//                     "            }" +
//                     "        }" +
//                     "" +
//                     "        /* ANDROID CENTER FIX */" +
//                     '        div[style*="margin: 16px 0;"] {' +
//                     "            margin: 0 !important;" +
//                     "        }" +
//                     "    </style>" +
//                     "</head>" +
//                     " <style>" +
//                     " #para_text {" +
//                     "  padding: 0px 20px;" +
//                     "  color: #111111;" +
//                     "  font-family: 'Raleway Light', Arial, sans-serif;" +
//                     "  font-size: 1.5em;" +
//                     "  text-align: center;" +
//                     "}" +
//                     "#grad1 {" +
//                     "  background-color: #E5E5E5;" +
//                     "}" +
//                     "#link_social" +
//                     "{" +
//                     "	padding: 5px;" +
//                     "	color: #666666;" +
//                     "}" +
//                     "</style>" +
//                     '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
//                     "    " +
//                     '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "        <!-- LOGO -->" +
//                     "        <tbody><tr>" +
//                     "           " +
//                     '<td align="center">' +
//                     '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "                    <tbody><tr>" +
//                     '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
//                     "                    </tr>" +
//                     "                </tbody></table>" +
//                     "            </td>" +
//                     "        </tr>" +
//                     "        <tr>" +
//                     '            <td align="center">' +
//                     '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "                    <tbody><tr>" +
//                     '                        <td style="padding: 30px;  " valign="top" align="center">' +
//                     '                           <img style="max-width: 29%; max-height: 50%; " src="' +
//                     api_url +
//                     '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
//                     "                        </td>" +
//                     "                    </tr>" +
//                     "                </tbody></table>" +
//                     "            </td>" +
//                     "        </tr>" +
//                     "        " +
//                     "		<!-- MESSAGE -->" +
//                     "		<tr>" +
//                     '        <td align="center">' +
//                     '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "        <tbody>" +
//                     "		<tr>" +
//                     '            <td align="center">' +
//                     '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "                    <tbody>" +
//                     "					<tr>" +
//                     '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
//                     "                           <h1>CA " +
//                     req.body.caname +
//                     " has invited you to collaborate as a Shareholder in " +
//                     liveAPP_URL +
//                     "</h1>" +
//                     "						   " +
//                     "						" +
//                     "						   " +
//                     '							<a href="' +
//                     api_url +
//                     "/registeration/" +
//                     resultshare._id +
//                     '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">Accept Invitation</a>' +
//                     '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
//                     '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
//                     liveAPP_URL +
//                     "</p>" +
//                     '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
//                     req.body.shareholder[sh].shareemail +
//                     "</p>" +
//                     "                        </td>" +
//                     "" +
//                     "                    </tr><tr><td><hr><td></tr>" +
//                     "" +
//                     "                </tbody></table>" +
//                     "            </td>" +
//                     "        </tr>" +
//                     "		</tbody>" +
//                     "		</table>" +
//                     "        </td>" +
//                     "        </tr>" +
//                     "        <tr>" +
//                     '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
//                     '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "                <tbody>" +
//                     "				" +
//                     "					<tr>" +
//                     '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
//                     "				" +
//                     "			" +
//                     "				" +
//                     "				<!-- COPYRIGHT TEXT -->" +
//                     '					<p id="footer_text">' +
//                     "If you have any questions you can get in touch at support.comsec360.com</p>" +
//                     "					<p>© 2021 ComSec360</p>" +
//                     "                    </td>" +
//                     "                    </tr>" +
//                     "				" +
//                     "	" +
//                     "                </tbody>" +
//                     "				</table>" +
//                     "            </td>" +
//                     "        </tr>" +
//                     "    </tbody></table>" +
//                     "" +
//                     "" +
//                     "</body></html>",
//                 };

//                 transporter.sendMail(mailOptionsshare, function (error, info) {
//                   if (error) {
//                     console.log("error" + error);
//                   } else {
//                     console.log("Email sent: " + info.response);
//                   }
//                 });
//                 // res.status(200).json({
//                 //   status: "200",
//                 //   msg: "Successfully Added",
//                 //   result: resultusernew,
//                 // });
//                 // res.status(200).json({
//                 //   status: "200",
//                 //   msg: "Successfully Invited",
//                 //   result: resultuser,
//                 // });
//               } else {
//                 // res.status(200).json({
//                 //   status: "400",
//                 //   msg: "Something Went Wrong",
//                 // });
//               }
//             }
//             if (share) {
//               let companyid = share.companyid;
//               if (companyid.includes(req.body.companyid)) {
//               } else {
//                 companyid.push(mongoose.Types.ObjectId(req.body.companyid));
//                 User.updateOne(
//                   { email: req.body.shareholder[sh].shareemail },
//                   {
//                     $set: {
//                       companyid: companyid,
//                     },
//                   },
//                   (err, result) => {
//                     if (err) {
//                       // res.status(200).json({
//                       //   status: "400",
//                       //   msg: "Updation failed",
//                       // });
//                     } else {
//                       // return res.status(200).json({
//                       //   status: "200",
//                       //   msg: "Sucessfully Updated",
//                       // });
//                     }
//                   }
//                 );

//                 let shareholdercapital = {
//                   companyid: mongoose.Types.ObjectId(req.body.companyid),
//                   userid: mongoose.Types.ObjectId(share._id),
//                   capital: [
//                     {
//                       share_class: "Ordinary",
//                       total_share: "",
//                       total_amount_paid: "",
//                       currency: "HKD",
//                     },
//                     {
//                       share_class: "Preference",
//                       total_share: "",
//                       total_amount_paid: "",
//                       currency: "HKD",
//                     },
//                   ],
//                 };
//                 let shareholdercapitaldata =
//                   Shareholdercapital(shareholdercapital);
//                 let shareholdercapitalreponse =
//                   await shareholdercapitaldata.save();

//                 let mailOptionsshare = {
//                   from: "chandank@synram.co",
//                   to: req.body.shareholder[sh].shareemail,
//                   subject:
//                     "" +
//                     req.body.caname +
//                     " has invited you to collaborate as a Shareholder ",
//                   html:
//                     "<!DOCTYPE html>" +
//                     "<html><head>" +
//                     "    <title>ComSec360 Invitation</title>" +
//                     '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
//                     "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
//                     '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
//                     '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
//                     '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
//                     '    <style type="text/css">' +
//                     "     " +
//                     "        /* CLIENT-SPECIFIC STYLES */" +
//                     "        body," +
//                     "        table," +
//                     "        td," +
//                     "        a {" +
//                     "            -webkit-text-size-adjust: 100%;" +
//                     "            -ms-text-size-adjust: 100%;" +
//                     "        }" +
//                     "" +
//                     "        table," +
//                     "        td {" +
//                     "            mso-table-lspace: 0pt;" +
//                     "            mso-table-rspace: 0pt;" +
//                     "        }" +
//                     "" +
//                     "        img {" +
//                     "            -ms-interpolation-mode: bicubic;" +
//                     "        }" +
//                     "" +
//                     "        /* RESET STYLES */" +
//                     "        img {" +
//                     "            border: 0;" +
//                     "            height: auto;" +
//                     "            line-height: 100%;" +
//                     "            outline: none;" +
//                     "            text-decoration: none;" +
//                     "        }" +
//                     "" +
//                     "        table {" +
//                     "            border-collapse: collapse !important;" +
//                     "        }" +
//                     "" +
//                     "        body {" +
//                     "            height: 100% !important;" +
//                     "            margin: 0 !important;" +
//                     "            padding: 0 !important;" +
//                     "            width: 100% !important;" +
//                     "        }" +
//                     "" +
//                     "        /* iOS BLUE LINKS */" +
//                     "        a[x-apple-data-detectors] {" +
//                     "            color: inherit !important;" +
//                     "            text-decoration: none !important;" +
//                     "            font-size: inherit !important;" +
//                     "            font-family: inherit !important;" +
//                     "            font-weight: inherit !important;" +
//                     "            line-height: inherit !important;" +
//                     "        }" +
//                     "" +
//                     "        /* MOBILE STYLES */" +
//                     "        @media screen and (max-width:600px) {" +
//                     "            h1 {" +
//                     "                font-size: 32px !important;" +
//                     "                line-height: 32px !important;" +
//                     "            }" +
//                     "        }" +
//                     "" +
//                     "        /* ANDROID CENTER FIX */" +
//                     '        div[style*="margin: 16px 0;"] {' +
//                     "            margin: 0 !important;" +
//                     "        }" +
//                     "    </style>" +
//                     "</head>" +
//                     " <style>" +
//                     " #para_text {" +
//                     "  padding: 0px 20px;" +
//                     "  color: #111111;" +
//                     "  font-family: 'Raleway Light', Arial, sans-serif;" +
//                     "  font-size: 1.5em;" +
//                     "  text-align: center;" +
//                     "}" +
//                     "#grad1 {" +
//                     "  background-color: #E5E5E5;" +
//                     "}" +
//                     "#link_social" +
//                     "{" +
//                     "	padding: 5px;" +
//                     "	color: #666666;" +
//                     "}" +
//                     "</style>" +
//                     '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
//                     "    " +
//                     '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "        <!-- LOGO -->" +
//                     "        <tbody><tr>" +
//                     "           " +
//                     '<td align="center">' +
//                     '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "                    <tbody><tr>" +
//                     '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
//                     "                    </tr>" +
//                     "                </tbody></table>" +
//                     "            </td>" +
//                     "        </tr>" +
//                     "        <tr>" +
//                     '            <td align="center">' +
//                     '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "                    <tbody><tr>" +
//                     '                        <td style="padding: 30px;  " valign="top" align="center">' +
//                     '                           <img style="max-width: 29%; max-height: 50%; " src="' +
//                     api_url +
//                     '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
//                     "                        </td>" +
//                     "                    </tr>" +
//                     "                </tbody></table>" +
//                     "            </td>" +
//                     "        </tr>" +
//                     "        " +
//                     "		<!-- MESSAGE -->" +
//                     "		<tr>" +
//                     '        <td align="center">' +
//                     '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "        <tbody>" +
//                     "		<tr>" +
//                     '            <td align="center">' +
//                     '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "                    <tbody>" +
//                     "					<tr>" +
//                     '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
//                     "                           <h1>CA " +
//                     req.body.caname +
//                     " has invited you to collaborate as a Shareholder in " +
//                     liveAPP_URL +
//                     "</h1>" +
//                     "						   " +
//                     "						" +
//                     "						   " +
//                     '							<a href="' +
//                     api_url +
//                     "/registeration/" +
//                     resultshare._id +
//                     '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">Accept Invitation</a>' +
//                     '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
//                     '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
//                     liveAPP_URL +
//                     "</p>" +
//                     '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
//                     req.body.shareholder[sh].shareemail +
//                     "</p>" +
//                     "                        </td>" +
//                     "" +
//                     "                    </tr><tr><td><hr><td></tr>" +
//                     "" +
//                     "                </tbody></table>" +
//                     "            </td>" +
//                     "        </tr>" +
//                     "		</tbody>" +
//                     "		</table>" +
//                     "        </td>" +
//                     "        </tr>" +
//                     "        <tr>" +
//                     '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
//                     '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "                <tbody>" +
//                     "				" +
//                     "					<tr>" +
//                     '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
//                     "				" +
//                     "			" +
//                     "				" +
//                     "				<!-- COPYRIGHT TEXT -->" +
//                     '					<p id="footer_text">' +
//                     "If you have any questions you can get in touch at support.comsec360.com</p>" +
//                     "					<p>© 2021 ComSec360</p>" +
//                     "                    </td>" +
//                     "                    </tr>" +
//                     "				" +
//                     "	" +
//                     "                </tbody>" +
//                     "				</table>" +
//                     "            </td>" +
//                     "        </tr>" +
//                     "    </tbody></table>" +
//                     "" +
//                     "" +
//                     "</body></html>",
//                 };

//                 transporter.sendMail(mailOptionsshare, function (error, info) {
//                   if (error) {
//                     console.log("error" + error);
//                   } else {
//                     console.log("Email sent: " + info.response);
//                   }
//                 });
//               }
//             }
//           }
//         );
//       }
//     }

//     for (let sh = 0; sh < req.body.director.length; sh++) {
//       if (
//         req.body.director[sh].directoremail != "" &&
//         req.body.director[sh].directorfirst_name != ""
//       ) {
//         let userdata = {
//           email: req.body.director[sh].directoremail,
//           name: req.body.director[sh].directorfirst_name,
//           surname: req.body.director[sh].directorlast_name,
//           mobile_number: "",
//           companyid: mongoose.Types.ObjectId(req.body.companyid),
//           roles: "Director",
//           typeofuser: "Natural Person",
//           firstperson: sh + 1,
//           password: "",
//         };
//         User.findOne(
//           { email: req.body.director[sh].directoremail },
//           async (err, director) => {
//             if (err) {
//               // res.status(200).json({
//               //   status: "400",
//               //   msg: "Something Went Wrong",
//               // });
//             }
//             if (!director) {
//               let userdirector = User(userdata);
//               let resultdirector = await userdirector.save();

//               if (resultdirector) {
//                 let mailOptionsdirector = {
//                   from: "vikas@synram.co",
//                   to: req.body.director[sh].directoremail,
//                   subject:
//                     "" +
//                     req.body.caname +
//                     " has invited you to collaborate as a Director ",
//                   html:
//                     "<!DOCTYPE html>" +
//                     "<html><head>" +
//                     "    <title>ComSec360 Invitation</title>" +
//                     '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
//                     "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
//                     '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
//                     '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
//                     '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
//                     '    <style type="text/css">' +
//                     "     " +
//                     "        /* CLIENT-SPECIFIC STYLES */" +
//                     "        body," +
//                     "        table," +
//                     "        td," +
//                     "        a {" +
//                     "            -webkit-text-size-adjust: 100%;" +
//                     "            -ms-text-size-adjust: 100%;" +
//                     "        }" +
//                     "" +
//                     "        table," +
//                     "        td {" +
//                     "            mso-table-lspace: 0pt;" +
//                     "            mso-table-rspace: 0pt;" +
//                     "        }" +
//                     "" +
//                     "        img {" +
//                     "            -ms-interpolation-mode: bicubic;" +
//                     "        }" +
//                     "" +
//                     "        /* RESET STYLES */" +
//                     "        img {" +
//                     "            border: 0;" +
//                     "            height: auto;" +
//                     "            line-height: 100%;" +
//                     "            outline: none;" +
//                     "            text-decoration: none;" +
//                     "        }" +
//                     "" +
//                     "        table {" +
//                     "            border-collapse: collapse !important;" +
//                     "        }" +
//                     "" +
//                     "        body {" +
//                     "            height: 100% !important;" +
//                     "            margin: 0 !important;" +
//                     "            padding: 0 !important;" +
//                     "            width: 100% !important;" +
//                     "        }" +
//                     "" +
//                     "        /* iOS BLUE LINKS */" +
//                     "        a[x-apple-data-detectors] {" +
//                     "            color: inherit !important;" +
//                     "            text-decoration: none !important;" +
//                     "            font-size: inherit !important;" +
//                     "            font-family: inherit !important;" +
//                     "            font-weight: inherit !important;" +
//                     "            line-height: inherit !important;" +
//                     "        }" +
//                     "" +
//                     "        /* MOBILE STYLES */" +
//                     "        @media screen and (max-width:600px) {" +
//                     "            h1 {" +
//                     "                font-size: 32px !important;" +
//                     "                line-height: 32px !important;" +
//                     "            }" +
//                     "        }" +
//                     "" +
//                     "        /* ANDROID CENTER FIX */" +
//                     '        div[style*="margin: 16px 0;"] {' +
//                     "            margin: 0 !important;" +
//                     "        }" +
//                     "    </style>" +
//                     "</head>" +
//                     " <style>" +
//                     " #para_text {" +
//                     "  padding: 0px 20px;" +
//                     "  color: #111111;" +
//                     "  font-family: 'Raleway Light', Arial, sans-serif;" +
//                     "  font-size: 1.5em;" +
//                     "  text-align: center;" +
//                     "}" +
//                     "#grad1 {" +
//                     "  background-color: #E5E5E5;" +
//                     "}" +
//                     "#link_social" +
//                     "{" +
//                     "	padding: 5px;" +
//                     "	color: #666666;" +
//                     "}" +
//                     "</style>" +
//                     '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
//                     "    " +
//                     '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "        <!-- LOGO -->" +
//                     "        <tbody><tr>" +
//                     "           " +
//                     '<td align="center">' +
//                     '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "                    <tbody><tr>" +
//                     '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
//                     "                    </tr>" +
//                     "                </tbody></table>" +
//                     "            </td>" +
//                     "        </tr>" +
//                     "        <tr>" +
//                     '            <td align="center">' +
//                     '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "                    <tbody><tr>" +
//                     '                        <td style="padding: 30px;  " valign="top" align="center">' +
//                     '                           <img style="max-width: 29%; max-height: 50%; " src="' +
//                     api_url +
//                     '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
//                     "                        </td>" +
//                     "                    </tr>" +
//                     "                </tbody></table>" +
//                     "            </td>" +
//                     "        </tr>" +
//                     "        " +
//                     "		<!-- MESSAGE -->" +
//                     "		<tr>" +
//                     '        <td align="center">' +
//                     '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "        <tbody>" +
//                     "		<tr>" +
//                     '            <td align="center">' +
//                     '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "                    <tbody>" +
//                     "					<tr>" +
//                     '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
//                     "                           <h1>CA " +
//                     req.body.caname +
//                     " has invited you to collaborate as a Director in " +
//                     liveAPP_URL +
//                     "</h1>" +
//                     "						   " +
//                     "						" +
//                     "						   " +
//                     '							<a href="' +
//                     api_url +
//                     "/registeration/" +
//                     resultdirector._id +
//                     '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">Accept Invitation</a>' +
//                     '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
//                     '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
//                     liveAPP_URL +
//                     "</p>" +
//                     '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
//                     req.body.director[sh].directoremail +
//                     "</p>" +
//                     "                        </td>" +
//                     "" +
//                     "                    </tr><tr><td><hr><td></tr>" +
//                     "" +
//                     "                </tbody></table>" +
//                     "            </td>" +
//                     "        </tr>" +
//                     "		</tbody>" +
//                     "		</table>" +
//                     "        </td>" +
//                     "        </tr>" +
//                     "        <tr>" +
//                     '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
//                     '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "                <tbody>" +
//                     "				" +
//                     "					<tr>" +
//                     '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
//                     "				" +
//                     "			" +
//                     "				" +
//                     "				<!-- COPYRIGHT TEXT -->" +
//                     '					<p id="footer_text">' +
//                     "If you have any questions you can get in touch at support.comsec360.com</p>" +
//                     "					<p>© 2021 ComSec360</p>" +
//                     "                    </td>" +
//                     "                    </tr>" +
//                     "				" +
//                     "	" +
//                     "                </tbody>" +
//                     "				</table>" +
//                     "            </td>" +
//                     "        </tr>" +
//                     "    </tbody></table>" +
//                     "" +
//                     "" +
//                     "</body></html>",
//                 };

//                 transporter.sendMail(
//                   mailOptionsdirector,
//                   function (error, info) {
//                     if (error) {
//                       console.log("error" + error);
//                     } else {
//                       console.log("Email sent: " + info.response);
//                     }
//                   }
//                 );
//                 // res.status(200).json({
//                 //   status: "200",
//                 //   msg: "Successfully Added",
//                 //   result: resultusernew,
//                 // });
//                 // res.status(200).json({
//                 //   status: "200",
//                 //   msg: "Successfully Invited",
//                 //   result: resultuser,
//                 // });
//               } else {
//                 res.status(200).json({
//                   status: "400",
//                   msg: "Something Went Wrong",
//                 });
//               }
//             }
//             if (director) {
//               let companyid = director.companyid;
//               if (companyid.includes(req.body.companyid)) {
//               } else {
//                 companyid.push(mongoose.Types.ObjectId(req.body.companyid));

//                 User.updateOne(
//                   { email: req.body.director[sh].directoremail },
//                   {
//                     $set: {
//                       companyid: companyid,
//                     },
//                   },
//                   (err, result) => {
//                     if (err) {
//                       // res.status(200).json({
//                       //   status: "400",
//                       //   msg: "Updation failed",
//                       // });
//                     } else {
//                       // return res.status(200).json({
//                       //   status: "200",
//                       //   msg: "Sucessfully Updated",
//                       // });
//                     }
//                   }
//                 );

//                 let mailOptionsdirector = {
//                   from: "vikas@synram.co",
//                   to: req.body.director[sh].directoremail,
//                   subject:
//                     "" +
//                     req.body.caname +
//                     " has invited you to collaborate as a Director ",
//                   html:
//                     "<!DOCTYPE html>" +
//                     "<html><head>" +
//                     "    <title>ComSec360 Invitation</title>" +
//                     '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
//                     "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
//                     '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
//                     '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
//                     '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
//                     '    <style type="text/css">' +
//                     "     " +
//                     "        /* CLIENT-SPECIFIC STYLES */" +
//                     "        body," +
//                     "        table," +
//                     "        td," +
//                     "        a {" +
//                     "            -webkit-text-size-adjust: 100%;" +
//                     "            -ms-text-size-adjust: 100%;" +
//                     "        }" +
//                     "" +
//                     "        table," +
//                     "        td {" +
//                     "            mso-table-lspace: 0pt;" +
//                     "            mso-table-rspace: 0pt;" +
//                     "        }" +
//                     "" +
//                     "        img {" +
//                     "            -ms-interpolation-mode: bicubic;" +
//                     "        }" +
//                     "" +
//                     "        /* RESET STYLES */" +
//                     "        img {" +
//                     "            border: 0;" +
//                     "            height: auto;" +
//                     "            line-height: 100%;" +
//                     "            outline: none;" +
//                     "            text-decoration: none;" +
//                     "        }" +
//                     "" +
//                     "        table {" +
//                     "            border-collapse: collapse !important;" +
//                     "        }" +
//                     "" +
//                     "        body {" +
//                     "            height: 100% !important;" +
//                     "            margin: 0 !important;" +
//                     "            padding: 0 !important;" +
//                     "            width: 100% !important;" +
//                     "        }" +
//                     "" +
//                     "        /* iOS BLUE LINKS */" +
//                     "        a[x-apple-data-detectors] {" +
//                     "            color: inherit !important;" +
//                     "            text-decoration: none !important;" +
//                     "            font-size: inherit !important;" +
//                     "            font-family: inherit !important;" +
//                     "            font-weight: inherit !important;" +
//                     "            line-height: inherit !important;" +
//                     "        }" +
//                     "" +
//                     "        /* MOBILE STYLES */" +
//                     "        @media screen and (max-width:600px) {" +
//                     "            h1 {" +
//                     "                font-size: 32px !important;" +
//                     "                line-height: 32px !important;" +
//                     "            }" +
//                     "        }" +
//                     "" +
//                     "        /* ANDROID CENTER FIX */" +
//                     '        div[style*="margin: 16px 0;"] {' +
//                     "            margin: 0 !important;" +
//                     "        }" +
//                     "    </style>" +
//                     "</head>" +
//                     " <style>" +
//                     " #para_text {" +
//                     "  padding: 0px 20px;" +
//                     "  color: #111111;" +
//                     "  font-family: 'Raleway Light', Arial, sans-serif;" +
//                     "  font-size: 1.5em;" +
//                     "  text-align: center;" +
//                     "}" +
//                     "#grad1 {" +
//                     "  background-color: #E5E5E5;" +
//                     "}" +
//                     "#link_social" +
//                     "{" +
//                     "	padding: 5px;" +
//                     "	color: #666666;" +
//                     "}" +
//                     "</style>" +
//                     '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
//                     "    " +
//                     '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "        <!-- LOGO -->" +
//                     "        <tbody><tr>" +
//                     "           " +
//                     '<td align="center">' +
//                     '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "                    <tbody><tr>" +
//                     '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
//                     "                    </tr>" +
//                     "                </tbody></table>" +
//                     "            </td>" +
//                     "        </tr>" +
//                     "        <tr>" +
//                     '            <td align="center">' +
//                     '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "                    <tbody><tr>" +
//                     '                        <td style="padding: 30px;  " valign="top" align="center">' +
//                     '                           <img style="max-width: 29%; max-height: 50%; " src="' +
//                     api_url +
//                     '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
//                     "                        </td>" +
//                     "                    </tr>" +
//                     "                </tbody></table>" +
//                     "            </td>" +
//                     "        </tr>" +
//                     "        " +
//                     "		<!-- MESSAGE -->" +
//                     "		<tr>" +
//                     '        <td align="center">' +
//                     '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "        <tbody>" +
//                     "		<tr>" +
//                     '            <td align="center">' +
//                     '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "                    <tbody>" +
//                     "					<tr>" +
//                     '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
//                     "                           <h1>CA " +
//                     req.body.caname +
//                     " has invited you to collaborate as a Director in " +
//                     liveAPP_URL +
//                     "</h1>" +
//                     "						   " +
//                     "						" +
//                     "						   " +
//                     '							<a href="' +
//                     api_url +
//                     "/registeration/" +
//                     resultdirector._id +
//                     '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">Accept Invitation</a>' +
//                     '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
//                     '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
//                     liveAPP_URL +
//                     "</p>" +
//                     '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
//                     req.body.director[sh].directoremail +
//                     "</p>" +
//                     "                        </td>" +
//                     "" +
//                     "                    </tr><tr><td><hr><td></tr>" +
//                     "" +
//                     "                </tbody></table>" +
//                     "            </td>" +
//                     "        </tr>" +
//                     "		</tbody>" +
//                     "		</table>" +
//                     "        </td>" +
//                     "        </tr>" +
//                     "        <tr>" +
//                     '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
//                     '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                     "                <tbody>" +
//                     "				" +
//                     "					<tr>" +
//                     '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
//                     "				" +
//                     "			" +
//                     "				" +
//                     "				<!-- COPYRIGHT TEXT -->" +
//                     '					<p id="footer_text">' +
//                     "If you have any questions you can get in touch at support.comsec360.com</p>" +
//                     "					<p>© 2021 ComSec360</p>" +
//                     "                    </td>" +
//                     "                    </tr>" +
//                     "				" +
//                     "	" +
//                     "                </tbody>" +
//                     "				</table>" +
//                     "            </td>" +
//                     "        </tr>" +
//                     "    </tbody></table>" +
//                     "" +
//                     "" +
//                     "</body></html>",
//                 };

//                 transporter.sendMail(
//                   mailOptionsdirector,
//                   function (error, info) {
//                     if (error) {
//                       console.log("error" + error);
//                     } else {
//                       console.log("Email sent: " + info.response);
//                     }
//                   }
//                 );
//               }
//             }
//           }
//         );
//       }
//     }

//     for (let sh = 0; sh < req.body.cs.length; sh++) {
//       if (req.body.cs[sh].csemail != "" && req.body.cs[sh].csfirst_name != "") {
//         let userdata = {
//           email: req.body.cs[sh].csemail,
//           name: req.body.cs[sh].csfirst_name,
//           surname: req.body.cs[sh].cslast_name,
//           mobile_number: "",
//           companyid: mongoose.Types.ObjectId(req.body.companyid),
//           roles: "Company Secretory",
//           typeofuser: "Natural Person",
//           firstperson: sh + 1,
//           password: "",
//         };
//         User.findOne({ email: req.body.cs[sh].csemail }, async (err, cs) => {
//           if (err) {
//             // res.status(200).json({
//             //   status: "400",
//             //   msg: "Something Went Wrong",
//             // });
//           }
//           if (!cs) {
//             let usercs = User(userdata);
//             let resultcs = await usercs.save();

//             if (resultcs) {
//               let mailOptionscs = {
//                 from: "vikas@synram.co",
//                 to: req.body.cs[sh].csemail,
//                 subject:
//                   "" +
//                   req.body.caname +
//                   " has invited you to collaborate as a Company Secretory ",
//                 html:
//                   "<!DOCTYPE html>" +
//                   "<html><head>" +
//                   "    <title>ComSec360 Invitation</title>" +
//                   '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
//                   "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
//                   '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
//                   '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
//                   '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
//                   '    <style type="text/css">' +
//                   "     " +
//                   "        /* CLIENT-SPECIFIC STYLES */" +
//                   "        body," +
//                   "        table," +
//                   "        td," +
//                   "        a {" +
//                   "            -webkit-text-size-adjust: 100%;" +
//                   "            -ms-text-size-adjust: 100%;" +
//                   "        }" +
//                   "" +
//                   "        table," +
//                   "        td {" +
//                   "            mso-table-lspace: 0pt;" +
//                   "            mso-table-rspace: 0pt;" +
//                   "        }" +
//                   "" +
//                   "        img {" +
//                   "            -ms-interpolation-mode: bicubic;" +
//                   "        }" +
//                   "" +
//                   "        /* RESET STYLES */" +
//                   "        img {" +
//                   "            border: 0;" +
//                   "            height: auto;" +
//                   "            line-height: 100%;" +
//                   "            outline: none;" +
//                   "            text-decoration: none;" +
//                   "        }" +
//                   "" +
//                   "        table {" +
//                   "            border-collapse: collapse !important;" +
//                   "        }" +
//                   "" +
//                   "        body {" +
//                   "            height: 100% !important;" +
//                   "            margin: 0 !important;" +
//                   "            padding: 0 !important;" +
//                   "            width: 100% !important;" +
//                   "        }" +
//                   "" +
//                   "        /* iOS BLUE LINKS */" +
//                   "        a[x-apple-data-detectors] {" +
//                   "            color: inherit !important;" +
//                   "            text-decoration: none !important;" +
//                   "            font-size: inherit !important;" +
//                   "            font-family: inherit !important;" +
//                   "            font-weight: inherit !important;" +
//                   "            line-height: inherit !important;" +
//                   "        }" +
//                   "" +
//                   "        /* MOBILE STYLES */" +
//                   "        @media screen and (max-width:600px) {" +
//                   "            h1 {" +
//                   "                font-size: 32px !important;" +
//                   "                line-height: 32px !important;" +
//                   "            }" +
//                   "        }" +
//                   "" +
//                   "        /* ANDROID CENTER FIX */" +
//                   '        div[style*="margin: 16px 0;"] {' +
//                   "            margin: 0 !important;" +
//                   "        }" +
//                   "    </style>" +
//                   "</head>" +
//                   " <style>" +
//                   " #para_text {" +
//                   "  padding: 0px 20px;" +
//                   "  color: #111111;" +
//                   "  font-family: 'Raleway Light', Arial, sans-serif;" +
//                   "  font-size: 1.5em;" +
//                   "  text-align: center;" +
//                   "}" +
//                   "#grad1 {" +
//                   "  background-color: #E5E5E5;" +
//                   "}" +
//                   "#link_social" +
//                   "{" +
//                   "	padding: 5px;" +
//                   "	color: #666666;" +
//                   "}" +
//                   "</style>" +
//                   '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
//                   "    " +
//                   '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                   "        <!-- LOGO -->" +
//                   "        <tbody><tr>" +
//                   "           " +
//                   '<td align="center">' +
//                   '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                   "                    <tbody><tr>" +
//                   '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
//                   "                    </tr>" +
//                   "                </tbody></table>" +
//                   "            </td>" +
//                   "        </tr>" +
//                   "        <tr>" +
//                   '            <td align="center">' +
//                   '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                   "                    <tbody><tr>" +
//                   '                        <td style="padding: 30px;  " valign="top" align="center">' +
//                   '                           <img style="max-width: 29%; max-height: 50%; " src="' +
//                   api_url +
//                   '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
//                   "                        </td>" +
//                   "                    </tr>" +
//                   "                </tbody></table>" +
//                   "            </td>" +
//                   "        </tr>" +
//                   "        " +
//                   "		<!-- MESSAGE -->" +
//                   "		<tr>" +
//                   '        <td align="center">' +
//                   '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                   "        <tbody>" +
//                   "		<tr>" +
//                   '            <td align="center">' +
//                   '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                   "                    <tbody>" +
//                   "					<tr>" +
//                   '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
//                   "                           <h1>CA " +
//                   req.body.caname +
//                   " has invited you to collaborate as a Company Secretory in" +
//                   liveAPP_URL +
//                   "</h1>" +
//                   "						   " +
//                   "						" +
//                   "						   " +
//                   '							<a href="' +
//                   api_url +
//                   "/registeration/" +
//                   resultcs._id +
//                   '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">Accept Invitation</a>' +
//                   '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
//                   '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
//                   liveAPP_URL +
//                   "</p>" +
//                   '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
//                   req.body.cs[sh].csemail +
//                   "</p>" +
//                   "                        </td>" +
//                   "" +
//                   "                    </tr><tr><td><hr><td></tr>" +
//                   "" +
//                   "                </tbody></table>" +
//                   "            </td>" +
//                   "        </tr>" +
//                   "		</tbody>" +
//                   "		</table>" +
//                   "        </td>" +
//                   "        </tr>" +
//                   "        <tr>" +
//                   '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
//                   '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                   "                <tbody>" +
//                   "				" +
//                   "					<tr>" +
//                   '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
//                   "				" +
//                   "			" +
//                   "				" +
//                   "				<!-- COPYRIGHT TEXT -->" +
//                   '					<p id="footer_text">' +
//                   "If you have any questions you can get in touch at support.comsec360.com</p>" +
//                   "					<p>© 2021 ComSec360</p>" +
//                   "                    </td>" +
//                   "                    </tr>" +
//                   "				" +
//                   "	" +
//                   "                </tbody>" +
//                   "				</table>" +
//                   "            </td>" +
//                   "        </tr>" +
//                   "    </tbody></table>" +
//                   "" +
//                   "" +
//                   "</body></html>",
//               };

//               transporter.sendMail(mailOptionscs, function (error, info) {
//                 if (error) {
//                   console.log("error" + error);
//                 } else {
//                   console.log("Email sent: " + info.response);
//                 }
//               });
//               // res.status(200).json({
//               //   status: "200",
//               //   msg: "Successfully Added",
//               //   result: resultusernew,
//               // });
//               // res.status(200).json({
//               //   status: "200",
//               //   msg: "Successfully Invited",
//               //   result: resultuser,
//               // });
//             } else {
//               // res.status(200).json({
//               //   status: "400",
//               //   msg: "Something Went Wrong",
//               // });
//             }
//           }
//           if (cs) {
//             let companyid = cs.companyid;
//             if (companyid.includes(req.body.companyid)) {
//             } else {
//               companyid.push(mongoose.Types.ObjectId(req.body.companyid));

//               User.updateOne(
//                 { email: req.body.cs[sh].csemail },
//                 {
//                   $set: {
//                     companyid: companyid,
//                   },
//                 },
//                 (err, result) => {
//                   if (err) {
//                     // res.status(200).json({
//                     //   status: "400",
//                     //   msg: "Updation failed",
//                     // });
//                   } else {
//                     // return res.status(200).json({
//                     //   status: "200",
//                     //   msg: "Sucessfully Updated",
//                     // });
//                   }
//                 }
//               );

//               let mailOptionscs = {
//                 from: "vikas@synram.co",
//                 to: req.body.cs[sh].csemail,
//                 subject:
//                   "" +
//                   req.body.caname +
//                   " has invited you to collaborate as a Company Secretory ",
//                 html:
//                   "<!DOCTYPE html>" +
//                   "<html><head>" +
//                   "    <title>ComSec360 Invitation</title>" +
//                   '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
//                   "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
//                   '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
//                   '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
//                   '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
//                   '    <style type="text/css">' +
//                   "     " +
//                   "        /* CLIENT-SPECIFIC STYLES */" +
//                   "        body," +
//                   "        table," +
//                   "        td," +
//                   "        a {" +
//                   "            -webkit-text-size-adjust: 100%;" +
//                   "            -ms-text-size-adjust: 100%;" +
//                   "        }" +
//                   "" +
//                   "        table," +
//                   "        td {" +
//                   "            mso-table-lspace: 0pt;" +
//                   "            mso-table-rspace: 0pt;" +
//                   "        }" +
//                   "" +
//                   "        img {" +
//                   "            -ms-interpolation-mode: bicubic;" +
//                   "        }" +
//                   "" +
//                   "        /* RESET STYLES */" +
//                   "        img {" +
//                   "            border: 0;" +
//                   "            height: auto;" +
//                   "            line-height: 100%;" +
//                   "            outline: none;" +
//                   "            text-decoration: none;" +
//                   "        }" +
//                   "" +
//                   "        table {" +
//                   "            border-collapse: collapse !important;" +
//                   "        }" +
//                   "" +
//                   "        body {" +
//                   "            height: 100% !important;" +
//                   "            margin: 0 !important;" +
//                   "            padding: 0 !important;" +
//                   "            width: 100% !important;" +
//                   "        }" +
//                   "" +
//                   "        /* iOS BLUE LINKS */" +
//                   "        a[x-apple-data-detectors] {" +
//                   "            color: inherit !important;" +
//                   "            text-decoration: none !important;" +
//                   "            font-size: inherit !important;" +
//                   "            font-family: inherit !important;" +
//                   "            font-weight: inherit !important;" +
//                   "            line-height: inherit !important;" +
//                   "        }" +
//                   "" +
//                   "        /* MOBILE STYLES */" +
//                   "        @media screen and (max-width:600px) {" +
//                   "            h1 {" +
//                   "                font-size: 32px !important;" +
//                   "                line-height: 32px !important;" +
//                   "            }" +
//                   "        }" +
//                   "" +
//                   "        /* ANDROID CENTER FIX */" +
//                   '        div[style*="margin: 16px 0;"] {' +
//                   "            margin: 0 !important;" +
//                   "        }" +
//                   "    </style>" +
//                   "</head>" +
//                   " <style>" +
//                   " #para_text {" +
//                   "  padding: 0px 20px;" +
//                   "  color: #111111;" +
//                   "  font-family: 'Raleway Light', Arial, sans-serif;" +
//                   "  font-size: 1.5em;" +
//                   "  text-align: center;" +
//                   "}" +
//                   "#grad1 {" +
//                   "  background-color: #E5E5E5;" +
//                   "}" +
//                   "#link_social" +
//                   "{" +
//                   "	padding: 5px;" +
//                   "	color: #666666;" +
//                   "}" +
//                   "</style>" +
//                   '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
//                   "    " +
//                   '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                   "        <!-- LOGO -->" +
//                   "        <tbody><tr>" +
//                   "           " +
//                   '<td align="center">' +
//                   '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                   "                    <tbody><tr>" +
//                   '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
//                   "                    </tr>" +
//                   "                </tbody></table>" +
//                   "            </td>" +
//                   "        </tr>" +
//                   "        <tr>" +
//                   '            <td align="center">' +
//                   '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                   "                    <tbody><tr>" +
//                   '                        <td style="padding: 30px;  " valign="top" align="center">' +
//                   '                           <img style="max-width: 29%; max-height: 50%; " src="' +
//                   api_url +
//                   '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
//                   "                        </td>" +
//                   "                    </tr>" +
//                   "                </tbody></table>" +
//                   "            </td>" +
//                   "        </tr>" +
//                   "        " +
//                   "		<!-- MESSAGE -->" +
//                   "		<tr>" +
//                   '        <td align="center">' +
//                   '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                   "        <tbody>" +
//                   "		<tr>" +
//                   '            <td align="center">' +
//                   '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                   "                    <tbody>" +
//                   "					<tr>" +
//                   '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
//                   "                           <h1>CA " +
//                   req.body.caname +
//                   " has invited you to collaborate as a Company Secretory in" +
//                   liveAPP_URL +
//                   "</h1>" +
//                   "						   " +
//                   "						" +
//                   "						   " +
//                   '							<a href="' +
//                   api_url +
//                   "/registeration/" +
//                   resultcs._id +
//                   '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">Accept Invitation</a>' +
//                   '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
//                   '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
//                   liveAPP_URL +
//                   "</p>" +
//                   '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
//                   req.body.cs[sh].csemail +
//                   "</p>" +
//                   "                        </td>" +
//                   "" +
//                   "                    </tr><tr><td><hr><td></tr>" +
//                   "" +
//                   "                </tbody></table>" +
//                   "            </td>" +
//                   "        </tr>" +
//                   "		</tbody>" +
//                   "		</table>" +
//                   "        </td>" +
//                   "        </tr>" +
//                   "        <tr>" +
//                   '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
//                   '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//                   "                <tbody>" +
//                   "				" +
//                   "					<tr>" +
//                   '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
//                   "				" +
//                   "			" +
//                   "				" +
//                   "				<!-- COPYRIGHT TEXT -->" +
//                   '					<p id="footer_text">' +
//                   "If you have any questions you can get in touch at support.comsec360.com</p>" +
//                   "					<p>© 2021 ComSec360</p>" +
//                   "                    </td>" +
//                   "                    </tr>" +
//                   "				" +
//                   "	" +
//                   "                </tbody>" +
//                   "				</table>" +
//                   "            </td>" +
//                   "        </tr>" +
//                   "    </tbody></table>" +
//                   "" +
//                   "" +
//                   "</body></html>",
//               };

//               transporter.sendMail(mailOptionscs, function (error, info) {
//                 if (error) {
//                   console.log("error" + error);
//                 } else {
//                   console.log("Email sent: " + info.response);
//                 }
//               });
//             }
//           }
//         });
//       }
//     }

//     res.status(200).json({
//       status: "200",
//       msg: "Successfully Added",
//     });

//     // let userdata = {
//     //   email: req.body.email,
//     //   companyid: mongoose.Types.ObjectId(req.body.companyid),
//     //   roles: req.body.roles,
//     //   typeofuser: req.body.typeofuser,
//     //   name: req.body.name,
//     //   mobile_number: "",
//     //   password: "",
//     // };
//     // User.findOne({ email: req.body.email }, async (err, result) => {
//     //   if (err) {
//     //     res.status(200).json({
//     //       status: "400",
//     //       msg: "Something Went Wrong",
//     //     });
//     //   }
//     //   if (!result) {
//     //     let userresult = User(userdata);
//     //     let resultuser = await userresult.save();

//     //     if (resultuser) {
//     //       let transporter = nodemailer.createTransport({
//     //         host: "smtp.gmail.com",
//     //         port: 465,
//     //         secure: true,
//     //         auth: {
//     //           user: "vikas@synram.co",
//     //           pass: "Synram@2019",
//     //         },
//     //       });

//     //       let mailOptions = {
//     //         from: "vikas@synram.co",
//     //         to: req.body.email,
//     //         subject:
//     //           "CA " +
//     //           req.body.caname +
//     //           " has invited you to collaborate as a " +
//     //           req.body.roles +
//     //           "",
//     //         html:
//     //           "<!DOCTYPE html>" +
//     //           "<html><head>" +
//     //           "    <title>ComSec360 Invitation</title>" +
//     //           '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
//     //           "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
//     //           '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
//     //           '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
//     //           '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
//     //           '    <style type="text/css">' +
//     //           "     " +
//     //           "        /* CLIENT-SPECIFIC STYLES */" +
//     //           "        body," +
//     //           "        table," +
//     //           "        td," +
//     //           "        a {" +
//     //           "            -webkit-text-size-adjust: 100%;" +
//     //           "            -ms-text-size-adjust: 100%;" +
//     //           "        }" +
//     //           "" +
//     //           "        table," +
//     //           "        td {" +
//     //           "            mso-table-lspace: 0pt;" +
//     //           "            mso-table-rspace: 0pt;" +
//     //           "        }" +
//     //           "" +
//     //           "        img {" +
//     //           "            -ms-interpolation-mode: bicubic;" +
//     //           "        }" +
//     //           "" +
//     //           "        /* RESET STYLES */" +
//     //           "        img {" +
//     //           "            border: 0;" +
//     //           "            height: auto;" +
//     //           "            line-height: 100%;" +
//     //           "            outline: none;" +
//     //           "            text-decoration: none;" +
//     //           "        }" +
//     //           "" +
//     //           "        table {" +
//     //           "            border-collapse: collapse !important;" +
//     //           "        }" +
//     //           "" +
//     //           "        body {" +
//     //           "            height: 100% !important;" +
//     //           "            margin: 0 !important;" +
//     //           "            padding: 0 !important;" +
//     //           "            width: 100% !important;" +
//     //           "        }" +
//     //           "" +
//     //           "        /* iOS BLUE LINKS */" +
//     //           "        a[x-apple-data-detectors] {" +
//     //           "            color: inherit !important;" +
//     //           "            text-decoration: none !important;" +
//     //           "            font-size: inherit !important;" +
//     //           "            font-family: inherit !important;" +
//     //           "            font-weight: inherit !important;" +
//     //           "            line-height: inherit !important;" +
//     //           "        }" +
//     //           "" +
//     //           "        /* MOBILE STYLES */" +
//     //           "        @media screen and (max-width:600px) {" +
//     //           "            h1 {" +
//     //           "                font-size: 32px !important;" +
//     //           "                line-height: 32px !important;" +
//     //           "            }" +
//     //           "        }" +
//     //           "" +
//     //           "        /* ANDROID CENTER FIX */" +
//     //           '        div[style*="margin: 16px 0;"] {' +
//     //           "            margin: 0 !important;" +
//     //           "        }" +
//     //           "    </style>" +
//     //           "</head>" +
//     //           " <style>" +
//     //           " #para_text {" +
//     //           "  padding: 0px 20px;" +
//     //           "  color: #111111;" +
//     //           "  font-family: 'Raleway Light', Arial, sans-serif;" +
//     //           "  font-size: 1.5em;" +
//     //           "  text-align: center;" +
//     //           "}" +
//     //           "#grad1 {" +
//     //           "  background-color: #E5E5E5;" +
//     //           "}" +
//     //           "#link_social" +
//     //           "{" +
//     //           "	padding: 5px;" +
//     //           "	color: #666666;" +
//     //           "}" +
//     //           "</style>" +
//     //           '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
//     //           "    " +
//     //           '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//     //           "        <!-- LOGO -->" +
//     //           "        <tbody><tr>" +
//     //           "           " +
//     //           '<td align="center">' +
//     //           '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//     //           "                    <tbody><tr>" +
//     //           '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
//     //           "                    </tr>" +
//     //           "                </tbody></table>" +
//     //           "            </td>" +
//     //           "        </tr>" +
//     //           "        <tr>" +
//     //           '            <td align="center">' +
//     //           '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//     //           "                    <tbody><tr>" +
//     //           '                        <td style="padding: 30px;  " valign="top" align="center">' +
//     //           '                           <img style="max-width: 29%; max-height: 50%; " src="' +
//     //           api_url +
//     //           '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
//     //           "                        </td>" +
//     //           "                    </tr>" +
//     //           "                </tbody></table>" +
//     //           "            </td>" +
//     //           "        </tr>" +
//     //           "        " +
//     //           "		<!-- MESSAGE -->" +
//     //           "		<tr>" +
//     //           '        <td align="center">' +
//     //           '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//     //           "        <tbody>" +
//     //           "		<tr>" +
//     //           '            <td align="center">' +
//     //           '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//     //           "                    <tbody>" +
//     //           "					<tr>" +
//     //           '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
//     //           "                           <h1>CA " +
//     //           req.body.caname +
//     //           " has invited you to collaborate as a " +
//     //           req.body.roles +
//     //           " in " +
//     //           liveAPP_URL +
//     //           "</h1>" +
//     //           "						   " +
//     //           "						" +
//     //           "						   " +
//     //           '							<a href="' +
//     //           api_url +
//     //           "/registeration/" +
//     //           resultuser._id +
//     //           '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">Accept Invitation</a>' +
//     //           '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
//     //           '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
//     //           liveAPP_URL +
//     //           "</p>" +
//     //           '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
//     //           req.body.email +
//     //           "</p>" +
//     //           "                        </td>" +
//     //           "" +
//     //           "                    </tr><tr><td><hr><td></tr>" +
//     //           "" +
//     //           "                </tbody></table>" +
//     //           "            </td>" +
//     //           "        </tr>" +
//     //           "		</tbody>" +
//     //           "		</table>" +
//     //           "        </td>" +
//     //           "        </tr>" +
//     //           "        <tr>" +
//     //           '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
//     //           '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//     //           "                <tbody>" +
//     //           "				" +
//     //           "					<tr>" +
//     //           '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
//     //           "				" +
//     //           "			" +
//     //           "				" +
//     //           "				<!-- COPYRIGHT TEXT -->" +
//     //           '					<p id="footer_text">' +
//     //           "If you have any questions you can get in touch at support.comsec360.com</p>" +
//     //           "					<p>© 2021 ComSec360</p>" +
//     //           "                    </td>" +
//     //           "                    </tr>" +
//     //           "				" +
//     //           "	" +
//     //           "                </tbody>" +
//     //           "				</table>" +
//     //           "            </td>" +
//     //           "        </tr>" +
//     //           "    </tbody></table>" +
//     //           "" +
//     //           "" +
//     //           "</body></html>",
//     //       };

//     //       transporter.sendMail(mailOptions, function (error, info) {
//     //         if (error) {
//     //           console.log("error" + error);
//     //         } else {
//     //           console.log("Email sent: " + info.response);
//     //         }
//     //       });

//     //       res.status(200).json({
//     //         status: "200",
//     //         msg: "Successfully Invited",
//     //         result: resultuser,
//     //       });
//     //     } else {
//     //       res.status(200).json({
//     //         status: "400",
//     //         msg: "Something Went Wrong",
//     //       });
//     //     }
//     //   }
//     //   if (result) {
//     //     res.status(200).json({
//     //       status: "400",
//     //       msg: "Email Id is already register",
//     //     });
//     //   }
//     // });
//   } else {
//     res.status(200).json({
//       status: "400",
//       msg: "Invalid Data",
//     });
//   }
// });

// router.post("/adduser", async (req, res) => {
//   let api_url = process.env.APP_URL;
//   let liveAPP_URL = process.env.liveAPP_URL;
//   console.log("text", req.body);
//   if (req.body.email != "") {
//     let userdata = {
//       email: req.body.email,
//       roles: req.body.roles,
//       name: req.body.name,
//       mobile_number: "",
//       password: "",
//     };
//     User.findOne({ email: req.body.email }, async (err, result) => {
//       if (err) {
//         res.status(200).json({
//           status: "400",
//           msg: "Something Went Wrong",
//         });
//       }
//       if (!result) {
//         let userresult = User(userdata);
//         let resultuser = await userresult.save();

//         if (resultuser) {
//           let transporter = nodemailer.createTransport({
//             host: "smtp.gmail.com",
//             port: 465,
//             secure: true,
//             auth: {
//               user: "vikas@synram.co",
//               pass: "Synram@2019",
//             },
//           });

//           let mailOptions = {
//             from: "vikas@synram.co",
//             to: req.body.email,
//             subject: "Superadmin has invited you to collaborate as a staff",
//             html:
//               "<!DOCTYPE html>" +
//               "<html><head>" +
//               "    <title>ComSec360 Invitation</title>" +
//               '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
//               "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
//               '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
//               '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
//               '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
//               '    <style type="text/css">' +
//               "     " +
//               "        /* CLIENT-SPECIFIC STYLES */" +
//               "        body," +
//               "        table," +
//               "        td," +
//               "        a {" +
//               "            -webkit-text-size-adjust: 100%;" +
//               "            -ms-text-size-adjust: 100%;" +
//               "        }" +
//               "" +
//               "        table," +
//               "        td {" +
//               "            mso-table-lspace: 0pt;" +
//               "            mso-table-rspace: 0pt;" +
//               "        }" +
//               "" +
//               "        img {" +
//               "            -ms-interpolation-mode: bicubic;" +
//               "        }" +
//               "" +
//               "        /* RESET STYLES */" +
//               "        img {" +
//               "            border: 0;" +
//               "            height: auto;" +
//               "            line-height: 100%;" +
//               "            outline: none;" +
//               "            text-decoration: none;" +
//               "        }" +
//               "" +
//               "        table {" +
//               "            border-collapse: collapse !important;" +
//               "        }" +
//               "" +
//               "        body {" +
//               "            height: 100% !important;" +
//               "            margin: 0 !important;" +
//               "            padding: 0 !important;" +
//               "            width: 100% !important;" +
//               "        }" +
//               "" +
//               "        /* iOS BLUE LINKS */" +
//               "        a[x-apple-data-detectors] {" +
//               "            color: inherit !important;" +
//               "            text-decoration: none !important;" +
//               "            font-size: inherit !important;" +
//               "            font-family: inherit !important;" +
//               "            font-weight: inherit !important;" +
//               "            line-height: inherit !important;" +
//               "        }" +
//               "" +
//               "        /* MOBILE STYLES */" +
//               "        @media screen and (max-width:600px) {" +
//               "            h1 {" +
//               "                font-size: 32px !important;" +
//               "                line-height: 32px !important;" +
//               "            }" +
//               "        }" +
//               "" +
//               "        /* ANDROID CENTER FIX */" +
//               '        div[style*="margin: 16px 0;"] {' +
//               "            margin: 0 !important;" +
//               "        }" +
//               "    </style>" +
//               "</head>" +
//               " <style>" +
//               " #para_text {" +
//               "  padding: 0px 20px;" +
//               "  color: #111111;" +
//               "  font-family: 'Raleway Light', Arial, sans-serif;" +
//               "  font-size: 1.5em;" +
//               "  text-align: center;" +
//               "}" +
//               "#grad1 {" +
//               "  background-color: #E5E5E5;" +
//               "}" +
//               "#link_social" +
//               "{" +
//               "	padding: 5px;" +
//               "	color: #666666;" +
//               "}" +
//               "</style>" +
//               '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
//               "    " +
//               '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//               "        <!-- LOGO -->" +
//               "        <tbody><tr>" +
//               "           " +
//               '<td align="center">' +
//               '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//               "                    <tbody><tr>" +
//               '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
//               "                    </tr>" +
//               "                </tbody></table>" +
//               "            </td>" +
//               "        </tr>" +
//               "        <tr>" +
//               '            <td align="center">' +
//               '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//               "                    <tbody><tr>" +
//               '                        <td style="padding: 30px;  " valign="top" align="center">' +
//               '                           <img style="max-width: 29%; max-height: 50%; " src="' +
//               api_url +
//               '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
//               "                        </td>" +
//               "                    </tr>" +
//               "                </tbody></table>" +
//               "            </td>" +
//               "        </tr>" +
//               "        " +
//               "		<!-- MESSAGE -->" +
//               "		<tr>" +
//               '        <td align="center">' +
//               '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//               "        <tbody>" +
//               "		<tr>" +
//               '            <td align="center">' +
//               '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//               "                    <tbody>" +
//               "					<tr>" +
//               '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
//               "                           <h1>Superadmin invited you to collaborate as a staff in " +
//               liveAPP_URL +
//               "</h1>" +
//               "						   " +
//               "						" +
//               "						   " +
//               '							<a href="' +
//               api_url +
//               "/registeration/" +
//               resultuser._id +
//               '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">Accept Invitation</a>' +
//               '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
//               '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
//               liveAPP_URL +
//               "</p>" +
//               '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
//               req.body.email +
//               "</p>" +
//               "                        </td>" +
//               "" +
//               "                    </tr><tr><td><hr><td></tr>" +
//               "" +
//               "                </tbody></table>" +
//               "            </td>" +
//               "        </tr>" +
//               "		</tbody>" +
//               "		</table>" +
//               "        </td>" +
//               "        </tr>" +
//               "        <tr>" +
//               '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
//               '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//               "                <tbody>" +
//               "				" +
//               "					<tr>" +
//               '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
//               "				" +
//               "			" +
//               "				" +
//               "				<!-- COPYRIGHT TEXT -->" +
//               '					<p id="footer_text">' +
//               "If you have any questions you can get in touch at support.comsec360.com</p>" +
//               "					<p>© 2021 ComSec360</p>" +
//               "                    </td>" +
//               "                    </tr>" +
//               "				" +
//               "	" +
//               "                </tbody>" +
//               "				</table>" +
//               "            </td>" +
//               "        </tr>" +
//               "    </tbody></table>" +
//               "" +
//               "" +
//               "</body></html>",
//           };

//           transporter.sendMail(mailOptions, function (error, info) {
//             if (error) {
//               console.log("error" + error);
//             } else {
//               console.log("Email sent: " + info.response);
//             }
//           });

//           res.status(200).json({
//             status: "200",
//             msg: "Successfully Invited",
//             result: resultuser,
//           });
//         } else {
//           res.status(200).json({
//             status: "400",
//             msg: "Something Went Wrong",
//           });
//         }
//       }
//       if (result) {
//         res.status(200).json({
//           status: "400",
//           msg: "Email Id is already register",
//         });
//       }
//     });
//   } else {
//     res.status(200).json({
//       status: "400",
//       msg: "Invalid Data",
//     });
//   }
// });

// router.post("/sendreminderforacceptinfo", async (req, res) => {
//   let api_url = process.env.APP_URL;
//   let liveAPP_URL = process.env.liveAPP_URL;
//   if (req.body.email != "") {
//     User.findOne({ email: req.body.email }, async (err, result) => {
//       if (err) {
//         res.status(200).json({
//           status: "400",
//           msg: "Something Went Wrong",
//         });
//       }
//       console.log(req.body.email);
//       if (result) {
//         let transporter = nodemailer.createTransport({
//           host: "smtp.gmail.com",
//           port: 465,
//           secure: true,
//           auth: {
//             user: "vikas@synram.co",
//             pass: "Synram@2019",
//           },
//         });

//         let mailOptions = {
//           from: "vikas@synram.co",
//           to: req.body.email,
//           subject: req.body.subject,
//           html:
//             "<!DOCTYPE html>" +
//             "<html><head>" +
//             "    <title>ComSec360 Invitation</title>" +
//             '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
//             "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
//             '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
//             '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
//             '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
//             '    <style type="text/css">' +
//             "     " +
//             "        /* CLIENT-SPECIFIC STYLES */" +
//             "        body," +
//             "        table," +
//             "        td," +
//             "        a {" +
//             "            -webkit-text-size-adjust: 100%;" +
//             "            -ms-text-size-adjust: 100%;" +
//             "        }" +
//             "" +
//             "        table," +
//             "        td {" +
//             "            mso-table-lspace: 0pt;" +
//             "            mso-table-rspace: 0pt;" +
//             "        }" +
//             "" +
//             "        img {" +
//             "            -ms-interpolation-mode: bicubic;" +
//             "        }" +
//             "" +
//             "        /* RESET STYLES */" +
//             "        img {" +
//             "            border: 0;" +
//             "            height: auto;" +
//             "            line-height: 100%;" +
//             "            outline: none;" +
//             "            text-decoration: none;" +
//             "        }" +
//             "" +
//             "        table {" +
//             "            border-collapse: collapse !important;" +
//             "        }" +
//             "" +
//             "        body {" +
//             "            height: 100% !important;" +
//             "            margin: 0 !important;" +
//             "            padding: 0 !important;" +
//             "            width: 100% !important;" +
//             "        }" +
//             "" +
//             "        /* iOS BLUE LINKS */" +
//             "        a[x-apple-data-detectors] {" +
//             "            color: inherit !important;" +
//             "            text-decoration: none !important;" +
//             "            font-size: inherit !important;" +
//             "            font-family: inherit !important;" +
//             "            font-weight: inherit !important;" +
//             "            line-height: inherit !important;" +
//             "        }" +
//             "" +
//             "        /* MOBILE STYLES */" +
//             "        @media screen and (max-width:600px) {" +
//             "            h1 {" +
//             "                font-size: 32px !important;" +
//             "                line-height: 32px !important;" +
//             "            }" +
//             "        }" +
//             "" +
//             "        /* ANDROID CENTER FIX */" +
//             '        div[style*="margin: 16px 0;"] {' +
//             "            margin: 0 !important;" +
//             "        }" +
//             "    </style>" +
//             "</head>" +
//             " <style>" +
//             " #para_text {" +
//             "  padding: 0px 20px;" +
//             "  color: #111111;" +
//             "  font-family: 'Raleway Light', Arial, sans-serif;" +
//             "  font-size: 1.5em;" +
//             "  text-align: center;" +
//             "}" +
//             "#grad1 {" +
//             "  background-color: #E5E5E5;" +
//             "}" +
//             "#link_social" +
//             "{" +
//             "	padding: 5px;" +
//             "	color: #666666;" +
//             "}" +
//             "</style>" +
//             '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
//             "    " +
//             '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "        <!-- LOGO -->" +
//             "        <tbody><tr>" +
//             "           " +
//             '<td align="center">' +
//             '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "                    <tbody><tr>" +
//             '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
//             "                    </tr>" +
//             "                </tbody></table>" +
//             "            </td>" +
//             "        </tr>" +
//             "        <tr>" +
//             '            <td align="center">' +
//             '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "                    <tbody><tr>" +
//             '                        <td style="padding: 30px;  " valign="top" align="center">' +
//             '                           <img style="max-width: 29%; max-height: 50%; " src="' +
//             api_url +
//             '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
//             "                        </td>" +
//             "                    </tr>" +
//             "                </tbody></table>" +
//             "            </td>" +
//             "        </tr>" +
//             "        " +
//             "		<!-- MESSAGE -->" +
//             "		<tr>" +
//             '        <td align="center">' +
//             '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "        <tbody>" +
//             "		<tr>" +
//             '            <td align="center">' +
//             '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "                    <tbody>" +
//             "					<tr>" +
//             '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
//             "                           <h1>" +
//             req.body.message +
//             "</h1>" +
//             "						   " +
//             "						" +
//             "						   " +
//             '							<a href="' +
//             api_url +
//             "/registeration/" +
//             req.body.id +
//             '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">Accept Invitation</a>' +
//             '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
//             '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
//             liveAPP_URL +
//             "</p>" +
//             '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
//             req.body.email +
//             "</p>" +
//             "                        </td>" +
//             "" +
//             "                    </tr><tr><td><hr><td></tr>" +
//             "" +
//             "                </tbody></table>" +
//             "            </td>" +
//             "        </tr>" +
//             "		</tbody>" +
//             "		</table>" +
//             "        </td>" +
//             "        </tr>" +
//             "        <tr>" +
//             '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
//             '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "                <tbody>" +
//             "				" +
//             "					<tr>" +
//             '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
//             "				" +
//             "			" +
//             "				" +
//             "				<!-- COPYRIGHT TEXT -->" +
//             '					<p id="footer_text">' +
//             "If you have any questions you can get in touch at support.comsec360.com</p>" +
//             "					<p>© 2021 ComSec360</p>" +
//             "                    </td>" +
//             "                    </tr>" +
//             "				" +
//             "	" +
//             "                </tbody>" +
//             "				</table>" +
//             "            </td>" +
//             "        </tr>" +
//             "    </tbody></table>" +
//             "" +
//             "" +
//             "</body></html>",
//         };

//         transporter.sendMail(mailOptions, function (error, info) {
//           if (error) {
//             console.log("error" + error);
//           } else {
//             console.log("Email sent: " + info.response);
//           }
//         });

//         res.status(200).json({
//           status: "200",
//           msg: "Successfully Send Reminder",
//           result: result,
//         });
//       }
//       if (!result) {
//         res.status(200).json({
//           status: "400",
//           msg: "Email Id is not register",
//         });
//       }
//     });
//   } else {
//     res.status(200).json({
//       status: "400",
//       msg: "Invalid Data",
//     });
//   }
// });

// router.post("/sendreminderforinfoupdate", async (req, res) => {
//   let api_url = process.env.APP_URL;
//   let liveAPP_URL = process.env.liveAPP_URL;
//   if (req.body.email != "") {
//     User.findOne({ email: req.body.email }, async (err, result) => {
//       if (err) {
//         res.status(200).json({
//           status: "400",
//           msg: "Something Went Wrong",
//         });
//       }
//       console.log(req.body.email);
//       if (result) {
//         let transporter = nodemailer.createTransport({
//           host: "smtp.gmail.com",
//           port: 465,
//           secure: true,
//           auth: {
//             user: "vikas@synram.co",
//             pass: "Synram@2019",
//           },
//         });

//         let mailOptions = {
//           from: "vikas@synram.co",
//           to: req.body.email,
//           subject: req.body.subject,
//           html:
//             "<!DOCTYPE html>" +
//             "<html><head>" +
//             "    <title>ComSec360 Complete information</title>" +
//             '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
//             "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
//             '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
//             '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
//             '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
//             '    <style type="text/css">' +
//             "     " +
//             "        /* CLIENT-SPECIFIC STYLES */" +
//             "        body," +
//             "        table," +
//             "        td," +
//             "        a {" +
//             "            -webkit-text-size-adjust: 100%;" +
//             "            -ms-text-size-adjust: 100%;" +
//             "        }" +
//             "" +
//             "        table," +
//             "        td {" +
//             "            mso-table-lspace: 0pt;" +
//             "            mso-table-rspace: 0pt;" +
//             "        }" +
//             "" +
//             "        img {" +
//             "            -ms-interpolation-mode: bicubic;" +
//             "        }" +
//             "" +
//             "        /* RESET STYLES */" +
//             "        img {" +
//             "            border: 0;" +
//             "            height: auto;" +
//             "            line-height: 100%;" +
//             "            outline: none;" +
//             "            text-decoration: none;" +
//             "        }" +
//             "" +
//             "        table {" +
//             "            border-collapse: collapse !important;" +
//             "        }" +
//             "" +
//             "        body {" +
//             "            height: 100% !important;" +
//             "            margin: 0 !important;" +
//             "            padding: 0 !important;" +
//             "            width: 100% !important;" +
//             "        }" +
//             "" +
//             "        /* iOS BLUE LINKS */" +
//             "        a[x-apple-data-detectors] {" +
//             "            color: inherit !important;" +
//             "            text-decoration: none !important;" +
//             "            font-size: inherit !important;" +
//             "            font-family: inherit !important;" +
//             "            font-weight: inherit !important;" +
//             "            line-height: inherit !important;" +
//             "        }" +
//             "" +
//             "        /* MOBILE STYLES */" +
//             "        @media screen and (max-width:600px) {" +
//             "            h1 {" +
//             "                font-size: 32px !important;" +
//             "                line-height: 32px !important;" +
//             "            }" +
//             "        }" +
//             "" +
//             "        /* ANDROID CENTER FIX */" +
//             '        div[style*="margin: 16px 0;"] {' +
//             "            margin: 0 !important;" +
//             "        }" +
//             "    </style>" +
//             "</head>" +
//             " <style>" +
//             " #para_text {" +
//             "  padding: 0px 20px;" +
//             "  color: #111111;" +
//             "  font-family: 'Raleway Light', Arial, sans-serif;" +
//             "  font-size: 1.5em;" +
//             "  text-align: center;" +
//             "}" +
//             "#grad1 {" +
//             "  background-color: #E5E5E5;" +
//             "}" +
//             "#link_social" +
//             "{" +
//             "	padding: 5px;" +
//             "	color: #666666;" +
//             "}" +
//             "</style>" +
//             '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
//             "    " +
//             '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "        <!-- LOGO -->" +
//             "        <tbody><tr>" +
//             "           " +
//             '<td align="center">' +
//             '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "                    <tbody><tr>" +
//             '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
//             "                    </tr>" +
//             "                </tbody></table>" +
//             "            </td>" +
//             "        </tr>" +
//             "        <tr>" +
//             '            <td align="center">' +
//             '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "                    <tbody><tr>" +
//             '                        <td style="padding: 30px;  " valign="top" align="center">' +
//             '                           <img style="max-width: 29%; max-height: 50%; " src="' +
//             api_url +
//             '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
//             "                        </td>" +
//             "                    </tr>" +
//             "                </tbody></table>" +
//             "            </td>" +
//             "        </tr>" +
//             "        " +
//             "		<!-- MESSAGE -->" +
//             "		<tr>" +
//             '        <td align="center">' +
//             '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "        <tbody>" +
//             "		<tr>" +
//             '            <td align="center">' +
//             '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "                    <tbody>" +
//             "					<tr>" +
//             '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
//             "                           <h1>" +
//             req.body.message +
//             "</h1>" +
//             "						   " +
//             "						" +
//             "						   " +
//             '							<a href="' +
//             api_url +
//             "/login?userid=" +
//             req.body.id +
//             "&&login=1" +
//             '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">Complete Information</a>' +
//             '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
//             '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
//             liveAPP_URL +
//             "</p>" +
//             '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
//             req.body.email +
//             "</p>" +
//             "                        </td>" +
//             "" +
//             "                    </tr><tr><td><hr><td></tr>" +
//             "" +
//             "                </tbody></table>" +
//             "            </td>" +
//             "        </tr>" +
//             "		</tbody>" +
//             "		</table>" +
//             "        </td>" +
//             "        </tr>" +
//             "        <tr>" +
//             '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
//             '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "                <tbody>" +
//             "				" +
//             "					<tr>" +
//             '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
//             "				" +
//             "			" +
//             "				" +
//             "				<!-- COPYRIGHT TEXT -->" +
//             '					<p id="footer_text">' +
//             "If you have any questions you can get in touch at support.comsec360.com</p>" +
//             "					<p>© 2021 ComSec360</p>" +
//             "                    </td>" +
//             "                    </tr>" +
//             "				" +
//             "	" +
//             "                </tbody>" +
//             "				</table>" +
//             "            </td>" +
//             "        </tr>" +
//             "    </tbody></table>" +
//             "" +
//             "" +
//             "</body></html>",
//         };

//         transporter.sendMail(mailOptions, function (error, info) {
//           if (error) {
//             console.log("error" + error);
//           } else {
//             console.log("Email sent: " + info.response);
//           }
//         });

//         res.status(200).json({
//           status: "200",
//           msg: "Successfully Send Reminder",
//           result: result,
//         });
//       }
//       if (!result) {
//         res.status(200).json({
//           status: "400",
//           msg: "Email Id is not register",
//         });
//       }
//     });
//   } else {
//     res.status(200).json({
//       status: "400",
//       msg: "Invalid Data",
//     });
//   }
// });

// router.post("/sendemailforesign", async (req, res) => {
//   let api_url = process.env.APP_URL;
//   let liveAPP_URL = process.env.liveAPP_URL;
//   if (req.body.email != "") {
//     User.findOne({ email: req.body.email }, async (err, result) => {
//       if (err) {
//         res.status(200).json({
//           status: "400",
//           msg: "Something Went Wrong",
//         });
//       }
//       console.log(req.body.email);
//       if (result) {
//         let transporter = nodemailer.createTransport({
//           host: "smtp.gmail.com",
//           port: 465,
//           secure: true,
//           auth: {
//             user: "vikas@synram.co",
//             pass: "Synram@2019",
//           },
//         });

//         let mailOptions = {
//           from: "vikas@synram.co",
//           to: req.body.email,
//           subject: req.body.subject,
//           html:
//             "<!DOCTYPE html>" +
//             "<html><head>" +
//             "    <title>ComSec360 E-sign</title>" +
//             '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
//             "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
//             '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
//             '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
//             '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
//             '    <style type="text/css">' +
//             "     " +
//             "        /* CLIENT-SPECIFIC STYLES */" +
//             "        body," +
//             "        table," +
//             "        td," +
//             "        a {" +
//             "            -webkit-text-size-adjust: 100%;" +
//             "            -ms-text-size-adjust: 100%;" +
//             "        }" +
//             "" +
//             "        table," +
//             "        td {" +
//             "            mso-table-lspace: 0pt;" +
//             "            mso-table-rspace: 0pt;" +
//             "        }" +
//             "" +
//             "        img {" +
//             "            -ms-interpolation-mode: bicubic;" +
//             "        }" +
//             "" +
//             "        /* RESET STYLES */" +
//             "        img {" +
//             "            border: 0;" +
//             "            height: auto;" +
//             "            line-height: 100%;" +
//             "            outline: none;" +
//             "            text-decoration: none;" +
//             "        }" +
//             "" +
//             "        table {" +
//             "            border-collapse: collapse !important;" +
//             "        }" +
//             "" +
//             "        body {" +
//             "            height: 100% !important;" +
//             "            margin: 0 !important;" +
//             "            padding: 0 !important;" +
//             "            width: 100% !important;" +
//             "        }" +
//             "" +
//             "        /* iOS BLUE LINKS */" +
//             "        a[x-apple-data-detectors] {" +
//             "            color: inherit !important;" +
//             "            text-decoration: none !important;" +
//             "            font-size: inherit !important;" +
//             "            font-family: inherit !important;" +
//             "            font-weight: inherit !important;" +
//             "            line-height: inherit !important;" +
//             "        }" +
//             "" +
//             "        /* MOBILE STYLES */" +
//             "        @media screen and (max-width:600px) {" +
//             "            h1 {" +
//             "                font-size: 32px !important;" +
//             "                line-height: 32px !important;" +
//             "            }" +
//             "        }" +
//             "" +
//             "        /* ANDROID CENTER FIX */" +
//             '        div[style*="margin: 16px 0;"] {' +
//             "            margin: 0 !important;" +
//             "        }" +
//             "    </style>" +
//             "</head>" +
//             " <style>" +
//             " #para_text {" +
//             "  padding: 0px 20px;" +
//             "  color: #111111;" +
//             "  font-family: 'Raleway Light', Arial, sans-serif;" +
//             "  font-size: 1.5em;" +
//             "  text-align: center;" +
//             "}" +
//             "#grad1 {" +
//             "  background-color: #E5E5E5;" +
//             "}" +
//             "#link_social" +
//             "{" +
//             "	padding: 5px;" +
//             "	color: #666666;" +
//             "}" +
//             "</style>" +
//             '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
//             "    " +
//             '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "        <!-- LOGO -->" +
//             "        <tbody><tr>" +
//             "           " +
//             '<td align="center">' +
//             '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "                    <tbody><tr>" +
//             '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
//             "                    </tr>" +
//             "                </tbody></table>" +
//             "            </td>" +
//             "        </tr>" +
//             "        <tr>" +
//             '            <td align="center">' +
//             '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "                    <tbody><tr>" +
//             '                        <td style="padding: 30px;  " valign="top" align="center">' +
//             '                           <img style="max-width: 29%; max-height: 50%; " src="' +
//             api_url +
//             '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
//             "                        </td>" +
//             "                    </tr>" +
//             "                </tbody></table>" +
//             "            </td>" +
//             "        </tr>" +
//             "        " +
//             "		<!-- MESSAGE -->" +
//             "		<tr>" +
//             '        <td align="center">' +
//             '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "        <tbody>" +
//             "		<tr>" +
//             '            <td align="center">' +
//             '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "                    <tbody>" +
//             "					<tr>" +
//             '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
//             "                           <h1>" +
//             req.body.message +
//             "</h1>" +
//             "						   " +
//             "						" +
//             "						   " +
//             '							<a href="' +
//             api_url +
//             "/login?companyid=" +
//             req.body.companyid +
//             "&userid=" +
//             req.body.id +
//             "&tabname=1&login=1" +
//             '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">E-sign</a>' +
//             '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
//             '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
//             liveAPP_URL +
//             "</p>" +
//             '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
//             req.body.email +
//             "</p>" +
//             "                        </td>" +
//             "" +
//             "                    </tr><tr><td><hr><td></tr>" +
//             "" +
//             "                </tbody></table>" +
//             "            </td>" +
//             "        </tr>" +
//             "		</tbody>" +
//             "		</table>" +
//             "        </td>" +
//             "        </tr>" +
//             "        <tr>" +
//             '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
//             '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "                <tbody>" +
//             "				" +
//             "					<tr>" +
//             '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
//             "				" +
//             "			" +
//             "				" +
//             "				<!-- COPYRIGHT TEXT -->" +
//             '					<p id="footer_text">' +
//             "If you have any questions you can get in touch at support.comsec360.com</p>" +
//             "					<p>© 2021 ComSec360</p>" +
//             "                    </td>" +
//             "                    </tr>" +
//             "				" +
//             "	" +
//             "                </tbody>" +
//             "				</table>" +
//             "            </td>" +
//             "        </tr>" +
//             "    </tbody></table>" +
//             "" +
//             "" +
//             "</body></html>",
//         };

//         transporter.sendMail(mailOptions, function (error, info) {
//           if (error) {
//             console.log("error" + error);
//           } else {
//             let company_id = req.body.companyid;
//             let createdby = req.body.id;

//             let esigndatadata = {
//               company_id: company_id,
//               userid: createdby,
//               esignforcompanyinfo: "",
//               gsignforcompanyinfo: "",
//               sendemailesign: "1",
//               sendemailgsign: "",
//             };
//             console.log("error" + esigndatadata);
//             Esign.find(
//               {
//                 company_id: company_id,
//                 userid: createdby,
//               },
//               async (err, result) => {
//                 console.log("result" + result);
//                 if (result != "") {
//                   console.log("error" + error);
//                 }
//                 if (result == "") {
//                   let esigndatadata1 = Esign(esigndatadata);
//                   let esigndatadataresponse = await esigndatadata1.save();

//                   if (esigndatadataresponse) {
//                   } else {
//                   }
//                 }
//               }
//             );
//             // User.updateOne(
//             //   { email: req.body.email },
//             //   {
//             //     $set: {
//             //       company_info_esign: '1',
//             //     },
//             //   },
//             //   (err, result) => {
//             //     if (err) {

//             //     } else {

//             //     }
//             //   }
//             // );

//             // console.log("Email sent: " + info.response);
//           }
//         });

//         res.status(200).json({
//           status: "200",
//           msg: "Successfully Send",
//           result: result,
//         });
//       }
//       if (!result) {
//         res.status(200).json({
//           status: "400",
//           msg: "Email Id is not register",
//         });
//       }
//     });
//   } else {
//     res.status(200).json({
//       status: "400",
//       msg: "Invalid Data",
//     });
//   }
// });

// router.post("/sendemailforgsign", async (req, res) => {
//   let api_url = process.env.APP_URL;
//   let liveAPP_URL = process.env.liveAPP_URL;
//   if (req.body.email != "") {
//     User.findOne({ email: req.body.email }, async (err, result) => {
//       if (err) {
//         res.status(200).json({
//           status: "400",
//           msg: "Something Went Wrong",
//         });
//       }
//       console.log(req.body.email);
//       if (result) {
//         let transporter = nodemailer.createTransport({
//           host: "smtp.gmail.com",
//           port: 465,
//           secure: true,
//           auth: {
//             user: "vikas@synram.co",
//             pass: "Synram@2019",
//           },
//         });

//         let mailOptions = {
//           from: "vikas@synram.co",
//           to: req.body.email,
//           subject: req.body.subject,
//           html:
//             "<!DOCTYPE html>" +
//             "<html><head>" +
//             "    <title>ComSec360 E-sign</title>" +
//             '	<link rel="stylesheet" href="css/font-awesome.min.css">' +
//             "	<link href='https://fonts.googleapis.com/css?family=Raleway' rel='stylesheet'>" +
//             '    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">' +
//             '    <meta name="viewport" content="width=device-width, initial-scale=1">' +
//             '    <meta http-equiv="X-UA-Compatible" content="IE=edge">' +
//             '    <style type="text/css">' +
//             "     " +
//             "        /* CLIENT-SPECIFIC STYLES */" +
//             "        body," +
//             "        table," +
//             "        td," +
//             "        a {" +
//             "            -webkit-text-size-adjust: 100%;" +
//             "            -ms-text-size-adjust: 100%;" +
//             "        }" +
//             "" +
//             "        table," +
//             "        td {" +
//             "            mso-table-lspace: 0pt;" +
//             "            mso-table-rspace: 0pt;" +
//             "        }" +
//             "" +
//             "        img {" +
//             "            -ms-interpolation-mode: bicubic;" +
//             "        }" +
//             "" +
//             "        /* RESET STYLES */" +
//             "        img {" +
//             "            border: 0;" +
//             "            height: auto;" +
//             "            line-height: 100%;" +
//             "            outline: none;" +
//             "            text-decoration: none;" +
//             "        }" +
//             "" +
//             "        table {" +
//             "            border-collapse: collapse !important;" +
//             "        }" +
//             "" +
//             "        body {" +
//             "            height: 100% !important;" +
//             "            margin: 0 !important;" +
//             "            padding: 0 !important;" +
//             "            width: 100% !important;" +
//             "        }" +
//             "" +
//             "        /* iOS BLUE LINKS */" +
//             "        a[x-apple-data-detectors] {" +
//             "            color: inherit !important;" +
//             "            text-decoration: none !important;" +
//             "            font-size: inherit !important;" +
//             "            font-family: inherit !important;" +
//             "            font-weight: inherit !important;" +
//             "            line-height: inherit !important;" +
//             "        }" +
//             "" +
//             "        /* MOBILE STYLES */" +
//             "        @media screen and (max-width:600px) {" +
//             "            h1 {" +
//             "                font-size: 32px !important;" +
//             "                line-height: 32px !important;" +
//             "            }" +
//             "        }" +
//             "" +
//             "        /* ANDROID CENTER FIX */" +
//             '        div[style*="margin: 16px 0;"] {' +
//             "            margin: 0 !important;" +
//             "        }" +
//             "    </style>" +
//             "</head>" +
//             " <style>" +
//             " #para_text {" +
//             "  padding: 0px 20px;" +
//             "  color: #111111;" +
//             "  font-family: 'Raleway Light', Arial, sans-serif;" +
//             "  font-size: 1.5em;" +
//             "  text-align: center;" +
//             "}" +
//             "#grad1 {" +
//             "  background-color: #E5E5E5;" +
//             "}" +
//             "#link_social" +
//             "{" +
//             "	padding: 5px;" +
//             "	color: #666666;" +
//             "}" +
//             "</style>" +
//             '<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">' +
//             "    " +
//             '    <table id="grad1" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "        <!-- LOGO -->" +
//             "        <tbody><tr>" +
//             "           " +
//             '<td align="center">' +
//             '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "                    <tbody><tr>" +
//             '                        <td style="padding: 10px;" valign="top" align="center"> </td>' +
//             "                    </tr>" +
//             "                </tbody></table>" +
//             "            </td>" +
//             "        </tr>" +
//             "        <tr>" +
//             '            <td align="center">' +
//             '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "                    <tbody><tr>" +
//             '                        <td style="padding: 30px;  " valign="top" align="center">' +
//             '                           <img style="max-width: 29%; max-height: 50%; " src="' +
//             api_url +
//             '/assets/loginlogo.png" style="display: block; border: 0px; width:50%;">' +
//             "                        </td>" +
//             "                    </tr>" +
//             "                </tbody></table>" +
//             "            </td>" +
//             "        </tr>" +
//             "        " +
//             "		<!-- MESSAGE -->" +
//             "		<tr>" +
//             '        <td align="center">' +
//             '        <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "        <tbody>" +
//             "		<tr>" +
//             '            <td align="center">' +
//             '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "                    <tbody>" +
//             "					<tr>" +
//             '                        <td style=" background: transparent; background-position: left bottom; color: #111111; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 400; " valign="top" bgcolor="#ffffff" align="center">' +
//             "                           <h1>" +
//             req.body.message +
//             "</h1>" +
//             "						   " +
//             "						" +
//             "						   " +
//             '							<a href="' +
//             api_url +
//             "/login?companyid=" +
//             req.body.companyid +
//             "&userid=" +
//             req.body.id +
//             "&tabname=1&login=1" +
//             '" target="_blank" style="background-color: #3CBAC6 !important; font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 50px; border-radius: 8px; display: inline-block;">E-sign</a>' +
//             '							<p id="para_text" valign="top">Your ComSec360 Team</p>' +
//             '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Account\'s URL:</b><br>' +
//             liveAPP_URL +
//             "</p>" +
//             '								<p id="para_text" valign="top" style="font-size:17px;"><b style="font-size:20px;">Your Login Email:</b><br>' +
//             req.body.email +
//             "</p>" +
//             "                        </td>" +
//             "" +
//             "                    </tr><tr><td><hr><td></tr>" +
//             "" +
//             "                </tbody></table>" +
//             "            </td>" +
//             "        </tr>" +
//             "		</tbody>" +
//             "		</table>" +
//             "        </td>" +
//             "        </tr>" +
//             "        <tr>" +
//             '            <td style="padding: 0px 10px 0px 10px;" align="center">' +
//             '                <table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0">' +
//             "                <tbody>" +
//             "				" +
//             "					<tr>" +
//             '                    <td style="padding: 0px 30px; color: #666666; font-family: \'Raleway Light\', Arial, sans-serif; font-size: 15px; font-weight: 400;" align="center">' +
//             "				" +
//             "			" +
//             "				" +
//             "				<!-- COPYRIGHT TEXT -->" +
//             '					<p id="footer_text">' +
//             "If you have any questions you can get in touch at support.comsec360.com</p>" +
//             "					<p>© 2021 ComSec360</p>" +
//             "                    </td>" +
//             "                    </tr>" +
//             "				" +
//             "	" +
//             "                </tbody>" +
//             "				</table>" +
//             "            </td>" +
//             "        </tr>" +
//             "    </tbody></table>" +
//             "" +
//             "" +
//             "</body></html>",
//         };

//         transporter.sendMail(mailOptions, function (error, info) {
//           if (error) {
//             console.log("error" + error);
//           } else {
//             let company_id = req.body.companyid;
//             let createdby = req.body.id;

//             let esigndatadata = {
//               company_id: company_id,
//               userid: createdby,
//               esignforcompanyinfo: "",
//               gsignforcompanyinfo: "",
//               sendemailesign: "",
//               sendemailgsign: "1",
//             };
//             console.log("error" + esigndatadata);
//             Esign.find(
//               {
//                 company_id: company_id,
//                 userid: createdby,
//               },
//               async (err, result) => {
//                 console.log("result" + result);
//                 if (result != "") {
//                   Esign.updateOne(
//                     { company_id: company_id, userid: createdby },
//                     {
//                       $set: {
//                         sendemailgsign: "1",
//                       },
//                     },
//                     (err, result) => {
//                       if (err) {
//                         // res.status(200).json({
//                         //   status: "400",
//                         //   msg: "Updation failed",
//                         // });
//                       } else {
//                         // return res.status(200).json({
//                         //   status: "200",
//                         //   msg: "Sucessfully Updated",
//                         // });
//                       }
//                     }
//                   );

//                   console.log("error" + error);
//                 }
//                 if (result == "") {
//                   let esigndatadata1 = Esign(esigndatadata);
//                   let esigndatadataresponse = await esigndatadata1.save();

//                   if (esigndatadataresponse) {
//                   } else {
//                   }
//                 }
//               }
//             );
//             // User.updateOne(
//             //   { email: req.body.email },
//             //   {
//             //     $set: {
//             //       company_info_esign: '1',
//             //     },
//             //   },
//             //   (err, result) => {
//             //     if (err) {

//             //     } else {

//             //     }
//             //   }
//             // );

//             // console.log("Email sent: " + info.response);
//           }
//         });

//         res.status(200).json({
//           status: "200",
//           msg: "Successfully Send",
//           result: result,
//         });
//       }
//       if (!result) {
//         res.status(200).json({
//           status: "400",
//           msg: "Email Id is not register",
//         });
//       }
//     });
//   } else {
//     res.status(200).json({
//       status: "400",
//       msg: "Invalid Data",
//     });
//   }
// });

module.exports = router;
