import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const prisma = new PrismaClient()

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
    const { recertificateId } = body

    if (!recertificateId) {
      return NextResponse.json(
        { error: 'recertificateId is required' },
        { status: 400 }
      )
    }

    // Get the recertification request
    const recertification = await prisma.drydockVesselRecertificate.findUnique({
      where: { id: recertificateId },
    })

    if (!recertification) {
      return NextResponse.json(
        { error: 'Recertification request not found' },
        { status: 404 }
      )
    }

    if (!recertification.vesselCertificateFile) {
      return NextResponse.json(
        { error: 'No certificate file found' },
        { status: 404 }
      )
    }

    // Extract the S3 key from the existing URL
    const existingUrl = recertification.vesselCertificateFile
    const urlParts = existingUrl.split('/certificates/')
    if (urlParts.length !== 2) {
      return NextResponse.json(
        { error: 'Invalid certificate URL format' },
        { status: 400 }
      )
    }

    const s3Key = `certificates/${urlParts[1]}`

    // Generate a new signed URL (valid for 7 days - maximum allowed)
    const signedUrl = await getSignedUrl(s3Client, new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key,
    }), { expiresIn: 604800 }) // 7 days in seconds (604800 = 7 * 24 * 60 * 60)

    // Update the database with the new signed URL
    const updatedRecertification = await prisma.drydockVesselRecertificate.update({
      where: { id: recertificateId },
      data: {
        vesselCertificateFile: signedUrl,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Signed URL generated successfully',
      data: {
        signedUrl: signedUrl,
        recertification: updatedRecertification
      }
    })

  } catch (error) {
    console.error('Error generating signed URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate signed URL' },
      { status: 500 }
    )
  }
}
