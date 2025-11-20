import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

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

        // Upload to S3
        const fileName = `vessel-certificate-${recertificateId}-${Date.now()}.pdf`
        console.log('Uploading to S3:', fileName)
        
        await s3Client.send(new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET!,
          Key: `certificates/${fileName}`,
          Body: certificateBuffer,
          ContentType: 'application/pdf',
          ACL: 'public-read',
        }))

        // Generate a signed URL for the certificate (valid for 7 days - maximum allowed)
        const signedUrl = await getSignedUrl(s3Client, new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET!,
          Key: `certificates/${fileName}`,
        }), { expiresIn: 604800 }) // 7 days in seconds (604800 = 7 * 24 * 60 * 60)

        console.log('Certificate uploaded to:', signedUrl)

        // Update the recertification record
        const updatedRecertification = await prisma.drydockVesselRecertificate.update({
          where: { id: recertificateId },
          data: {
            status: 'COMPLETED',
            vesselCertificateFile: signedUrl,
            updatedAt: new Date()
          }
        })

        console.log('Database updated successfully')

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
      { label: 'Expiry Date:', value: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString() }
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
    page.drawText('This certificate is valid for one year from the issue date.', {
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
