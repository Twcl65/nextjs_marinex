import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jwtVerify } from 'jose'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'crypto'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

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

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const vesselId = searchParams.get('vesselId')

    if (!vesselId) {
      return NextResponse.json(
        { error: 'vesselId is required' },
        { status: 400 }
      )
    }

    // Verify that the vessel belongs to the current user
    const vessel = await prisma.shipVessel.findFirst({
      where: {
        id: vesselId,
        userId: user.userId
      }
    })

    if (!vessel) {
      return NextResponse.json(
        { error: 'Vessel not found or access denied' },
        { status: 404 }
      )
    }

    // Get all documents for this vessel
    const documents = await prisma.$queryRawUnsafe<Array<{
      id: string
      vesselId: string
      senderId: string
      documentType: string
      documentName: string
      documentUrl: string
      description: string | null
      createdAt: Date
      updatedAt: Date
      sender: string
      status: string | null
    }>>(
      `SELECT 
        ud.id,
        ud.vesselId,
        ud.senderId,
        ud.documentType,
        ud.documentName,
        ud.documentUrl,
        ud.description,
        ud.createdAt,
        ud.updatedAt,
        NULL as status,
        CAST(JSON_OBJECT(
          'id', u.id,
          'fullName', u.fullName,
          'shipyardName', u.shipyardName,
          'role', u.role,
          'logoUrl', u.logoUrl
        ) AS JSON) as sender
      FROM user_documents ud
      INNER JOIN users u ON ud.senderId = u.id
      WHERE ud.vesselId = ?
      ORDER BY ud.createdAt DESC`,
      vesselId
    )

    // Get issued certificates for this vessel from drydock_issued_certificates
    const certificates = await prisma.$queryRawUnsafe<Array<{
      id: string
      vesselId: string
      userId: string
      certificateName: string
      certificateType: string
      certificateUrl: string | null
      issuedDate: Date
      createdAt: Date
      updatedAt: Date
      drydockBookingId: string
    }>>(
      `SELECT 
        id,
        vesselId,
        userId,
        certificateName,
        certificateType,
        certificateUrl,
        issuedDate,
        createdAt,
        updatedAt,
        drydockBookingId
      FROM drydock_issued_certificates
      WHERE vesselId = ?
      ORDER BY issuedDate DESC`,
      vesselId
    )

    // Format the documents and filter out shipyard credentials (builder/repair/other certificates)
    // Only allow bid certificates and drydock-issued certificates from shipyards
    const excludedDocumentNames = [
      'Builder Certificate',
      'Repair Certificate',
      'Other Certificate'
    ]

    // Helper function to determine status (new if issued within last 7 days, otherwise old)
    const getCertificateStatus = (issuedDate: Date): string => {
      const now = new Date()
      const issued = new Date(issuedDate)
      const daysDiff = Math.floor((now.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24))
      return daysDiff <= 7 ? 'new' : 'old'
    }

    // Format regular documents
    interface DocumentRow {
      id: string
      vesselId: string
      senderId: string
      documentType: string
      documentName: string
      documentUrl: string
      description: string | null
      createdAt: Date
      updatedAt: Date
      sender: string | { id: string; fullName?: string; shipyardName?: string; role: string; logoUrl?: string | null }
      status: string | null
    }

    const formattedDocuments = documents
      .map((doc: DocumentRow) => {
        const senderData = typeof doc.sender === 'string' ? JSON.parse(doc.sender) : doc.sender
        return {
          id: doc.id,
          vesselId: doc.vesselId,
          senderId: doc.senderId,
          documentType: doc.documentType,
          documentName: doc.documentName,
          documentUrl: doc.documentUrl,
          description: doc.description,
          createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date(doc.createdAt).toISOString(),
          updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : new Date(doc.updatedAt).toISOString(),
          status: doc.status || null,
          sender: {
            id: senderData.id,
            name: senderData.role === 'SHIPOWNER' ? senderData.fullName : senderData.shipyardName,
            role: senderData.role,
            logoUrl: senderData.logoUrl
          }
        }
      })
      .filter((doc) => {
        // Filter out builder/repair/other certificates (shipyard credentials)
        // Allow bid certificates and all other documents
        if (doc.sender.role === 'SHIPYARD') {
          // For shipyard documents, only allow bid certificates
          return doc.documentName === 'Bid Certificate' || 
                 !excludedDocumentNames.includes(doc.documentName)
        }
        // Allow all documents from other senders (MARINA, SHIPOWNER)
        return true
      })

    // Format certificates from drydock_issued_certificates
    // Get shipyard user info for certificates
    interface CertificateRow {
      id: string
      vesselId: string
      userId: string
      certificateName: string
      certificateType: string
      certificateUrl: string | null
      issuedDate: Date
      createdAt: Date
      updatedAt: Date
      drydockBookingId: string
    }

    const certificateDocuments = await Promise.all(
      certificates.map(async (cert: CertificateRow) => {
        // Get the shipyard user who issued the certificate (from the booking)
        const bookingData = await prisma.$queryRawUnsafe<Array<{
          shipyardUserId: string
        }>>(
          `SELECT shipyardUserId FROM drydock_bookings WHERE id = ? LIMIT 1`,
          cert.drydockBookingId
        )

        let shipyardUser = null
        if (bookingData && bookingData.length > 0) {
          const shipyardUserData = await prisma.user.findUnique({
            where: { id: bookingData[0].shipyardUserId },
            select: {
              id: true,
              shipyardName: true,
              role: true,
              logoUrl: true
            }
          })
          if (shipyardUserData) {
            shipyardUser = {
              id: shipyardUserData.id,
              name: shipyardUserData.shipyardName,
              role: shipyardUserData.role,
              logoUrl: shipyardUserData.logoUrl
            }
          }
        }

        const status = getCertificateStatus(cert.issuedDate)

        return {
          id: cert.id,
          vesselId: cert.vesselId,
          senderId: shipyardUser?.id || cert.userId,
          documentType: 'Certificate',
          documentName: cert.certificateName,
          documentUrl: cert.certificateUrl || '', // Use the PDF URL if available
          description: `Issued on ${new Date(cert.issuedDate).toLocaleDateString()}`,
          createdAt: cert.issuedDate instanceof Date ? cert.issuedDate.toISOString() : new Date(cert.issuedDate).toISOString(),
          updatedAt: cert.updatedAt instanceof Date ? cert.updatedAt.toISOString() : new Date(cert.updatedAt).toISOString(),
          status: status,
          sender: shipyardUser || {
            id: cert.userId,
            name: 'Shipyard',
            role: 'SHIPYARD',
            logoUrl: null
          },
          isCertificate: true // Flag to identify issued certificates
        }
      })
    )

    // Combine documents and certificates, sort by creation date
    const allDocuments = [...formattedDocuments, ...certificateDocuments].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return NextResponse.json({
      success: true,
      data: allDocuments
    })
  } catch (error) {
    console.error('Error fetching vessel documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const vesselId = formData.get('vesselId') as string
    const documentType = formData.get('documentType') as string
    const documentName = formData.get('documentName') as string
    const description = formData.get('description') as string | null
    const documentFile = formData.get('documentFile') as File | null

    if (!vesselId || !documentType || !documentName || !documentFile) {
      return NextResponse.json(
        { error: 'Missing required fields: vesselId, documentType, documentName, and documentFile are required' },
        { status: 400 }
      )
    }

    // Verify that the vessel belongs to the current user
    const vessel = await prisma.shipVessel.findFirst({
      where: {
        id: vesselId,
        userId: user.userId
      }
    })

    if (!vessel) {
      return NextResponse.json(
        { error: 'Vessel not found or access denied' },
        { status: 404 }
      )
    }

    // Upload file to S3
    let documentUrl: string | null = null
    
    if (documentFile && documentFile.size > 0) {
      try {
        const bucketName = process.env.AWS_S3_BUCKET
        if (!bucketName) {
          console.error('AWS_S3_BUCKET environment variable is not set')
          return NextResponse.json(
            { error: 'File upload configuration error: S3 bucket not configured' },
            { status: 500 }
          )
        }

        const fileExtension = documentFile.name.split('.').pop() || 'pdf'
        const fileName = `vessel-documents/${user.userId}/${vesselId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`
        
        console.log('Uploading document to S3:', { fileName, fileSize: documentFile.size, fileType: documentFile.type })
        
        const uploadCommand = new PutObjectCommand({
          Bucket: bucketName,
          Key: fileName,
          Body: Buffer.from(await documentFile.arrayBuffer()),
          ContentType: documentFile.type || 'application/octet-stream',
        })

        await s3Client.send(uploadCommand)
        documentUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'ap-southeast-2'}.amazonaws.com/${fileName}`
        console.log('Document uploaded successfully to S3:', documentUrl)
      } catch (s3Error) {
        console.error('Error uploading file to S3:', s3Error)
        return NextResponse.json(
          { error: `Failed to upload file to S3: ${s3Error instanceof Error ? s3Error.message : 'Unknown error'}` },
          { status: 500 }
        )
      }
    }

    // Create document in database
    if (!documentUrl) {
      return NextResponse.json(
        { error: 'Document URL is missing after upload' },
        { status: 500 }
      )
    }

    const documentId = crypto.randomUUID()
    
    try {
      console.log('Inserting document into database:', { documentId, vesselId, senderId: user.userId, documentName })
      
      await prisma.$executeRaw`
        INSERT INTO user_documents (
          id, vesselId, senderId, documentType, documentName, documentUrl, description, createdAt, updatedAt
        ) VALUES (
          ${documentId}, ${vesselId}, ${user.userId}, ${documentType}, ${documentName}, ${documentUrl}, ${description || null}, NOW(), NOW()
        )
      `
      
      console.log('Document successfully inserted into database:', documentId)
    } catch (dbError) {
      console.error('Error inserting document into database:', dbError)
      return NextResponse.json(
        { error: `Failed to save document to database: ${dbError instanceof Error ? dbError.message : 'Unknown error'}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: documentId,
        vesselId,
        senderId: user.userId,
        documentType,
        documentName,
        documentUrl,
        description,
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating document:', error)
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId is required' },
        { status: 400 }
      )
    }

    // Get the document to verify it exists and belongs to the user
    const document = await prisma.$queryRawUnsafe<Array<{
      id: string
      vesselId: string
      senderId: string
      documentUrl: string | null
    }>>(
      `SELECT id, vesselId, senderId, documentUrl FROM user_documents WHERE id = ? LIMIT 1`,
      documentId
    )

    if (!document || document.length === 0) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    const doc = document[0]

    // Verify that the document belongs to the current user
    if (doc.senderId !== user.userId) {
      return NextResponse.json(
        { error: 'Access denied. You can only delete your own documents.' },
        { status: 403 }
      )
    }

    // Delete document from database
    await prisma.$executeRawUnsafe(
      `DELETE FROM user_documents WHERE id = ?`,
      documentId
    )

    console.log('Document deleted successfully:', documentId)

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}

