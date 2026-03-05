import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import jsPDF from 'jspdf'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { logUserActivity, ActivityType } from '@/lib/activity-logger'
import { jwtVerify } from 'jose'

const prisma = new PrismaClient()

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key')

async function getAuthenticatedUser(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as { userId: string; email: string; role: string }
  } catch (error) {
    return null
  }
}

async function getMarinaUserId(request: NextRequest): Promise<string | null> {
  const authUser = await getAuthenticatedUser(request)
  if (authUser && authUser.role === 'MARINA') {
    return authUser.userId
  }
  
  // Fallback: get first marina user
  const marinaUser = await prisma.user.findFirst({
    where: { role: 'MARINA' },
    select: { id: true }
  })
  return marinaUser?.id || null
}

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

        const issueDate = new Date()
        const expiryDate = new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000) // 5 years from now

        // Generate human-readable certificate ID (e.g., VR-2026-ABC123)
        const year = issueDate.getFullYear()
        const idSuffix = recertification.id.slice(-6).toUpperCase()
        const certificateId = `VR-${year}-${idSuffix}`

        // Build verification URL that deep-links directly to this certificate
        // Example: https://app-domain/verify/VR-2026-ABC123
        const appBaseUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          process.env.APP_BASE_URL ||
          'https://nextjs-marinex.vercel.app'
        const verificationUrl = `${appBaseUrl.replace(/\/$/, '')}/verify/${encodeURIComponent(
          certificateId
        )}`

        // Generate certificate PDF (with QR + metadata)
        const certificateBuffer = await generateVesselCertificate(
          recertification,
          certificateId,
          verificationUrl,
          issueDate,
          expiryDate
        )
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

        // Base S3 URL (store unsigned; viewer will request signed URL on demand)
        const region = process.env.AWS_REGION || 'ap-southeast-2'
        const baseUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${region}.amazonaws.com/certificates/${fileName}`
        console.log('Certificate uploaded to (base URL):', baseUrl)

        // Update the recertification record and vessel certificate expiry
        const updatedRecertification = await prisma.drydockVesselRecertificate.update({
          where: { id: recertificateId },
          data: {
            status: 'COMPLETED',
            vesselCertificateFile: baseUrl,
            certificateId,
            certificateIssuedAt: issueDate,
            certificateExpiry: expiryDate,
            certificateRevoked: false,
            updatedAt: new Date()
          }
        })

        // Update vessel certificate expiry date
        await prisma.shipVessel.update({
          where: { id: recertification.vesselId },
          data: {
            vesselCertificationExpiry: expiryDate,
            vesselCertificationUrl: baseUrl,
            vesselPlansUrl: recertification.vesselPlansUrl,
            drydockCertificateUrl: recertification.drydockCertificateUrl,
            safetyCertificateUrl: recertification.safetyCertificateUrl,
            updatedAt: new Date()
          }
        })

        console.log('Database updated successfully')
        console.log(`Vessel certificate expiry updated to: ${expiryDate.toISOString()}`)

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

        // Log activity for marina user
        const marinaUserId = await getMarinaUserId(request)
        if (marinaUserId) {
          await logUserActivity(
            marinaUserId,
            ActivityType.RECERTIFICATION_APPROVED,
            `Vessel recertification approved for ${recertification.vesselName}`,
            'CheckCircle',
            {
              vesselId: recertification.vesselId,
              vesselName: recertification.vesselName,
              recertificateId: recertificateId
            }
          )
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

async function generateVesselCertificate(
  recertification: RecertificationData,
  certificateId: string,
  verificationUrl: string,
  issueDate: Date,
  expiryDate: Date
): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 55
  const lineGap = 20

  const loadAssetImage = (fileName: string): string | null => {
    try {
      const imgPath = path.join(process.cwd(), 'public', 'assets', fileName)
      if (!fs.existsSync(imgPath)) return null
      const data = fs.readFileSync(imgPath)
      return `data:image/png;base64,${data.toString('base64')}`
    } catch (err) {
      console.error('Error loading image asset', fileName, err)
      return null
    }
  }

  const safe = (value: string | number | undefined | null, fallback: string) =>
    value ? String(value) : fallback
  const certificateNumber = certificateId
  const distinctiveNumber = 'THS'
  const portOfRegistry = String(Math.floor(10 + Math.random() * 90))
  const companyIdNumber = `BRN-${recertification.id.slice(-6).toUpperCase()}`

  // Header - Logos (no border)
  const leftLogo = loadAssetImage('marinex_logo.png')
  if (leftLogo) {
    doc.addImage(leftLogo, 'PNG', margin + 8, margin + 8, 80, 60)
  }
  const rightLogo = loadAssetImage('marinalogo.png')
  if (rightLogo) {
    doc.addImage(rightLogo, 'PNG', pageWidth - margin - 88, margin + 8, 80, 60)
  }

  // Header text
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Republic of the Philippines', pageWidth / 2, margin + 18, { align: 'center' })
  doc.text('Department of Transportation', pageWidth / 2, margin + 32, { align: 'center' })
  doc.setFontSize(14)
  doc.text('MARITIME INDUSTRY AUTHORITY', pageWidth / 2, margin + 50, { align: 'center' })
  doc.setFontSize(12)
  doc.text('REGION X', pageWidth / 2, margin + 68, { align: 'center' })

  // Sub-header text
  let cursorY = margin + 95
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Issued under the provisions of the Maritime Industry Authority', pageWidth / 2, cursorY, { align: 'center' })
  cursorY += lineGap * 0.8
  doc.text('Under the authority of the Government of the', pageWidth / 2, cursorY, { align: 'center' })
  cursorY += lineGap * 0.8
  doc.setFont('helvetica', 'bold')
  doc.text('REPUBLIC OF THE PHILIPPINES', pageWidth / 2, cursorY, { align: 'center' })

  // Certificate title
  cursorY += lineGap * 1.5
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('VESSEL CERTIFICATE', pageWidth / 2, cursorY, { align: 'center' })

  // Tables section
  cursorY += lineGap * 2

  // Vessel Details Table
  const tableStartX = margin
  const tableWidth = pageWidth - margin * 2
  const colWidths = [140, 140, 120, 120]
  const rowHeight = 25

  // Table headers
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  const headers = ['Name of Ship', 'Distinctive Number of Letters', 'Port of Registry', 'IMO Number']
  let xPos = tableStartX
  headers.forEach((header, idx) => {
    doc.setFillColor(240, 240, 240)
    doc.rect(xPos, cursorY, colWidths[idx], rowHeight, 'F')
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.rect(xPos, cursorY, colWidths[idx], rowHeight, 'S')
    doc.text(header, xPos + 5, cursorY + 15, { maxWidth: colWidths[idx] - 10 })
    xPos += colWidths[idx]
  })

  // Table data row
  cursorY += rowHeight
  xPos = tableStartX
  const vesselData = [
    safe(recertification.vesselName, ''),
    distinctiveNumber,
    portOfRegistry,
    safe(recertification.vesselImoNumber, '')
  ]
  vesselData.forEach((data, idx) => {
    doc.setFillColor(255, 255, 255)
    doc.rect(xPos, cursorY, colWidths[idx], rowHeight, 'F')
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.rect(xPos, cursorY, colWidths[idx], rowHeight, 'S')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(data, xPos + 5, cursorY + 15, { maxWidth: colWidths[idx] - 10 })
    xPos += colWidths[idx]
  })

  // Company Details Table
  cursorY += rowHeight + lineGap
  const companyColWidths = [200, 150, 150]
  const companyHeaders = ['Name and Address of the Company', 'Company Identification Number', 'Type of Ship *']
  
  xPos = tableStartX
  companyHeaders.forEach((header, idx) => {
    doc.setFillColor(240, 240, 240)
    doc.rect(xPos, cursorY, companyColWidths[idx], rowHeight, 'F')
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.rect(xPos, cursorY, companyColWidths[idx], rowHeight, 'S')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(header, xPos + 5, cursorY + 15, { maxWidth: companyColWidths[idx] - 10 })
    xPos += companyColWidths[idx]
  })

  // Company data row
  cursorY += rowHeight
  xPos = tableStartX
  const companyData = [
    safe(recertification.companyName, ''),
    companyIdNumber,
    safe(recertification.vessel?.shipType, '')
  ]
  companyData.forEach((data, idx) => {
    doc.setFillColor(255, 255, 255)
    doc.rect(xPos, cursorY, companyColWidths[idx], rowHeight, 'F')
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.rect(xPos, cursorY, companyColWidths[idx], rowHeight, 'S')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(data, xPos + 5, cursorY + 15, { maxWidth: companyColWidths[idx] - 10 })
    xPos += companyColWidths[idx]
  })

  // Certification statement
  cursorY += rowHeight + lineGap * 1.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('THIS IS TO CERTIFY THAT:', margin, cursorY)
  
  cursorY += lineGap * 1.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('1. The security system and any associated security equipment of the ship has been verified in accordance with memorandum circular 203 of the Maritime Industry Authority Region X.', margin, cursorY, {
    maxWidth: pageWidth - margin * 2,
    lineHeightFactor: 1.5
  })
  
  cursorY += lineGap * 2.5
  doc.text('2. That the ship is provided with an approved Dry-Docking Report and Vessel Plan.', margin, cursorY, {
    maxWidth: pageWidth - margin * 2,
    lineHeightFactor: 1.5
  })

  // Validity and issuance details
  cursorY += lineGap * 2.5
  doc.setFontSize(10)
  doc.text(`Date of initial renewal verification on which this certificate is based ${issueDate.toISOString().split('T')[0]}.`, margin, cursorY)
  
  cursorY += lineGap * 1.2
  doc.text(`This certificate is valid until ${expiryDate.toISOString().split('T')[0]}, subject to verifications and renewal in accordance with the memorandum circular 2023 of the Maritime Industry Authority.`, margin, cursorY, {
    maxWidth: pageWidth - margin * 2,
    lineHeightFactor: 1.5
  })

  cursorY += lineGap * 1.5
  const day = issueDate.getDate()
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const month = monthNames[issueDate.getMonth()]
  const year = issueDate.getFullYear()
  doc.text(`Issued at MARINA Region - X, Cagayan de Oro City, Philippines, on the ${day} ${month} ${year}.`, margin, cursorY)

  // Space for QR code and verification info above footer
  cursorY += lineGap * 2

  // Generate QR code for verification URL
  try {
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      margin: 1,
      width: 100,
    })
    // Place QR on the left
    doc.addImage(qrDataUrl, 'PNG', margin, cursorY - 10, 90, 90)
  } catch (err) {
    console.error('Failed to generate QR code for certificate:', err)
  }

  // Verification text on the right of QR
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('CERTIFICATE ID:', margin + 110, cursorY + 5)
  doc.setFont('helvetica', 'normal')
  doc.text(certificateNumber, margin + 110, cursorY + 20)

  doc.setFont('helvetica', 'bold')
  doc.text('VERIFY ONLINE:', margin + 110, cursorY + 40)
  doc.setFont('helvetica', 'normal')
  doc.text(
    verificationUrl,
    margin + 110,
    cursorY + 55,
    { maxWidth: 260 }
  )

  doc.setFontSize(9)
  doc.text(
    'Scan the QR code or visit the link above to validate this certificate directly with the Maritime Industry Authority.',
    margin + 110,
    cursorY + 75,
    { maxWidth: 260 }
  )

  // Footer with signature on right
  cursorY = 650
  const signatureImg = loadAssetImage('signature.png')
  if (signatureImg) {
    // Signature image on the right
    doc.addImage(signatureImg, 'PNG', pageWidth - margin - 150, cursorY - 10, 120, 50)
  }

  // Signature block text on right
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('DONNA DEL P. KUIZON', pageWidth - margin - 150, cursorY + 45)
  doc.text('Administrative Officer IV', pageWidth - margin - 150, cursorY + 45 + lineGap)

  // Convert to buffer
  const pdfOutput = doc.output('arraybuffer')
  return Buffer.from(pdfOutput)
}
