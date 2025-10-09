import { NextResponse } from 'next/server'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

// Initialize SES client
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

export async function POST(request: Request) {
  try {
    const { to, subject, message, userType, userName } = await request.json()

    // Validate required fields
    if (!to || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, message' },
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

    // Create HTML version of the email
    const isRejectionEmail = subject.includes('Additional Information Required')
    
    const htmlMessage = isRejectionEmail ? `
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
    ` : `
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

    // Prepare the email command
    const command = new SendEmailCommand({
      Source: process.env.AWS_SES_FROM_EMAIL || 'noreply@example.com', // Must be verified in AWS SES
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlMessage,
            Charset: 'UTF-8',
          },
          Text: {
            Data: message,
            Charset: 'UTF-8',
          },
        },
      },
    })

    // Send the email
    const result = await sesClient.send(command)
    
    console.log('Email sent successfully:', result.MessageId)
    console.log('Sent to:', to)
    console.log('Subject:', subject)

    return NextResponse.json({ 
      success: true, 
      message: 'Email sent successfully',
      messageId: result.MessageId
    })
  } catch (error: unknown) {
    console.error('Error sending email:', error)
    
    // Handle specific AWS SES errors
    if (error && typeof error === 'object' && 'name' in error && error.name === 'MessageRejected') {
      return NextResponse.json(
        { error: 'Email was rejected. Please check the recipient email address.' },
        { status: 400 }
      )
    } else if (error && typeof error === 'object' && 'name' in error && error.name === 'MailFromDomainNotVerifiedException') {
      return NextResponse.json(
        { error: 'Sender email domain not verified in AWS SES.' },
        { status: 500 }
      )
    } else if (error && typeof error === 'object' && 'name' in error && error.name === 'ConfigurationSetDoesNotExistException') {
      return NextResponse.json(
        { error: 'Email configuration error.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to send email. Please try again later.' },
      { status: 500 }
    )
  }
}
