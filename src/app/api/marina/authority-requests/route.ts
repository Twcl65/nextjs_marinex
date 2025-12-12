import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import jsPDF from 'jspdf'
import fs from 'fs'
import path from 'path'
import { logUserActivity, ActivityType } from '@/lib/activity-logger'
import { jwtVerify } from 'jose'

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Build the where clause for filtering
    const whereClause = status && status !== 'all' 
      ? { status: status as 'REQUESTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'ISSUED' | 'EXPIRED' }
      : {}

    // Fetch all drydock authority requests for Marina review using Prisma
    const authorityRequests = await prisma.drydockAuthorityRequest.findMany({
      where: whereClause,
      include: {
        drydockRequest: {
          select: {
            id: true,
            status: true,
            vesselName: true,
            imoNumber: true,
            companyName: true,
            flag: true,
            shipType: true,
            priorityLevel: true,
            createdAt: true
          }
        },
        drydockBooking: {
          select: {
            id: true,
            status: true,
            bookingDate: true
          }
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            contactNumber: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform the data to match the expected format
    const transformedRequests = authorityRequests.map(request => ({
      id: request.id,
      status: request.status,
      requestDate: request.requestDate,
      finalScopeOfWorkUrl: request.finalScopeOfWorkUrl,
      authorityCertificate: request.authorityCertificate || null,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      drydockRequestId: request.drydockRequest.id,
      requestStatus: request.drydockRequest.status,
      vesselName: request.drydockRequest.vesselName,
      imoNumber: request.drydockRequest.imoNumber,
      companyName: request.drydockRequest.companyName,
      flag: request.drydockRequest.flag,
      shipType: request.drydockRequest.shipType,
      priorityLevel: request.drydockRequest.priorityLevel,
      requestCreatedAt: request.drydockRequest.createdAt,
      drydockBookingId: request.drydockBooking.id,
      bookingStatus: request.drydockBooking.status,
      bookingDate: request.drydockBooking.bookingDate,
      userId: request.user.id,
      fullName: request.user.fullName,
      email: request.user.email,
      contactNumber: request.user.contactNumber
    }))

    return NextResponse.json({
      authorityRequests: transformedRequests
    })

  } catch (error) {
    console.error('Error fetching authority requests for Marina:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { requestId, status, generateCertificate } = body

    if (!requestId || !status) {
      return NextResponse.json(
        { error: 'Request ID and status are required' },
        { status: 400 }
      )
    }

    // Get the authority request with related data
    const authorityRequest = await prisma.drydockAuthorityRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        vesselId: true,
        userId: true,
        status: true,
        requestDate: true,
        finalScopeOfWorkUrl: true,
        authorityCertificate: true,
        drydockRequestId: true,
        drydockRequest: {
          select: {
            vesselName: true,
            imoNumber: true,
            companyName: true,
            shipType: true,
            flag: true
          }
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            contactNumber: true
          }
        }
      }
    })

    if (!authorityRequest) {
      return NextResponse.json(
        { error: 'Authority request not found' },
        { status: 404 }
      )
    }

    let certificateUrl = null

    // Generate certificate if requested and status is APPROVED
    if (generateCertificate && status === 'APPROVED') {
      try {
        // Generate certificate data
        const certificateData = {
          vesselName: authorityRequest.drydockRequest.vesselName,
          imoNumber: authorityRequest.drydockRequest.imoNumber,
          companyName: authorityRequest.drydockRequest.companyName,
          shipType: authorityRequest.drydockRequest.shipType,
          flag: authorityRequest.drydockRequest.flag,
          requestDate: authorityRequest.requestDate,
          approvedDate: new Date(),
          certificateNumber: `AUTH-${Date.now()}`,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        }

        console.log('Generating certificate for authority request:', requestId)
        
        // Generate PDF directly
        const pdfBuffer = await generatePDFFromData(certificateData)
        
        // Upload to S3 using proxy upload pattern (server-side, no CORS issues)
        const bucketName = process.env.AWS_S3_BUCKET
        const region = process.env.AWS_REGION || 'ap-southeast-2'
        
        if (!bucketName) {
          console.error('AWS_S3_BUCKET environment variable is not set')
          throw new Error('File upload configuration error')
        }

        const s3Client = new S3Client({
          region: region,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        })

        // Generate unique filename
        const timestamp = Date.now()
        const filename = `authority-certificates/cert-${requestId}-${timestamp}.pdf`
        
        // Upload to S3
        const uploadCommand = new PutObjectCommand({
          Bucket: bucketName,
          Key: filename,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
        })

        await s3Client.send(uploadCommand)
        
        // Generate the S3 URL
        certificateUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${filename}`
        
        console.log('Certificate generated and uploaded successfully:', certificateUrl)
      } catch (error) {
        console.error('Error generating certificate:', error)
        // Don't throw - allow status update even if certificate generation fails
        // The user can retry certificate generation later
      }
    }

    // Update authority request status using Prisma
    console.log('Updating database with status:', status, 'and certificate URL:', certificateUrl)
    const updateData: {
      status: 'APPROVED';
      updatedAt: Date;
      authorityCertificate?: string;
    } = {
      status: 'APPROVED',
      updatedAt: new Date()
    }
    
    // Only add certificate URL if it was generated successfully
    if (certificateUrl) {
      updateData.authorityCertificate = certificateUrl
      console.log('Adding certificate URL to database update:', certificateUrl)
    } else {
      console.warn('No certificate URL to save - certificate generation may have failed')
    }
    
    const updatedRequest = await prisma.drydockAuthorityRequest.update({
      where: {
        id: requestId
      },
      data: updateData,
      include: {
        drydockRequest: {
          select: {
            vesselName: true,
            imoNumber: true
          }
        },
        user: {
          select: {
            fullName: true,
            email: true
          }
        }
      }
    })
    
    console.log('Database updated successfully. Certificate URL saved:', updatedRequest.authorityCertificate)

    // Send notification to shipowner when request is approved
    if (status === 'APPROVED' && authorityRequest) {
      try {
        // Create notification message for shipowner
        const shipownerMessage = `Dear **${authorityRequest.drydockRequest.companyName || 'Valued Customer'}**,

We are pleased to inform you that your authority request for **${authorityRequest.drydockRequest.vesselName}** (IMO: ${authorityRequest.drydockRequest.imoNumber}) has been **approved** by the Maritime Industry Authority.

${certificateUrl ? 'Your authority certificate has been generated and is now available for download through your dashboard.' : 'Your request has been approved and is being processed.'}

You can view and download your authority certificate through your dashboard.

If you have any questions or need assistance, please feel free to contact us.

Thank you for using our services.

Best regards,
**Maritime Industry Authority**`

        const notificationId = crypto.randomUUID()

        // Create notification for shipowner
        await prisma.$executeRaw`
          INSERT INTO drydock_mc_notifications (
            id, userId, vesselId, drydockReport, drydockCertificate, 
            safetyCertificate, vesselPlans, title, type, message, 
            isRead, createdAt, updatedAt
          ) VALUES (
            ${notificationId}, ${authorityRequest.userId}, ${authorityRequest.vesselId}, 
            0, 0, 0, 0,
            'Authority Request Approved', 'Authority Approval',
            ${shipownerMessage}, 0, NOW(), NOW()
          )
        `

        console.log('Shipowner notification created successfully:', notificationId)

        // Get shipyardUserId from the booking
        const booking = await prisma.drydockBooking.findFirst({
          where: {
            drydockRequestId: authorityRequest.drydockRequestId
          },
          select: {
            shipyardUserId: true
          }
        });

        if (booking?.shipyardUserId) {
          const shipyardMessage = `Dear Shipyard,

The authority request for **${authorityRequest.drydockRequest.vesselName}** (IMO: ${authorityRequest.drydockRequest.imoNumber}) has been **approved** by the Maritime Industry Authority.

${certificateUrl ? 'The authority certificate has been generated and is now available for download through your dashboard.' : 'The request has been approved and is being processed.'}

You can view and download the authority certificate through your dashboard.

Best regards,
**Maritime Industry Authority**`

          const shipyardNotificationId = crypto.randomUUID()
          await prisma.$executeRaw`
            INSERT INTO drydock_mc_notifications (
              id, userId, vesselId, drydockReport, drydockCertificate, 
              safetyCertificate, vesselPlans, title, type, message, 
              isRead, createdAt, updatedAt
            ) VALUES (
              ${shipyardNotificationId}, ${booking.shipyardUserId}, ${authorityRequest.vesselId}, 
              0, 0, 0, 0,
              'Authority Request Approved', 'Authority Approval',
              ${shipyardMessage}, 0, NOW(), NOW()
            )
          `
          console.log('Shipyard notification created successfully:', shipyardNotificationId)
        }

      } catch (notificationError) {
        console.error('Error creating notification for shipowner:', notificationError)
        // Don't fail the request if notification creation fails
      }
    }

    // Log activity for marina user
    if (status === 'APPROVED') {
      const marinaUserId = await getMarinaUserId(request)
      if (marinaUserId) {
        await logUserActivity(
          marinaUserId,
          ActivityType.AUTHORITY_APPROVED,
          `Authority request approved for ${authorityRequest.drydockRequest.vesselName}`,
          'CheckCircle',
          {
            vesselId: authorityRequest.vesselId,
            vesselName: authorityRequest.drydockRequest.vesselName,
            requestId: requestId
          }
        )
      }
    }

    return NextResponse.json({
      success: true,
      authorityRequest: updatedRequest
    })

  } catch (error) {
    console.error('Error updating authority request status:', error)
    return NextResponse.json(
      { error: 'Failed to update authority request status' },
      { status: 500 }
    )
  }
}

// Helper function to generate PDF styled like the provided MARINA sample certificate
async function generatePDFFromData(certificateData: {
  certificateNumber: string;
  vesselName: string;
  imoNumber: string;
  companyName: string;
  shipType: string;
  flag: string;
  requestDate: Date | string;
  approvedDate: Date | string;
  validUntil: Date | string;
}): Promise<Buffer> {
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

  const requestDate =
    certificateData.requestDate instanceof Date
      ? certificateData.requestDate
      : new Date(certificateData.requestDate)
  const approvedDate =
    certificateData.approvedDate instanceof Date
      ? certificateData.approvedDate
      : new Date(certificateData.approvedDate)
  const endDate =
    certificateData.validUntil instanceof Date
      ? certificateData.validUntil
      : new Date(certificateData.validUntil)

  // Header (no border per request)
  // Logos
  const leftLogo = loadAssetImage('marinex_logo.png')
  if (leftLogo) {
    doc.addImage(leftLogo, 'PNG', margin + 8, margin + 8, 80, 60)
  }
  const rightLogo = loadAssetImage('marinalogo.png')
  if (rightLogo) {
    doc.addImage(rightLogo, 'PNG', pageWidth - margin - 88, margin + 8, 80, 60)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Republic of the Philippines', pageWidth / 2, margin + 18, { align: 'center' })
  doc.text('Department of Transportation', pageWidth / 2, margin + 32, { align: 'center' })
  doc.setFontSize(14)
  doc.text('MARITIME INDUSTRY AUTHORITY', pageWidth / 2, margin + 50, { align: 'center' })
  doc.setFontSize(12)
  doc.text('REGION X', pageWidth / 2, margin + 68, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('AUTHORITY APPROVAL FOR DRY DOCKING', pageWidth / 2, margin + 100, { align: 'center' })

  let cursorY = margin + 135

  // Date line
  doc.setFont('helvetica', 'bold')
  doc.text('Date:', margin, cursorY)
  doc.setFont('helvetica', 'normal')
  doc.text(approvedDate.toLocaleDateString(), margin + 45, cursorY)
  cursorY += lineGap * 1.6

  // Body text
  const body = [
    { bold: 'To Whom It May Concern:' },
    {},
    {
      text: `This is to certify that the Maritime Industry Authority (MARINA) hereby grants Authority Approval for Dry Docking to the vessel ${safe(
        certificateData.vesselName,
        'Name of Ship'
      )}, owned and operated by ${safe(certificateData.companyName, 'Name of Company/Operator')}.`
    },
    {},
    {
      text: 'Based on the documents submitted and the evaluation conducted, the vessel has been found compliant with the technical and operational requirements prescribed under the existing rules and regulations governing dry-docking activities for Philippine-registered ships.'
    },
    {},
    {
      text: `Accordingly, the ${safe(
        certificateData.vesselName,
        'Name of Ship'
      )} is hereby authorized to undergo dry docking from ${requestDate.toLocaleDateString()} to ${endDate.toLocaleDateString()} for the purpose of hull inspection, maintenance, repair, and other associated works deemed necessary to ensure continued seaworthiness and safety of navigation.`
    },
    {},
    {
      text: 'This certificate is issued for the sole purpose of dry-docking authorization and shall be presented to the concerned shipyard, regulatory offices, and port authorities as needed. Any extension or modification of the approved schedule must be coordinated with MARINA for proper evaluation and approval.'
    }
  ]

  doc.setFontSize(12)
  body.forEach((paragraph) => {
    if (paragraph.bold) {
      doc.setFont('helvetica', 'bold')
      doc.text(paragraph.bold, margin, cursorY, { maxWidth: pageWidth - margin * 2 })
    } else if (paragraph.text) {
      doc.setFont('helvetica', 'normal')
      doc.text(paragraph.text, margin, cursorY, {
        maxWidth: pageWidth - margin * 2,
        lineHeightFactor: 1.5
      })
    }
    cursorY += paragraph.text ? lineGap * 1.7 : lineGap
  })

  cursorY += lineGap * 0.8

  // Certificate number and IMO/flag row (moved lower to use whitespace)
  cursorY += lineGap * 2.5
  doc.setFont('helvetica', 'bold')
  doc.text(`Certificate No.: ${certificateData.certificateNumber}`, margin, cursorY)
  doc.text(`IMO No.: ${safe(certificateData.imoNumber, 'N/A')}`, margin + 250, cursorY)
  cursorY += lineGap
  doc.text(`Flag: ${safe(certificateData.flag, 'N/A')}`, margin, cursorY)
  doc.text(`Ship Type: ${safe(certificateData.shipType, 'N/A')}`, margin + 250, cursorY)

  // Footer / issued info
  cursorY = 680
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Issued at MARINA Region X, Cagayan de Oro City, Philippines, on ${approvedDate.toLocaleDateString()}.`,
    margin,
    cursorY,
    { maxWidth: pageWidth - margin * 1 }
  )

  // Signature block
  cursorY += lineGap * 2
  doc.setFont('helvetica', 'bold')
  doc.text('Issued by:', margin, cursorY)
  cursorY += lineGap * 2

  const signatureImg = loadAssetImage('signature.png')
  if (signatureImg) {
    doc.addImage(signatureImg, 'PNG', margin, cursorY - lineGap, 120, 50)
  }

  doc.setFont('helvetica', 'bold')
  doc.text('VADM ROBINSON A. EMPEDRAD', margin, cursorY)
  doc.setFont('helvetica', 'normal')
  doc.text('Administrator', margin, cursorY + lineGap)

  // Convert to buffer
  const pdfOutput = doc.output('arraybuffer')
  return Buffer.from(pdfOutput)
}
