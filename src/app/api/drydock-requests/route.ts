import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    console.log('Fetching drydock requests for userId:', userId)

    // Fetch drydock requests for the specified user
    const requests = await prisma.$queryRaw`
      SELECT 
        dr.id,
        dr.userId,
        dr.vesselId,
        dr.companyName,
        dr.companyLogoUrl,
        dr.vesselName,
        dr.imoNumber,
        dr.flag,
        dr.shipType,
        dr.vesselImageUrl,
        dr.priorityLevel,
        dr.servicesNeeded,
        dr.scopeOfWorkUrl,
        dr.status,
        dr.createdAt,
        dr.updatedAt
      FROM drydock_requests dr
      WHERE dr.userId = ${userId}
      ORDER BY dr.createdAt DESC
    `

    console.log('Found drydock requests:', requests)

    return NextResponse.json({ requests }, { status: 200 })
  } catch (error) {
    console.error('Error fetching drydock requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch drydock requests' },
      { status: 500 }
    )
  }
}

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
    
    // Extract form data
    const userId = formData.get('userId') as string
    const vesselId = formData.get('vesselId') as string
    const companyName = formData.get('companyName') as string
    const vesselName = formData.get('vesselName') as string
    const imoNumber = formData.get('imoNumber') as string
    const flag = formData.get('flag') as string
    const shipType = formData.get('shipType') as string
    const priorityLevel = formData.get('priorityLevel') as string
    const servicesNeeded = JSON.parse(formData.get('servicesNeeded') as string)
    const companyLogoUrl = formData.get('companyLogoUrl') as string
    const vesselImageUrl = formData.get('vesselImageUrl') as string
    
    console.log('Received services data:', servicesNeeded)
    
    // Get the uploaded file
    const scopeOfWorkFile = formData.get('scopeOfWork') as File
    
    if (!userId || !vesselId || !companyName || !vesselName || !imoNumber || !flag || !shipType || !priorityLevel || !servicesNeeded || !scopeOfWorkFile) {
      return NextResponse.json(
        { error: 'All required fields are missing' },
        { status: 400 }
      )
    }

    let scopeOfWorkUrl = null

    // Upload file to S3 if provided
    if (scopeOfWorkFile && scopeOfWorkFile.size > 0) {
      const bucketName = process.env.AWS_S3_BUCKET
      if (!bucketName) {
        console.error('AWS_S3_BUCKET environment variable is not set')
        return NextResponse.json(
          { error: 'File upload configuration error' },
          { status: 500 }
        )
      }

      const fileExtension = scopeOfWorkFile.name.split('.').pop()
      const fileName = `drydock-requests/${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`
      
      const uploadCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: Buffer.from(await scopeOfWorkFile.arrayBuffer()),
        ContentType: scopeOfWorkFile.type,
      })

      await s3Client.send(uploadCommand)
      scopeOfWorkUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'ap-southeast-2'}.amazonaws.com/${fileName}`
    }

    // Create drydock request in database using raw query since Prisma client might not be updated
    await prisma.$executeRaw`
      INSERT INTO drydock_requests (
        id, userId, vesselId, companyName, companyLogoUrl, vesselName, 
        imoNumber, flag, shipType, vesselImageUrl, priorityLevel, 
        servicesNeeded, scopeOfWorkUrl, status, createdAt, updatedAt
      ) VALUES (
        ${crypto.randomUUID()}, ${userId}, ${vesselId}, ${companyName}, 
        ${companyLogoUrl || null}, ${vesselName}, ${imoNumber}, ${flag}, 
        ${shipType}, ${vesselImageUrl || null}, ${priorityLevel}, 
        ${JSON.stringify(servicesNeeded)}, ${scopeOfWorkUrl || null}, 
        'PENDING', NOW(), NOW()
      )
    `

    // Get the created request
    const createdRequest = await prisma.$queryRaw`
      SELECT * FROM drydock_requests 
      WHERE userId = ${userId} AND vesselId = ${vesselId} 
      ORDER BY createdAt DESC LIMIT 1
    `

    return NextResponse.json({
      success: true,
      message: 'Drydock request submitted successfully',
      request: createdRequest
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating drydock request:', error)
    return NextResponse.json(
      { error: 'Failed to create drydock request' },
      { status: 500 }
    )
  }
}
