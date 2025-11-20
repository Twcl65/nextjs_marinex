import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    const userId = formData.get('userId') as string
    const vesselId = formData.get('vesselId') as string
    const drydockRequestId = formData.get('drydockRequestId') as string
    const drydockBookingId = formData.get('drydockBookingId') as string
    const finalScopeOfWork = formData.get('finalScopeOfWork') as File | null

    console.log('Received authority request data:', {
      userId,
      vesselId,
      drydockRequestId,
      drydockBookingId,
      hasFile: !!finalScopeOfWork,
      fileSize: finalScopeOfWork?.size
    })

    // Validate required fields
    if (!userId || !vesselId || !drydockRequestId || !drydockBookingId || !finalScopeOfWork) {
      console.log('Missing required fields:', {
        userId: !!userId,
        vesselId: !!vesselId,
        drydockRequestId: !!drydockRequestId,
        drydockBookingId: !!drydockBookingId,
        finalScopeOfWork: !!finalScopeOfWork
      })
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if the vessel exists and belongs to the user
    const vessel = await prisma.shipVessel.findFirst({
      where: {
        id: vesselId,
        userId: userId
      }
    })

    if (!vessel) {
      return NextResponse.json(
        { error: 'Vessel not found or access denied' },
        { status: 404 }
      )
    }

    // Check if a certificate request already exists for this drydock booking
    const existingCertificate = await prisma.drydockAuthorityRequest.findFirst({
      where: {
        drydockBookingId: drydockBookingId,
        status: {
          in: ['REQUESTED', 'PENDING', 'APPROVED', 'ISSUED']
        }
      }
    })

    if (existingCertificate) {
      return NextResponse.json(
        { error: 'Authority request already exists for this booking' },
        { status: 409 }
      )
    }

    // Handle file upload for Final Scope of Works to S3
    let finalScopeOfWorkUrl = null
    if (finalScopeOfWork && finalScopeOfWork.size > 0) {
      const bucketName = process.env.AWS_S3_BUCKET
      if (!bucketName) {
        console.error('AWS_S3_BUCKET environment variable is not set')
        return NextResponse.json(
          { error: 'File upload configuration error' },
          { status: 500 }
        )
      }

      const fileExtension = finalScopeOfWork.name.split('.').pop()
      const fileName = `authority-requests/${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`
      
      const uploadCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: Buffer.from(await finalScopeOfWork.arrayBuffer()),
        ContentType: finalScopeOfWork.type,
        // ACL removed - rely on bucket policy for public access if needed
      })

      await s3Client.send(uploadCommand)
      finalScopeOfWorkUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'ap-southeast-2'}.amazonaws.com/${fileName}`
    }

    // Create the drydock authority request
    const newAuthorityRequest = await prisma.drydockAuthorityRequest.create({
      data: {
        drydockRequestId,
        drydockBookingId,
        vesselId,
        userId,
        status: 'REQUESTED',
        requestDate: new Date(),
        finalScopeOfWorkUrl,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      message: 'Drydock authority request submitted successfully',
      authorityRequest: newAuthorityRequest
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating authority approval certificate request:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const status = searchParams.get('status')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Build where clause
    const whereClause: {
      userId: string;
      status?: 'REQUESTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'ISSUED' | 'EXPIRED';
    } = {
      userId: userId
    }

    if (status && status !== 'all') {
      const validStatuses = ['REQUESTED', 'PENDING', 'APPROVED', 'REJECTED', 'ISSUED', 'EXPIRED'];
      if (validStatuses.includes(status)) {
        whereClause.status = status as 'REQUESTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'ISSUED' | 'EXPIRED';
      }
    }

    // Fetch drydock authority requests
    const authorityRequests = await prisma.drydockAuthorityRequest.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        drydockRequest: {
          select: {
            id: true,
            status: true,
            vesselName: true,
            imoNumber: true
          }
        }
      }
    })

    return NextResponse.json({
      authorityRequests: authorityRequests.map(request => ({
        ...request,
        authorityCertificate: request.authorityCertificate || null
      }))
    })

  } catch (error) {
    console.error('Error fetching authority approval certificate requests:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
