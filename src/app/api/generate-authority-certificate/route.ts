import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import jsPDF from 'jspdf'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { authorityRequestId, certificateData } = body

    console.log('Received certificate generation request:', {
      authorityRequestId,
      certificateData
    })

    // Validate required fields
    if (!authorityRequestId || !certificateData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Generate PDF using jsPDF
    const pdfBuffer = await generatePDFFromData(certificateData)
    
    // Generate unique filename
    const timestamp = Date.now()
    const filename = `authority-certificates/cert-${authorityRequestId}-${timestamp}.pdf`
    
    // Upload to S3
    const bucketName = process.env.AWS_S3_BUCKET
    if (!bucketName) {
      console.error('AWS_S3_BUCKET environment variable is not set')
      return NextResponse.json(
        { error: 'File upload configuration error' },
        { status: 500 }
      )
    }

    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: filename,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      // ACL removed - rely on bucket policy for public access if needed
    })

    await s3Client.send(uploadCommand)
    
    // Generate the S3 URL
    const certificateUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'ap-southeast-2'}.amazonaws.com/${filename}`

    console.log('Certificate generated and uploaded successfully:', certificateUrl)

    return NextResponse.json({
      success: true,
      certificateUrl: certificateUrl
    })

  } catch (error) {
    console.error('Error generating certificate:', error)
    return NextResponse.json(
      { error: 'Failed to generate certificate' },
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
  requestDate: string;
  approvedDate: string;
  validUntil: string;
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
  
  const details = [
    { label: 'Vessel Name:', value: certificateData.vesselName },
    { label: 'IMO Number:', value: certificateData.imoNumber },
    { label: 'Company:', value: certificateData.companyName },
    { label: 'Ship Type:', value: certificateData.shipType },
    { label: 'Flag:', value: certificateData.flag },
    { label: 'Request Date:', value: new Date(certificateData.requestDate).toLocaleDateString() },
    { label: 'Approved Date:', value: new Date(certificateData.approvedDate).toLocaleDateString() },
    { label: 'Valid Until:', value: new Date(certificateData.validUntil).toLocaleDateString() }
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
