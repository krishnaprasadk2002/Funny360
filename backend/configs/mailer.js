// mailer.js
const nodemailer = require('nodemailer');

function sendOtpEmail(email, otp){
    let transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: "prasadkrishna1189@gmail.com",
      to: email,
      subject: "verify your email in SYNRAM TECHNOLAB",
      html: `your otp is:${otp}`,
    };
    return transporter.sendMail(mailOptions);
  }
exports.sendOtpEmail = sendOtpEmail
