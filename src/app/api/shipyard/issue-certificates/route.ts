import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import jsPDF from 'jspdf'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

// Helper function to generate certificate PDF
async function generateCertificatePDF(
  certificateName: string,
  vesselName: string,
  imoNumber: string,
  companyName: string,
  issuedDate: Date,
  shipyardName: string
): Promise<Buffer> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  
  // Header with border
  doc.setDrawColor(19, 70, 134) // #134686
  doc.setLineWidth(1)
  doc.rect(15, 10, pageWidth - 30, 30)
  
  // Title
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(19, 70, 134)
  doc.text(certificateName.toUpperCase(), pageWidth / 2, 25, { align: 'center' })
  
  // Subtitle
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text('Marinex Platform - Drydock Operations', pageWidth / 2, 32, { align: 'center' })
  
  let yPosition = 60
  
  // Certificate Number
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('CERTIFICATE NUMBER:', 20, yPosition)
  doc.setFont('helvetica', 'normal')
  const certNumber = `CERT-${Date.now().toString().slice(-8)}`
  doc.text(certNumber, 20 + doc.getTextWidth('CERTIFICATE NUMBER: ') + 5, yPosition)
  yPosition += 15
  
  // Certificate Details Section
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('CERTIFICATE DETAILS', 20, yPosition)
  yPosition += 10
  
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  
  const details = [
    { label: 'Vessel Name:', value: vesselName },
    { label: 'IMO Number:', value: imoNumber },
    { label: 'Company Name:', value: companyName },
    { label: 'Issued By:', value: shipyardName },
    { label: 'Issue Date:', value: issuedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
    { label: 'Certificate Type:', value: certificateName }
  ]
  
  details.forEach(detail => {
    doc.setFont('helvetica', 'bold')
    doc.text(detail.label, 25, yPosition)
    doc.setFont('helvetica', 'normal')
    doc.text(detail.value, 25 + doc.getTextWidth(detail.label) + 5, yPosition)
    yPosition += 8
  })
  
  yPosition += 10
  
  // Certificate Statement
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  const statement = `This is to certify that the drydock operations for the above-mentioned vessel have been completed successfully at 100%. The ${certificateName} has been issued in accordance with maritime regulations and standards.`
  const splitText = doc.splitTextToSize(statement, pageWidth - 50)
  doc.text(splitText, 25, yPosition)
  yPosition += splitText.length * 6 + 10
  
  // Signature Section
  yPosition = pageHeight - 80
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.5)
  doc.line(25, yPosition, pageWidth - 25, yPosition)
  yPosition += 10
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Authorized Signature', 25, yPosition)
  yPosition += 8
  doc.setFont('helvetica', 'normal')
  doc.text(shipyardName, 25, yPosition)
  yPosition += 5
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text('Certified Shipyard', 25, yPosition)
  
  // Footer
  yPosition = pageHeight - 30
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('This certificate was generated automatically by the Marinex Platform.', pageWidth / 2, yPosition, { align: 'center' })
  doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition + 5, { align: 'center' })
  
  // Convert to buffer
  const pdfOutput = doc.output('arraybuffer')
  return Buffer.from(pdfOutput)
}

// Helper function to upload PDF to S3
async function uploadCertificateToS3(pdfBuffer: Buffer, certificateId: string, certificateName: string): Promise<string> {
  const bucketName = process.env.AWS_S3_BUCKET
  if (!bucketName) {
    throw new Error('AWS_S3_BUCKET environment variable is not set')
  }
  
  const fileName = `drydock-certificates/${certificateId}-${certificateName.replace(/\s+/g, '-')}-${Date.now()}.pdf`
  
  const uploadCommand = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
  })
  
  await s3Client.send(uploadCommand)
  
  const certificateUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'ap-southeast-2'}.amazonaws.com/${fileName}`
  return certificateUrl
}

async function uploadFileToS3(file: File, certificateId: string, certificateName: string): Promise<string> {
  const bucketName = process.env.AWS_S3_BUCKET
  if (!bucketName) {
    throw new Error('AWS_S3_BUCKET environment variable is not set')
  }
  
  const fileExtension = file.name.split('.').pop() || 'pdf'
  const fileName = `drydock-certificates/${certificateId}-${certificateName.replace(/\s+/g, '-')}-${Date.now()}.${fileExtension}`
  
  // Convert File to Buffer
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  
  // Determine content type
  let contentType = file.type || 'application/pdf'
  if (!contentType || contentType === 'application/octet-stream') {
    if (fileExtension === 'pdf') contentType = 'application/pdf'
    else if (fileExtension === 'doc') contentType = 'application/msword'
    else if (fileExtension === 'docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    else if (fileExtension === 'jpg' || fileExtension === 'jpeg') contentType = 'image/jpeg'
    else if (fileExtension === 'png') contentType = 'image/png'
  }
  
  const uploadCommand = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: buffer,
    ContentType: contentType,
  })
  
  await s3Client.send(uploadCommand)
  
  const certificateUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'ap-southeast-2'}.amazonaws.com/${fileName}`
  return certificateUrl
}

