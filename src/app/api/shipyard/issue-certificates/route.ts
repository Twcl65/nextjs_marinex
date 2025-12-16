import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import jsPDF from 'jspdf'
import fs from 'fs'
import path from 'path'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

// Helper function to load image asset
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

// Helper function to generate Drydock Report PDF
async function generateDrydockReportPDF(
  vesselName: string,
  imoNumber: string,
  companyName: string,
  issuedDate: Date,
  shipyardName: string,
  vesselData?: {
    shipType?: string | null
    flag?: string | null
    distinctiveNumber?: string | null
  },
  services?: Array<{ serviceName: string; progress?: number | null; startDate?: Date; endDate?: Date; area?: number | null }>
): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 55
  const lineGap = 20

  // Load PICMW logo
  const logo = loadAssetImage('picmwlogo.png')
  if (logo) {
    doc.addImage(logo, 'PNG', pageWidth / 2 - 40, margin, 80, 60)
  }

  // Company name and address
  let cursorY = margin + 70
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(shipyardName || 'Philippine Iron Construction & Marine Works, Inc.', pageWidth / 2, cursorY, { align: 'center' })
  cursorY += lineGap * 0.8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Lower Jasaan, Jasaan Misamis Oriental', pageWidth / 2, cursorY, { align: 'center' })

  // Main title
  cursorY += lineGap * 1.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('DRY DOCK REPORT', pageWidth / 2, cursorY, { align: 'center' })

  // Derive dates for repair day and planned dock days
  const formatDate = (d?: Date) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
  const serviceStarts = (services || []).map(s => (s as any).startDate ? new Date((s as any).startDate).getTime() : undefined).filter(Boolean) as number[]
  const serviceEnds = (services || []).map(s => (s as any).endDate ? new Date((s as any).endDate).getTime() : undefined).filter(Boolean) as number[]
  const startMs = serviceStarts.length ? Math.min(...serviceStarts) : issuedDate.getTime()
  const endMs = serviceEnds.length ? Math.max(...serviceEnds) : issuedDate.getTime()
  const startDateTxt = formatDate(new Date(startMs))
  const endDateTxt = formatDate(new Date(endMs))
  const plannedDays = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1)

  // Information table (label/value)
  cursorY += lineGap * 2
  const tableStartX = margin
  const colWidths = [170, 170]
  const rowHeight = 22

  const infoRows = [
    { label: 'Vessel Name', value: vesselName },
    { label: 'Date', value: issuedDate.toLocaleDateString() },
    { label: 'Time', value: issuedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { label: 'Repair Day', value: `${startDateTxt} - ${endDateTxt}` },
    { label: 'Planned Dock Days', value: `${plannedDays} days` },
    { label: 'Report Ref.', value: `RPT-${crypto.randomUUID().slice(-6).toUpperCase()}` },
    { label: 'Dockyard', value: shipyardName || 'PICMW Shipyard' },
  ]

  let xPos = tableStartX
  infoRows.forEach((row) => {
    doc.setFillColor(240, 240, 240)
    doc.rect(xPos, cursorY, colWidths[0], rowHeight, 'F')
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.rect(xPos, cursorY, colWidths[0], rowHeight, 'S')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(row.label, xPos + 5, cursorY + 12, { maxWidth: colWidths[0] - 10 })
    
    doc.setFillColor(255, 255, 255)
    doc.rect(xPos + colWidths[0], cursorY, colWidths[1], rowHeight, 'F')
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.rect(xPos + colWidths[0], cursorY, colWidths[1], rowHeight, 'S')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(row.value, xPos + colWidths[0] + 5, cursorY + 12, { maxWidth: colWidths[1] - 10 })
    
    cursorY += rowHeight
  })

  // Notes section
  cursorY += rowHeight * 2
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(11)
  doc.text('Works In Progress or Completed', margin, cursorY)
  cursorY += lineGap * 0.8
  doc.text('Note:', margin, cursorY)
  cursorY += lineGap * 1.2
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(10)
  doc.text('* Comment on bad weather period (e.g., number of rain hours) which affects the repair schedule.', margin, cursorY, {
    maxWidth: pageWidth - margin * 2,
    lineHeightFactor: 1.4
  })
  cursorY += lineGap * 1.4
  doc.text('** Comment whether or not repair/time taken are on schedule. This is to be done every day for the first half duration of dry docking. In the second half, daily comment is necessary.', margin, cursorY, {
    maxWidth: pageWidth - margin * 2,
    lineHeightFactor: 1.4
  })

  // Build services paragraph
  const describeService = (svc: { serviceName: string; progress?: number | null; startDate?: Date; endDate?: Date; area?: number | null }) => {
    const start = formatDate((svc as any).startDate)
    const end = formatDate((svc as any).endDate)
    const pct = svc.progress ?? 100
    const totalMeters = svc.area ?? 20
    const halfMeters = totalMeters / 2
    return `${svc.serviceName}: Work kicked off on ${start}. Completed about ${halfMeters} meters by day 3; remaining ${halfMeters} meters continued through ${end}. Current progress is ${pct}%, performed under sunny conditions.`
  }

  const generalProgressText =
    'Works kicked off with onboard works planning meeting at 9am between Owner’s Project Team (OPT): Yard Project Team, OPT-UFF Pum, OPT-ClassNK, OPT-OH, Chogoku and Master/CE/CO. In general the purpose is to conform, program and consolidate all repair, inspection and survey works.'

  const serviceRows = (services || []).map((svc) => ({
    label: svc.serviceName || 'Service',
    text: describeService(svc),
  }))

  // Progress details table (Weather, General Progress, then each service)
  cursorY += lineGap * 2
  const progressColWidths = [140, pageWidth - margin * 2 - 140]
  const bottomLimit = pageHeight - margin - 120
  const baseRows = [
    { label: 'Weather*', text: 'Sunny and calm with temperature around 16–20°C.' },
    { label: 'General Progress', text: generalProgressText },
  ]
  const progressRows = [...baseRows, ...serviceRows]
  
  xPos = tableStartX
  progressRows.forEach((row) => {
    // compute height based on text length
    const lines = doc.splitTextToSize(row.text, progressColWidths[1] - 10)
    const rowHeight = Math.max(32, lines.length * 12 + 10)

    // pagination: add a new page if not enough space
    if (cursorY + rowHeight > bottomLimit) {
      doc.addPage()
      cursorY = margin
    }

    doc.setFillColor(240, 240, 240)
    doc.rect(xPos, cursorY, progressColWidths[0], rowHeight, 'F')
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.rect(xPos, cursorY, progressColWidths[0], rowHeight, 'S')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(row.label, xPos + 5, cursorY + 14, { maxWidth: progressColWidths[0] - 10 })
    
    doc.setFillColor(255, 255, 255)
    doc.rect(xPos + progressColWidths[0], cursorY, progressColWidths[1], rowHeight, 'F')
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.rect(xPos + progressColWidths[0], cursorY, progressColWidths[1], rowHeight, 'S')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(lines, xPos + progressColWidths[0] + 5, cursorY + 14, { lineHeightFactor: 1.4 })
    
    cursorY += rowHeight
  })

  // Signature block
  cursorY = pageHeight - 80
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Verified by:', pageWidth - margin - 150, cursorY)
  
  const signatureImg = loadAssetImage('signature.png')
  if (signatureImg) {
    doc.addImage(signatureImg, 'PNG', pageWidth - margin - 150, cursorY + 5, 100, 40)
  }
  
  cursorY += 50
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Julius Anthony Siarez', pageWidth - margin - 150, cursorY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Project Manager', pageWidth - margin - 150, cursorY + lineGap * 0.8)

  const pdfOutput = doc.output('arraybuffer')
  return Buffer.from(pdfOutput)
}

