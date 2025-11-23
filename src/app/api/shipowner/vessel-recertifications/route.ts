import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const prisma = new PrismaClient()

const region = process.env.AWS_REGION || 'ap-southeast-2'
const bucket = process.env.AWS_S3_BUCKET

const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const status = searchParams.get('status') || 'all'
    const search = searchParams.get('search') || ''

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Build the where clause
    const whereClause: {
      userId: string
      status?: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
      OR?: Array<{
        vesselName?: { contains: string; mode: 'insensitive' }
        vesselImoNumber?: { contains: string; mode: 'insensitive' }
      }>
    } = {
      userId: userId
    }

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
        }
      ]
    }

    const recertifications = await prisma.drydockVesselRecertificate.findMany({
      where: whereClause,
      include: {
        vessel: {
          select: {
            vesselName: true,
            imoNumber: true,
            vesselImageUrl: true
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
    const formData = await request.formData()
    
    const userId = formData.get('userId') as string
    const vesselId = formData.get('vesselId') as string
    const companyName = formData.get('companyName') as string
    const vesselName = formData.get('vesselName') as string
    const vesselImoNumber = formData.get('vesselImoNumber') as string
    
    // File uploads
    const vesselPlans = formData.get('vesselPlans') as File | null
    const drydockReport = formData.get('drydockReport') as File | null
    const drydockCertificate = formData.get('drydockCertificate') as File | null
    const safetyCertificate = formData.get('safetyCertificate') as File | null

    if (!userId || !vesselId || !companyName || !vesselName || !vesselImoNumber) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Handle file uploads to S3 (with ACL fallback for buckets that don't allow ACLs)
    const uploadFileToS3 = async (file: File | null, prefix: string) => {
      if (!file || file.size === 0) return null
      
      if (!bucket) {
        console.error('AWS_S3_BUCKET environment variable is not set')
        return null
      }

      const fileExtension = file.name.split('.').pop()
      const fileName = `vessel-recertifications/${userId}/${prefix}-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`
      const buffer = Buffer.from(await file.arrayBuffer())

      // Try with ACL first, fallback if ACLs are disabled
      try {
        const cmd = new PutObjectCommand({
          Bucket: bucket,
          Key: fileName,
          Body: buffer,
          ContentType: file.type || 'application/octet-stream',
          ACL: 'public-read', // Try to make it public
        })
        await s3Client.send(cmd)
        console.log(`[Recertification] ${prefix} uploaded with public-read ACL`)
      } catch (aclError: unknown) {
        console.warn(`[Recertification] ACL upload failed for ${prefix}, trying without ACL:`, aclError)
        
        // Retry without ACL (bucket policy might handle public access)
        try {
          const cmd = new PutObjectCommand({
            Bucket: bucket,
            Key: fileName,
            Body: buffer,
            ContentType: file.type || 'application/octet-stream',
            // No ACL - rely on bucket policy
          })
          await s3Client.send(cmd)
          console.log(`[Recertification] ${prefix} uploaded without ACL (using bucket policy)`)
        } catch (noAclError: unknown) {
          console.error(`[Recertification] Failed to upload ${prefix}:`, noAclError)
          return null
        }
      }

      return `https://${bucket}.s3.${region}.amazonaws.com/${fileName}`
    }

    const [vesselPlansUrl, drydockReportUrl, drydockCertificateUrl, safetyCertificateUrl] = await Promise.all([
      uploadFileToS3(vesselPlans, 'vessel-plans'),
      uploadFileToS3(drydockReport, 'drydock-report'),
      uploadFileToS3(drydockCertificate, 'drydock-certificate'),
      uploadFileToS3(safetyCertificate, 'safety-certificate')
    ])

    // Create recertification request
    const recertification = await prisma.drydockVesselRecertificate.create({
      data: {
        userId,
        vesselId,
        companyName,
        vesselName,
        vesselImoNumber,
        vesselPlansUrl,
        drydockReportUrl,
        drydockCertificateUrl,
        safetyCertificateUrl,
        status: 'PENDING'
      }
    })

    return NextResponse.json({
      success: true,
      data: recertification,
      message: 'Vessel recertification request submitted successfully'
    })

  } catch (error) {
    console.error('Error creating vessel recertification:', error)
    
    // Provide more specific error messages
    let errorMessage = 'Failed to create vessel recertification request'
    if (error instanceof Error) {
      errorMessage = error.message || errorMessage
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage 
      },
      { status: 500 }
    )
  }
}