export async function POST(req: NextRequest) {
  try {
    // Handle FormData (for file uploads) or JSON
    const contentType = req.headers.get('content-type') || ''
    let bookingId: string
    let vesselPlans: boolean
    let drydockReport: boolean
    let drydockCertificate: boolean
    let vesselPlansFile: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      bookingId = formData.get('bookingId') as string
      vesselPlans = formData.get('vesselPlans') === 'true'
      drydockReport = formData.get('drydockReport') === 'true'
      drydockCertificate = formData.get('drydockCertificate') === 'true'
      vesselPlansFile = formData.get('vesselPlansFile') as File | null
    } else {
      const body = await req.json()
      bookingId = body.bookingId
      vesselPlans = body.vesselPlans
      drydockReport = body.drydockReport
      drydockCertificate = body.drydockCertificate
    }

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      )
    }

    // Check if at least one certificate is selected
    if (!vesselPlans && !drydockReport && !drydockCertificate) {
      return NextResponse.json(
        { error: 'At least one certificate must be selected' },
        { status: 400 }
      )
    }

    // Validate that if vessel plans is selected, a file must be provided
    if (vesselPlans && !vesselPlansFile) {
      return NextResponse.json(
        { error: 'Vessel Plans file is required when Vessel Plans is selected' },
        { status: 400 }
      )
    }

    // Validate that all services are 100% complete before issuing certificates
    const services = await prisma.drydockService.findMany({
      where: { drydockBookingId: bookingId },
      select: { id: true, progress: true, serviceName: true }
    })

    if (services.length === 0) {
      return NextResponse.json(
        { error: 'No services found for this booking. Cannot issue certificates.' },
        { status: 400 }
      )
    }

    // Check if all services are 100% complete
    const allServicesComplete = services.every(service => service.progress >= 100)
    if (!allServicesComplete) {
      const incompleteServices = services
        .filter(service => service.progress < 100)
        .map(service => `${service.serviceName} (${service.progress}%)`)
        .join(', ')
      
      return NextResponse.json(
        { 
          error: 'Cannot issue certificates. All services must be 100% complete.',
          incompleteServices: incompleteServices
        },
        { status: 400 }
      )
    }

    // Fetch booking with related data to get vesselId and userId
    const bookingData = await prisma.$queryRaw<Array<{
      id: string
      drydockRequestId: string
      userId: string
      vesselId: string
      vesselName: string
      imoNumber: string
    }>>`
      SELECT 
        db.id,
        db.drydockRequestId,
        db.userId,
        dr.vesselId,
        dr.vesselName,
        dr.imoNumber
      FROM drydock_bookings db
      LEFT JOIN drydock_requests dr ON db.drydockRequestId = dr.id
      WHERE db.id = ${bookingId}
      LIMIT 1
    `

    if (!bookingData || bookingData.length === 0) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    const booking = bookingData[0]

    if (!booking.vesselId || !booking.userId) {
      return NextResponse.json(
        { error: 'Vessel ID or User ID not found in booking' },
        { status: 404 }
      )
    }

    // Fetch vessel and user details for notification
    const vessel = await prisma.shipVessel.findUnique({
      where: { id: booking.vesselId },
      include: { user: true }
    })

    if (!vessel) {
      return NextResponse.json(
        { error: 'Vessel not found' },
        { status: 404 }
      )
    }

    // Get shipyard user info (from booking)
    const shipyardData = await prisma.$queryRaw<Array<{
      shipyardUserId: string
      shipyardName: string | null
    }>>`
      SELECT 
        db.shipyardUserId,
        u.shipyardName
      FROM drydock_bookings db
      LEFT JOIN users u ON db.shipyardUserId = u.id
      WHERE db.id = ${bookingId}
      LIMIT 1
    `

    const shipyardName = shipyardData && shipyardData.length > 0 
      ? (shipyardData[0].shipyardName || 'Certified Shipyard')
      : 'Certified Shipyard'

    // Prepare certificates to issue
    const certificatesToIssue: Array<{ name: string; type: string }> = []
    
    if (vesselPlans) {
      certificatesToIssue.push({ name: 'Vessel Plans', type: 'VESSEL_PLANS' })
    }
    if (drydockReport) {
      certificatesToIssue.push({ name: 'Drydock Report', type: 'DRYDOCK_REPORT' })
    }
    if (drydockCertificate) {
      certificatesToIssue.push({ name: 'Drydock Certificate', type: 'DRYDOCK_CERTIFICATE' })
    }

    // Issue certificates in a transaction
    const issuedCertificates = await prisma.$transaction(async (tx) => {
      const certificates = []
      
      for (const cert of certificatesToIssue) {
        const certificateId = crypto.randomUUID()
        const now = new Date()
        
        // Handle Vessel Plans (uploaded file) vs other certificates (generated PDF)
        let certificateUrl: string | null = null
        try {
          if (cert.type === 'VESSEL_PLANS' && vesselPlansFile) {
            // Upload the provided file for Vessel Plans
            console.log(`Uploading file for ${cert.name}...`)
            certificateUrl = await uploadFileToS3(vesselPlansFile, certificateId, cert.name)
            console.log(`File uploaded successfully. URL: ${certificateUrl}`)
          } else {
            // Generate PDF certificate for other types
            console.log(`Generating PDF for ${cert.name}...`)
            const pdfBuffer = await generateCertificatePDF(
              cert.name,
              booking.vesselName,
              booking.imoNumber,
              vessel.user.fullName || vessel.user.email || 'Shipowner',
              now,
              shipyardName
            )
            
            console.log(`Uploading PDF to S3 for ${cert.name}...`)
            certificateUrl = await uploadCertificateToS3(pdfBuffer, certificateId, cert.name)
            console.log(`PDF uploaded successfully. URL: ${certificateUrl}`)
          }
        } catch (error) {
          console.error(`Error processing certificate for ${cert.name}:`, error)
          throw new Error(`Failed to process certificate for ${cert.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
        
        if (!certificateUrl) {
          throw new Error(`Certificate URL is null for ${cert.name} after processing`)
        }
        
        // Use raw SQL with proper column names (matching the migration)
        // Ensure certificateUrl is properly saved
        await tx.$executeRaw`
          INSERT INTO drydock_issued_certificates (
            id, drydockBookingId, vesselId, userId, certificateName, 
            certificateType, certificateUrl, issuedDate, createdAt, updatedAt
          ) VALUES (
            ${certificateId}, ${bookingId}, ${booking.vesselId}, ${booking.userId},
            ${cert.name}, ${cert.type}, ${certificateUrl}, ${now}, ${now}, ${now}
          )
        `
        
        // Verify the certificate was saved with URL
        const savedCert = await tx.$queryRaw<Array<{
          id: string
          certificateUrl: string | null
        }>>`
          SELECT id, certificateUrl 
          FROM drydock_issued_certificates 
          WHERE id = ${certificateId}
          LIMIT 1
        `
        
        if (!savedCert || savedCert.length === 0 || !savedCert[0].certificateUrl) {
          throw new Error(`Failed to save certificate URL for ${cert.name}`)
        }
        
        certificates.push({
          id: certificateId,
          name: cert.name,
          type: cert.type,
          url: savedCert[0].certificateUrl
        })
      }
      
      return certificates
    })

    // Create notification
    const companyName = vessel.user.fullName || vessel.user.email || 'Shipowner'
    const vesselName = vessel.vesselName || 'Vessel'
    
    const certificatesList = certificatesToIssue.map((cert, index) => 
      `${index + 1}. ${cert.name}`
    ).join('\n\n')

    const notificationMessage = `Dear **${companyName}**,

We are pleased to inform you that the drydock operations for your vessel, **${vesselName}** (IMO: ${booking.imoNumber}), have been completed successfully at 100%.

The following certificates have been issued and are now available:

**Issued Certificates:**

${certificatesList}

You can access these certificates in your vessel documents section. If you have any questions or need further assistance, please feel free to contact us.

Thank you for choosing our services.

Best regards,
**Marinex Platform**`

    // Create notification
    const notificationId = crypto.randomUUID()
    
    await prisma.$executeRaw`
      INSERT INTO drydock_mc_notifications (
        id, userId, vesselId, drydockReport, drydockCertificate, 
        safetyCertificate, vesselPlans, title, type, message, 
        isRead, createdAt, updatedAt
      ) VALUES (
        ${notificationId}, ${booking.userId}, ${booking.vesselId}, 
        ${drydockReport ? 1 : 0}, ${drydockCertificate ? 1 : 0}, 
        0, ${vesselPlans ? 1 : 0},
        'Drydock Completion - Certificates Issued', 'Drydock Completion',
        ${notificationMessage}, 0, NOW(), NOW()
      )
    `

    // Update drydock_booking status to COMPLETED
    await prisma.$executeRaw`
      UPDATE drydock_bookings
      SET status = 'COMPLETED', updatedAt = NOW()
      WHERE id = ${bookingId}
    `

    // Update drydock_request status to COMPLETED
    await prisma.$executeRaw`
      UPDATE drydock_requests
      SET status = 'COMPLETED', updatedAt = NOW()
      WHERE id = ${booking.drydockRequestId}
    `

    console.log(`Updated drydock_booking ${bookingId} and drydock_request ${booking.drydockRequestId} status to COMPLETED`)

    return NextResponse.json({
      success: true,
      message: 'Certificates issued successfully',
      certificates: issuedCertificates,
      notificationId
    }, { status: 201 })

  } catch (error) {
    console.error('Error issuing certificates:', error)
    return NextResponse.json(
      { error: 'Failed to issue certificates', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