// Helper function to generate Drydock Certificate PDF
async function generateDrydockCertificatePDF(
  vesselName: string,
  imoNumber: string,
  companyName: string,
  issuedDate: Date,
  shipyardName: string,
  vesselData?: {
    shipType?: string | null
    flag?: string | null
    distinctiveNumber?: string | null
  }
): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 55
  const lineGap = 20

  // Load PICMW logo
  const logo = loadAssetImage('picmwlogo.png')
  if (logo) {
    doc.addImage(logo, 'PNG', pageWidth / 2 - 40, margin, 80, 60)
  }

  // Company name and address
  let cursorY = margin + 70
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(shipyardName || 'Philippine Iron Construction & Marine Works, Inc.', pageWidth / 2, cursorY, { align: 'center' })
  cursorY += lineGap * 0.8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Lower Jasaan, Jasaan Misamis Oriental', pageWidth / 2, cursorY, { align: 'center' })

  // Main title
  cursorY += lineGap * 1.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('DRY DOCK CERTIFICATE', pageWidth / 2, cursorY, { align: 'center' })

  // Ship details table
  cursorY += lineGap * 2
  const tableStartX = margin
  const colWidths = [100, 100, 100, 100, 100]
  const rowHeight = 25

  const headers = ['Name of Ship', 'Distinctive Number of Letters', 'Port of Registry', 'Ship Type', 'IMO Number']
  let xPos = tableStartX
  headers.forEach((header, idx) => {
    doc.setFillColor(240, 240, 240)
    doc.rect(xPos, cursorY, colWidths[idx], rowHeight, 'F')
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.rect(xPos, cursorY, colWidths[idx], rowHeight, 'S')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(header, xPos + 5, cursorY + 15, { maxWidth: colWidths[idx] - 10 })
    xPos += colWidths[idx]
  })

  // Data row
  cursorY += rowHeight
  xPos = tableStartX
  const distinctiveNumber = vesselData?.distinctiveNumber || 'THS'
  const portOfRegistry = String(Math.floor(10 + Math.random() * 90))
  const shipData = [
    vesselName,
    distinctiveNumber,
    portOfRegistry,
    vesselData?.shipType || '',
    imoNumber
  ]
  shipData.forEach((data, idx) => {
    doc.setFillColor(255, 255, 255)
    doc.rect(xPos, cursorY, colWidths[idx], rowHeight, 'F')
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.rect(xPos, cursorY, colWidths[idx], rowHeight, 'S')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(data, xPos + 5, cursorY + 15, { maxWidth: colWidths[idx] - 10 })
    xPos += colWidths[idx]
  })

  // Certification statement
  cursorY += rowHeight + lineGap * 1.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('THIS IS TO CERTIFY:', margin, cursorY)
  
  cursorY += lineGap * 1.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('1. That the dry docking and maintenance of the above mentioned ship was found to comply with the provisions of the MARINA memorandum circular 203.', margin, cursorY, {
    maxWidth: pageWidth - margin * 2,
    lineHeightFactor: 1.5
  })
  
  cursorY += lineGap * 2
  doc.text('2. That the ship is suitable for carriage of those classes of dangerous goods are specified in the appendix hereto, subject to any provisions of Maritime Industry Authority.', margin, cursorY, {
    maxWidth: pageWidth - margin * 2,
    lineHeightFactor: 1.5
  })

  // Validity and dates
  cursorY += lineGap * 2.5
  const expiryDate = new Date(issuedDate)
  expiryDate.setFullYear(expiryDate.getFullYear() + 3) // 3 years validity
  
  doc.setFontSize(10)
  doc.text(`This document is valid until ${expiryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, cursorY)
  
  cursorY += lineGap * 1.2
  const day = issuedDate.getDate()
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const month = monthNames[issuedDate.getMonth()]
  const year = issuedDate.getFullYear()
  doc.text(`Completion date of the survey on which this certificate is based: ${issuedDate.toLocaleDateString('en-GB')}`, margin, cursorY)
  
  cursorY += lineGap * 1.2
  doc.text(`Issued at PICMW Shipyard, on the ${day} ${month} ${year}`, margin, cursorY)

  // Footer with Bureau Veritas logos and signature
  cursorY = pageHeight - 100
  const signatureImg = loadAssetImage('signature.png')
  if (signatureImg) {
    doc.addImage(signatureImg, 'PNG', pageWidth - margin - 120, cursorY, 100, 40)
  }
  
  cursorY += 45
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('BUREAU VERITAS', pageWidth - margin - 120, cursorY)
  cursorY += lineGap * 0.8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('R. PAPASTEFANOU', pageWidth - margin - 120, cursorY)
  cursorY += lineGap * 0.8
  doc.text('By Order of the Secretary', pageWidth - margin - 120, cursorY)

  const pdfOutput = doc.output('arraybuffer')
  return Buffer.from(pdfOutput)
}

// Generic certificate generator (fallback)
async function generateCertificatePDF(
  certificateName: string,
  vesselName: string,
  imoNumber: string,
  companyName: string,
  issuedDate: Date,
  shipyardName: string,
  vesselData?: {
    shipType?: string | null
    flag?: string | null
    distinctiveNumber?: string | null
  },
  services?: Array<{ serviceName: string; progress?: number | null; startDate?: Date; endDate?: Date; area?: number | null }>
): Promise<Buffer> {
  if (certificateName === 'Drydock Report') {
    return generateDrydockReportPDF(vesselName, imoNumber, companyName, issuedDate, shipyardName, vesselData, services)
  } else if (certificateName === 'Drydock Certificate') {
    return generateDrydockCertificatePDF(vesselName, imoNumber, companyName, issuedDate, shipyardName, vesselData)
  }
  
  // Fallback to old format for other certificates
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(certificateName.toUpperCase(), pageWidth / 2, 50, { align: 'center' })
  
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
      select: { id: true, progress: true, serviceName: true, startDate: true, endDate: true }
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

    // Get servicesNeeded from drydock request (for area per service)
    const requestDetail = await prisma.drydockRequest.findUnique({
      where: { id: booking.drydockRequestId },
      select: { servicesNeeded: true }
    })
    const areaMap: Record<string, number> = {}
    if (requestDetail?.servicesNeeded) {
      try {
        const parsed = requestDetail.servicesNeeded as any[]
        parsed.forEach((svc: any) => {
          if (svc?.name && typeof svc.area === 'number') {
            areaMap[String(svc.name).toLowerCase()] = svc.area
          }
        })
      } catch (e) {
        console.warn('Could not parse servicesNeeded', e)
      }
    }

    const servicesWithArea = services.map(svc => ({
      ...svc,
      area: areaMap[svc.serviceName.toLowerCase()] ?? null
    }))

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

    // Prepare to process certificates
    const processedCertificates = []

    for (const cert of certificatesToIssue) {
      const certificateId = crypto.randomUUID()
      const now = new Date()
      let certificateUrl: string | null = null

      try {
        if (cert.type === 'VESSEL_PLANS' && vesselPlansFile) {
          console.log(`Uploading file for ${cert.name}...`)
          certificateUrl = await uploadFileToS3(vesselPlansFile, certificateId, cert.name)
          console.log(`File uploaded successfully. URL: ${certificateUrl}`)
        } else {
          console.log(`Generating PDF for ${cert.name}...`)
          const pdfBuffer = await generateCertificatePDF(
            cert.name,
            booking.vesselName,
            booking.imoNumber,
            vessel.user.fullName || vessel.user.email || 'Shipowner',
            now,
            shipyardName,
            {
              shipType: vessel.shipType,
              flag: vessel.flag,
              distinctiveNumber: 'THS'
            },
            servicesWithArea
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

      processedCertificates.push({
        id: certificateId,
        name: cert.name,
        type: cert.type,
        url: certificateUrl,
        issuedDate: now,
      })
    }

    // Create notification message content
    const companyName = vessel.user.fullName || vessel.user.email || 'Shipowner'
    const vesselName = vessel.vesselName || 'Vessel'
    const certificatesList = processedCertificates.map((cert, index) => 
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
    const notificationId = crypto.randomUUID()

    // Perform all database writes in a single transaction
    const issuedCertificates = await prisma.$transaction(async (tx) => {
      const certificateCreationPromises = processedCertificates.map(cert =>
        tx.$executeRaw`
          INSERT INTO drydock_issued_certificates (
            id, drydockBookingId, vesselId, userId, certificateName, 
            certificateType, certificateUrl, issuedDate, createdAt, updatedAt
          ) VALUES (
            ${cert.id}, ${bookingId}, ${booking.vesselId}, ${booking.userId},
            ${cert.name}, ${cert.type}, ${cert.url}, ${cert.issuedDate}, ${cert.issuedDate}, ${cert.issuedDate}
          )
        `
      )
      await Promise.all(certificateCreationPromises)
      
      // Create notification
      await tx.$executeRaw`
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
      await tx.$executeRaw`
        UPDATE drydock_bookings
        SET status = 'COMPLETED', updatedAt = NOW()
        WHERE id = ${bookingId}
      `

      // Update drydock_request status to COMPLETED
      await tx.$executeRaw`
        UPDATE drydock_requests
        SET status = 'COMPLETED', updatedAt = NOW()
        WHERE id = ${booking.drydockRequestId}
      `
      
      return processedCertificates
    })

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

