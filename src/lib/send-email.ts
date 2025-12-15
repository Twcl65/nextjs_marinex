import nodemailer from 'nodemailer';

// IMPORTANT: To use this function, you need to set up a Gmail account with an App Password.
// 1. Enable 2-Step Verification for your Gmail account.
// 2. Generate an App Password for Mail on your computer.
// 3. Add the following to your .env.local file:
//    EMAIL_USER=your_gmail@gmail.com
//    EMAIL_PASS=your_16_character_app_password

export async function sendPasswordResetEmail(email: string, url: string) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    const errorMessage = 'Email credentials (EMAIL_USER and EMAIL_PASS) are not set in your .env.local file. Please add them to enable email sending.';
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Marinex" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Reset Request',
    text: `You are receiving this email because you (or someone else) has requested the reset of the password for your account.\n\nPlease click on the following link, or paste this into your browser to complete the process:\n\n${url}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.\n`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    // In a real app, you might want to throw this error or handle it in a way
    // that informs the user that the email could not be sent.
    throw new Error('Failed to send password reset email.');
  }
}

export async function sendNotificationEmail(email: string, subject: string, htmlMessage: string) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    const errorMessage = 'Email credentials (EMAIL_USER and EMAIL_PASS) are not set in your .env.local file. Please add them to enable email sending.';
    console.error(errorMessage);
    // Don't throw an error, just log it, so the rest of the process can continue
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Marinex" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: subject,
    html: htmlMessage, // Use html instead of text for better formatting
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Notification email sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending notification email:', error);
    // We don't want to block the main API response if email fails
  }
}
