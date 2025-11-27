import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import jsPDF from 'jspdf'
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

// Helper function to generate PDF from certificate data using jsPDF
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
  const doc = new jsPDF()
  
  // Set up the document
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  
  // Header
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(19, 70, 134) // #134686
  doc.text('AUTHORITY APPROVAL CERTIFICATE', pageWidth / 2, 30, { align: 'center' })
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text('Marine Industry Authority - Marina Portal', pageWidth / 2, 40, { align: 'center' })
  
  // Draw a line under the header
  doc.setDrawColor(19, 70, 134)
  doc.setLineWidth(1)
  doc.line(50, 50, pageWidth - 50, 50)
  
  // Certificate number box
  doc.setFillColor(240, 240, 240)
  doc.rect(50, 60, pageWidth - 100, 15, 'F')
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text(`Certificate Number: ${certificateData.certificateNumber}`, pageWidth / 2, 70, { align: 'center' })
  
  // Certificate details
  let yPosition = 100
  const lineHeight = 15
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  
  const requestDate = certificateData.requestDate instanceof Date 
    ? certificateData.requestDate 
    : new Date(certificateData.requestDate)
  const approvedDate = certificateData.approvedDate instanceof Date 
    ? certificateData.approvedDate 
    : new Date(certificateData.approvedDate)
  const validUntil = certificateData.validUntil instanceof Date 
    ? certificateData.validUntil 
    : new Date(certificateData.validUntil)
  
  const details = [
    { label: 'Vessel Name:', value: certificateData.vesselName },
    { label: 'IMO Number:', value: certificateData.imoNumber },
    { label: 'Company:', value: certificateData.companyName },
    { label: 'Ship Type:', value: certificateData.shipType },
    { label: 'Flag:', value: certificateData.flag },
    { label: 'Request Date:', value: requestDate.toLocaleDateString() },
    { label: 'Approved Date:', value: approvedDate.toLocaleDateString() },
    { label: 'Valid Until:', value: validUntil.toLocaleDateString() }
  ]
  
  details.forEach(detail => {
    doc.setFont('helvetica', 'bold')
    doc.text(detail.label, 60, yPosition)
    doc.setFont('helvetica', 'normal')
    doc.text(detail.value, 60 + doc.getTextWidth(detail.label) + 5, yPosition)
    yPosition += lineHeight
  })
  
  // Footer
  yPosition = pageHeight - 60
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text('This certificate is valid for drydock operations as approved by the Marine Industry Authority.', pageWidth / 2, yPosition, { align: 'center' })
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition + 10, { align: 'center' })
  
  // Convert to buffer
  const pdfOutput = doc.output('arraybuffer')
  return Buffer.from(pdfOutput)
}
