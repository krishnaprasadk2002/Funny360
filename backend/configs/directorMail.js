const nodemailer = require('nodemailer');

function sendDirectorInvitationEmail(email, name, classOfShares, noOfShares) {
    const transporter = nodemailer.createTransport({
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
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Invitation to Become a Director in SYNRAM TECHNOLAB",
      html: `
        <h1>Director Invitation</h1>
        <p>Dear ${name},</p>
        <p>You have been invited to join SYNRAM TECHNOLAB with the following details:</p>
        <ul>
          <li>Class of Shares: ${classOfShares}</li>
          <li>Number of Shares: ${noOfShares}</li>
        </ul>
        <p>Please accept this invitation to formalize your role.</p>
        <p>Best Regards,<br>SYNRAM TECHNOLAB Team</p>
      `,
    };
  
    return transporter.sendMail(mailOptions);
  }
  
  exports.sendDirectorInvitationEmail = sendDirectorInvitationEmail