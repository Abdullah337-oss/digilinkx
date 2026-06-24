const nodemailer = require('nodemailer');

// Create email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Send password reset email
const sendPasswordResetEmail = async (userEmail, resetCode) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: userEmail,
      subject: 'Password Reset Request - Todo App',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p style="color: #666; font-size: 14px;">We received a request to reset your password. Use the code below to proceed:</p>
          
          <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="font-size: 12px; color: #999; margin: 0 0 10px 0;">Your Reset Code</p>
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0079bf; margin: 0;">${resetCode}</p>
          </div>
          
          <p style="color: #666; font-size: 14px;">This code is valid for 10 minutes.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request a password reset, please ignore this email.</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">TODO App - Password Reset</p>
        </div>
      `,
      text: `Your password reset code is: ${resetCode}\nThis code is valid for 10 minutes.`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email: ' + error.message);
  }
};

module.exports = {
  sendPasswordResetEmail,
};
