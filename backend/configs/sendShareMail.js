const nodemailer = require('nodemailer');

function sendShareInvitationEmail(email, name, classOfShares, noOfShares) {
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
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Invitation to Become a Shareholder in SYNRAM TECHNOLAB",
      html: `
        <h1>Shareholder Invitation</h1>
        <p>Dear ${name},</p>
        <p>You have been invited to become a shareholder.</p>
        <p>Details:</p>
        <ul>
          <li>Name: ${name}</li>
          <li>Email: ${email}</li>
          <li>Class of Shares: ${classOfShares}</li>
          <li>Number of Shares: ${noOfShares}</li>
        </ul>
        <p>We look forward to having you as a shareholder!</p>
        <p>Best Regards,<br>SYNRAM TECHNOLAB Team</p>
      `,
    };
  
    return transporter.sendMail(mailOptions);
  }
  
  exports.sendShareInvitationEmail = sendShareInvitationEmail;