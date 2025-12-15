import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

// Initialize Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

export async function POST(request: Request) {
  console.log('Received request to send email')
  try {
    const { to, subject, message, userType, userName, emailType } = await request.json()

    // Validate required fields
    if (!to || !subject || !message || !emailType) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, message, emailType' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    let htmlMessage = ''

    switch (emailType) {
      case 'REGISTRATION_PENDING':
        htmlMessage = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${subject}</title>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #134686; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>Marinex</h1>
                <p>Maritime Excellence Platform</p>
              </div>
              <div class="content">
                <h2>Registration Received</h2>
                <p>Dear ${userName},</p>
                <p>Thank you for registering with Marinex. Your application for a ${userType} account is currently under review by our administrators.</p>
                <p>You will receive another email once your account has been approved. This process usually takes 1-2 business days.</p>
                <p>If you have any questions in the meantime, please feel free to contact our support team.</p>
              </div>
              <div class="footer">
                <p>Best regards,<br>Marinex Authority Team</p>
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </body>
          </html>
        `
        break
      case 'REGISTRATION_APPROVED':
        htmlMessage = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${subject}</title>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #134686; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
                .account-details { background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #134686; }
                .button { display: inline-block; background-color: #134686; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>Marinex</h1>
                <p>Maritime Excellence Platform</p>
              </div>
              <div class="content">
                <h2>Account Approval Notification</h2>
                <p>Dear ${userName},</p>
                <p>We are pleased to inform you that your account application for Marinex has been approved!</p>
                <p>Your ${userType} account is now active and you can access all the features and services available on our platform.</p>
                
                <div class="account-details">
                  <h3>Account Details:</h3>
                  <ul>
                    <li><strong>Email:</strong> ${to}</li>
                    <li><strong>Account Type:</strong> ${userType}</li>
                    <li><strong>Status:</strong> Active</li>
                  </ul>
                </div>
                
                <p>You can now log in to your account and start using Marinex services.</p>
                <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
                <p><strong>Welcome to Marinex!</strong></p>
              </div>
              <div class="footer">
                <p>Best regards,<br>Marinex Authority Team</p>
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </body>
          </html>
        `
        break
      case 'REGISTRATION_REJECTED':
        htmlMessage = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${subject}</title>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #134686; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
                .account-details { background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #134686; }
                .rejection-reason { background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
                .button { display: inline-block; background-color: #134686; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>Marinex</h1>
                <p>Maritime Excellence Platform</p>
              </div>
              <div class="content">
                <h2>Account Application Review</h2>
                <p>Dear ${userName},</p>
                <p>Thank you for your interest in joining Marinex. After reviewing your ${userType} account application, we need additional information or clarification before we can approve your account.</p>
                
                <div class="rejection-reason">
                  <h3>Reason for Rejection:</h3>
                  <p>${message.split('Reason for rejection:')[1]?.split('Please review')[0]?.trim() || 'Additional information required'}</p>
                </div>
                
                <p>Please review the above feedback and resubmit your application with the necessary corrections or additional documentation.</p>
                <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
                <p>We look forward to welcoming you to Marinex once the required information is provided.</p>
              </div>
              <div class="footer">
                <p>Best regards,<br>Marinex Authority Team</p>
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </body>
          </html>
        `
        break
      case 'ACCOUNT_SUSPENDED':
        htmlMessage = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${subject}</title>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #134686; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
                .suspension-reason { background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>Marinex</h1>
                <p>Maritime Excellence Platform</p>
              </div>
              <div class="content">
                <h2>Account Suspension Notice</h2>
                <p>Dear ${userName},</p>
                <p>We are writing to inform you that your ${userType} account on Marinex has been suspended.</p>
                <div class="suspension-reason">
                  <h3>Reason for Suspension:</h3>
                  <p>${message}</p>
                </div>
                <p>Your account access has been temporarily restricted. You will not be able to log in to your account until the suspension is lifted.</p>
                <p>If you believe this suspension is in error or if you have any questions, please contact our support team immediately.</p>
                <p>We appreciate your understanding and cooperation.</p>
              </div>
              <div class="footer">
                <p>Best regards,<br>Marinex Authority Team</p>
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </body>
          </html>
        `
        break
      case 'ACCOUNT_REACTIVATED':
        htmlMessage = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${subject}</title>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #134686; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>Marinex</h1>
                <p>Maritime Excellence Platform</p>
              </div>
              <div class="content">
                <h2>Account Reactivation Notice</h2>
                <p>Dear ${userName},</p>
                <p>We are pleased to inform you that your ${userType} account on Marinex has been reactivated.</p>
                <p>Your account suspension has been lifted and you now have full access to all Marinex services and features.</p>
                <p>You can now log in to your account and resume using Marinex services.</p>
                <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
                <p>Welcome back to Marinex!</p>
              </div>
              <div class="footer">
                <p>Best regards,<br>Marinex Authority Team</p>
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </body>
          </html>
        `
        break
      default:
        return NextResponse.json({ error: 'Invalid emailType' }, { status: 400 })
    }


    // Prepare the email
    const mailOptions = {
      from: `"Marinex" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: htmlMessage,
      text: message,
    }

    console.log('Sending email with options:', mailOptions)

    // Send the.
    const result = await transporter.sendMail(mailOptions)
    
    console.log('Email sent successfully:', result.messageId)
    console.log('Sent to:', to)
    console.log('Subject:', subject)

    return NextResponse.json({ 
      success: true, 
      message: 'Email sent successfully',
      messageId: result.messageId
    })
  } catch (error: unknown) {
    console.error('Error sending email:', error)
    
    return NextResponse.json(
      { error: 'Failed to send email. Please try again later.' },
      { status: 500 }
    )
  }
}
