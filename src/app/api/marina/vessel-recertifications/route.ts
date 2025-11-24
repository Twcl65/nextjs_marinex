import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import crypto from 'crypto'

const prisma = new PrismaClient()

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const search = searchParams.get('search') || ''

    // Build the where clause
    const whereClause: {
      status?: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
      OR?: Array<{
        vesselName?: { contains: string; mode: 'insensitive' }
        vesselImoNumber?: { contains: string; mode: 'insensitive' }
        companyName?: { contains: string; mode: 'insensitive' }
      }>
    } = {}

    // Add status filter
    if (status !== 'all') {
      whereClause.status = status as 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
    }

    // Add search functionality
    if (search) {
      whereClause.OR = [
        {
          vesselName: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          vesselImoNumber: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          companyName: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ]
    }

    const recertifications = await prisma.drydockVesselRecertificate.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            fullName: true,
            logoUrl: true
          }
        },
        vessel: {
          select: {
            vesselName: true,
            imoNumber: true,
            shipType: true,
            flag: true,
            yearOfBuild: true,
            lengthOverall: true,
            grossTonnage: true,
            vesselImageUrl: true,
            vesselCertificationExpiry: true
          }
        }
      },
      orderBy: {
        requestedDate: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: recertifications
    })

  } catch (error) {
    console.error('Error fetching vessel recertifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vessel recertifications' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { recertificateId, action } = body

    if (!recertificateId || !action) {
      return NextResponse.json(
        { error: 'recertificateId and action are required' },
        { status: 400 }
      )
    }

    if (action === 'recertificate') {
      try {
        // Get the recertification request
        const recertification = await prisma.drydockVesselRecertificate.findUnique({
          where: { id: recertificateId },
          include: {
            user: true,
            vessel: true
          }
        })

        if (!recertification) {
          return NextResponse.json(
            { error: 'Recertification request not found' },
            { status: 404 }
          )
        }

        console.log('Generating certificate for:', recertification.vesselName)
        console.log('AWS Config:', {
          region: process.env.AWS_REGION,
          bucket: process.env.AWS_S3_BUCKET,
          hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
          hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY
        })

        // Generate certificate PDF
        const certificateBuffer = await generateVesselCertificate(recertification)
        console.log('Certificate generated, size:', certificateBuffer.length)

        // Upload to S3 (with ACL fallback for buckets that don't allow ACLs)
        const fileName = `vessel-certificate-${recertificateId}-${Date.now()}.pdf`
        console.log('Uploading to S3:', fileName)
        
        try {
          await s3Client.send(new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET!,
            Key: `certificates/${fileName}`,
            Body: certificateBuffer,
            ContentType: 'application/pdf',
            ACL: 'public-read',
          }))
          console.log(`[Recertification] Certificate uploaded with public-read ACL`)
        } catch (aclError: unknown) {
          console.warn(`[Recertification] ACL upload failed, trying without ACL:`, aclError)
          
          // Retry without ACL (bucket policy might handle public access)
          await s3Client.send(new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET!,
            Key: `certificates/${fileName}`,
            Body: certificateBuffer,
            ContentType: 'application/pdf',
            // No ACL - rely on bucket policy
          }))
          console.log(`[Recertification] Certificate uploaded without ACL (using bucket policy)`)
        }

        // Generate a signed URL for the certificate (valid for 7 days - maximum allowed)
        const signedUrl = await getSignedUrl(s3Client, new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET!,
          Key: `certificates/${fileName}`,
        }), { expiresIn: 604800 }) // 7 days in seconds (604800 = 7 * 24 * 60 * 60)

        console.log('Certificate uploaded to:', signedUrl)

        // Calculate new expiry date (5 years from now)
        const newExpiryDate = new Date()
        newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 5)

        // Update the recertification record and vessel certificate expiry
        const updatedRecertification = await prisma.drydockVesselRecertificate.update({
          where: { id: recertificateId },
          data: {
            status: 'COMPLETED',
            vesselCertificateFile: signedUrl,
            updatedAt: new Date()
          }
        })

        // Update vessel certificate expiry date
        await prisma.shipVessel.update({
          where: { id: recertification.vesselId },
          data: {
            vesselCertificationExpiry: newExpiryDate,
            updatedAt: new Date()
          }
        })

        console.log('Database updated successfully')
        console.log(`Vessel certificate expiry updated to: ${newExpiryDate.toISOString()}`)

        // Send notification to shipowner
        try {
          const notificationMessage = `Dear **${recertification.companyName || 'Valued Customer'}**,

We are pleased to inform you that your vessel recertification request for **${recertification.vesselName}** (IMO: ${recertification.vesselImoNumber}) has been approved and completed.

Your vessel certificate has been generated and is now available for download. The certificate is valid for five years from the issue date.

You can access your certificate through your vessel recertification dashboard.

If you have any questions or need assistance, please feel free to contact us.

Thank you for using our services.

Best regards,
**Maritime Industry Authority**`

          // Create notification
          const notificationId = crypto.randomUUID()
          
          await prisma.$executeRaw`
            INSERT INTO drydock_mc_notifications (
              id, userId, vesselId, drydockReport, drydockCertificate, 
              safetyCertificate, vesselPlans, title, type, message, 
              isRead, createdAt, updatedAt
            ) VALUES (
              ${notificationId}, ${recertification.userId}, ${recertification.vesselId}, 
              0, 0, 0, 0,
              'Vessel Recertification Approved', 'Vessel Recertification',
              ${notificationMessage}, 0, NOW(), NOW()
            )
          `

          console.log('Notification created successfully:', notificationId)

          // Send SMS notification if user has contact number
          let smsSent = false
          let smsError = null
          
          if (recertification.user.contactNumber) {
            try {
              // Format phone number (handle formats like: 09166879159, +639166879159, 9166879159)
              let phoneNumber = recertification.user.contactNumber.trim().replace(/\s+/g, '')
              
              // Remove any non-digit characters except +
              phoneNumber = phoneNumber.replace(/[^\d+]/g, '')
              
              // Handle different phone number formats (same as mc-notifications)
              if (phoneNumber.startsWith('+63')) {
                // Already in international format: +639166879159
                // Just validate it has 10 digits after +63
                const digits = phoneNumber.substring(3)
                if (digits.length !== 10) {
                  throw new Error(`Invalid phone number length: ${phoneNumber}. Expected 10 digits after +63`)
                }
              } else if (phoneNumber.startsWith('63') && phoneNumber.length === 12) {
                // Format: 639166879159 (missing +)
                phoneNumber = `+${phoneNumber}`
              } else if (phoneNumber.startsWith('0') && phoneNumber.length === 11) {
                // Format: 09166879159 (local format with leading 0)
                phoneNumber = phoneNumber.substring(1) // Remove leading 0
                phoneNumber = `+63${phoneNumber}`
              } else if (phoneNumber.length === 10 && /^9\d{9}$/.test(phoneNumber)) {
                // Format: 9166879159 (10 digits starting with 9)
                phoneNumber = `+63${phoneNumber}`
              } else {
                throw new Error(`Invalid phone number format: ${recertification.user.contactNumber}. Supported formats: 09166879159, 9166879159, +639166879159`)
              }

              // Final validation: should be +63 followed by exactly 10 digits
              if (!/^\+63\d{10}$/.test(phoneNumber)) {
                throw new Error(`Invalid phone number format after processing: ${phoneNumber}. Expected format: +639123456789`)
              }

              console.log(`Formatted phone number: ${recertification.user.contactNumber} -> ${phoneNumber}`)

              // Prepare SMS message (plain text version of notification)
              const smsMessage = `Dear ${recertification.companyName || 'Valued Customer'},

We are pleased to inform you that your vessel recertification request for ${recertification.vesselName} (IMO: ${recertification.vesselImoNumber}) has been approved and completed.

Your vessel certificate has been generated and is now available for download. The certificate is valid for five years from the issue date.

You can access your certificate through your vessel recertification dashboard.

Thank you for using our services.

Best regards,
Maritime Industry Authority`

              // Send SMS using TextBee.dev API (same format as mc-notifications)
              const textbeeApiKey = process.env.TEXTBEE_API_KEY || 'ceedf0f3-b0b3-43e4-af6a-aa5a2745f4c1'
              const textbeeDeviceId = process.env.TEXTBEE_DEVICE_ID || '69232a9382033f1609eb65b1'
              
              const textbeeApiUrl = `https://api.textbee.dev/api/v1/gateway/devices/${textbeeDeviceId}/send-sms`

              console.log('Sending SMS via TextBee.dev to:', phoneNumber)
              console.log('TextBee Device ID:', textbeeDeviceId)
              console.log('TextBee API URL:', textbeeApiUrl)

              const smsResponse = await fetch(textbeeApiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': textbeeApiKey,
                },
                body: JSON.stringify({
                  recipients: [phoneNumber],
                  message: smsMessage,
                }),
              })

              console.log('SMS API Response Status:', smsResponse.status)
              
              // Get response text first (can only read once)
              const responseText = await smsResponse.text()
              console.log('SMS API Response Text:', responseText)

              // Check if response is OK
              if (!smsResponse.ok) {
                console.error('SMS API HTTP Error:', smsResponse.status, responseText)
                smsError = `HTTP ${smsResponse.status}: ${responseText.substring(0, 200)}`
              } else {
                // Try to parse JSON response
                try {
                  const smsResult = JSON.parse(responseText)
                  console.log('SMS API Response (parsed):', smsResult)

                  // TextBee.dev typically returns success in response data
                  if (smsResult.success || smsResult.status === 'success' || smsResponse.ok) {
                    smsSent = true
                    console.log('SMS sent successfully via TextBee.dev:', smsResult)
                  } else {
                    smsError = smsResult.error || smsResult.message || 'Failed to send SMS'
                    console.error('SMS API error:', smsError)
                  }
                } catch (parseError) {
                  console.error('Failed to parse SMS API response as JSON:', parseError)
                  console.error('Response text:', responseText)
                  // If it's not JSON but status is OK, might still be successful
                  if (smsResponse.ok && responseText.toLowerCase().includes('success')) {
                    smsSent = true
                    console.log('SMS appears to be sent (non-JSON success response)')
                  } else {
                    smsError = `Invalid response format: ${responseText.substring(0, 200)}`
                  }
                }
              }
            } catch (error) {
              smsError = error instanceof Error ? error.message : 'Unknown SMS error'
              console.error('Error sending SMS:', error)
              // Don't fail the notification if SMS fails
            }
          } else {
            console.log('SMS not sent: User does not have a contact number')
            console.log('User object:', { 
              userId: recertification.userId, 
              fullName: recertification.user.fullName,
              contactNumber: recertification.user.contactNumber 
            })
          }

          console.log('Notification and SMS processing completed', { smsSent, smsError })
        } catch (notificationError) {
          // Log error but don't fail the request
          console.error('Error creating notification or sending SMS:', notificationError)
        }

        return NextResponse.json({
          success: true,
          message: 'Vessel recertified successfully',
          data: updatedRecertification
        })
      } catch (error) {
        console.error('Error in recertificate action:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
          { error: 'Failed to recertificate vessel: ' + errorMessage },
          { status: 500 }
        )
      }
    }

    if (action === 'reject') {
      const updatedRecertification = await prisma.drydockVesselRecertificate.update({
        where: { id: recertificateId },
        data: {
          status: 'REJECTED',
          updatedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Vessel recertification rejected',
        data: updatedRecertification
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error processing recertification:', error)
    return NextResponse.json(
      { error: 'Failed to process recertification' },
      { status: 500 }
    )
  }
}

interface RecertificationData {
  id: string
  vesselName: string | null
  vesselImoNumber: string | null
  companyName: string | null
  vessel?: {
    shipType?: string | null
    flag?: string | null
    yearOfBuild?: number | null
    lengthOverall?: number | null
    grossTonnage?: number | null
  } | null
}

async function generateVesselCertificate(recertification: RecertificationData): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842]) // A4 size
    const { height } = page.getSize()

    // Load fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // Title
    page.drawText('VESSEL RECERTIFICATION CERTIFICATE', {
      x: 50,
      y: height - 100,
      size: 20,
      font: helveticaBold,
      color: rgb(0, 0, 0)
    })

    // Certificate details
    const details = [
      { label: 'Certificate Number:', value: `VRC-${recertification.id.slice(-8).toUpperCase()}` },
      { label: 'Vessel Name:', value: recertification.vesselName || 'N/A' },
      { label: 'IMO Number:', value: recertification.vesselImoNumber || 'N/A' },
      { label: 'Company:', value: recertification.companyName || 'N/A' },
      { label: 'Ship Type:', value: recertification.vessel?.shipType || 'N/A' },
      { label: 'Flag:', value: recertification.vessel?.flag || 'N/A' },
      { label: 'Year of Build:', value: recertification.vessel?.yearOfBuild?.toString() || 'N/A' },
      { label: 'Length Overall:', value: recertification.vessel?.lengthOverall ? `${recertification.vessel.lengthOverall}m` : 'N/A' },
      { label: 'Gross Tonnage:', value: recertification.vessel?.grossTonnage?.toString() || 'N/A' },
      { label: 'Issue Date:', value: new Date().toLocaleDateString() },
      { label: 'Expiry Date:', value: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toLocaleDateString() }
    ]

    let yPosition = height - 150
    details.forEach(detail => {
      page.drawText(detail.label, {
        x: 50,
        y: yPosition,
        size: 12,
        font: helveticaBold,
        color: rgb(0, 0, 0)
      })
      
      page.drawText(detail.value, {
        x: 200,
        y: yPosition,
        size: 12,
        font: helvetica,
        color: rgb(0, 0, 0)
      })
      
      yPosition -= 25
    })

    // Signature section
    yPosition -= 50
    page.drawText('Authorized Signature:', {
      x: 50,
      y: yPosition,
      size: 12,
      font: helveticaBold,
      color: rgb(0, 0, 0)
    })

    page.drawText('Maritime Industry Authority', {
      x: 200,
      y: yPosition,
      size: 12,
      font: helvetica,
      color: rgb(0, 0, 0)
    })

    yPosition -= 30
    page.drawText('Date:', {
      x: 50,
      y: yPosition,
      size: 12,
      font: helveticaBold,
      color: rgb(0, 0, 0)
    })

    page.drawText(new Date().toLocaleDateString(), {
      x: 200,
      y: yPosition,
      size: 12,
      font: helvetica,
      color: rgb(0, 0, 0)
    })

    // Footer
    page.drawText('This certificate is valid for five years from the issue date.', {
      x: 50,
      y: 100,
      size: 10,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5)
    })

    const pdfBytes = await pdfDoc.save()
    return Buffer.from(pdfBytes)
  } catch (error) {
    console.error('Error generating PDF certificate:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error('Failed to generate certificate PDF: ' + errorMessage)
  }
}
