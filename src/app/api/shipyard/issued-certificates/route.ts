import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (user.role !== 'SHIPYARD') {
      return NextResponse.json(
        { error: 'Forbidden - Shipyard access only' },
        { status: 403 }
      )
    }

    // Get all certificates issued by this shipyard
    // We need to join with bookings to get the shipyardUserId
    const certificates = await prisma.$queryRawUnsafe<Array<{
      id: string
      drydockBookingId: string
      vesselId: string
      userId: string
      certificateName: string
      certificateType: string
      certificateUrl: string | null
      issuedDate: Date
      createdAt: Date
      updatedAt: Date
      vesselName: string
      imoNumber: string
      companyName: string
    }>>(
      `SELECT 
        dic.id,
        dic.drydockBookingId,
        dic.vesselId,
        dic.userId,
        dic.certificateName,
        dic.certificateType,
        dic.certificateUrl,
        dic.issuedDate,
        dic.createdAt,
        dic.updatedAt,
        dr.vesselName,
        dr.imoNumber,
        dr.companyName
      FROM drydock_issued_certificates dic
      INNER JOIN drydock_bookings db ON dic.drydockBookingId = db.id
      INNER JOIN drydock_requests dr ON db.drydockRequestId = dr.id
      WHERE db.shipyardUserId = ?
      ORDER BY dic.issuedDate DESC`,
      user.userId
    )

    return NextResponse.json({
      success: true,
      data: certificates.map(cert => ({
        ...cert,
        issuedDate: cert.issuedDate instanceof Date ? cert.issuedDate.toISOString() : new Date(cert.issuedDate).toISOString(),
        createdAt: cert.createdAt instanceof Date ? cert.createdAt.toISOString() : new Date(cert.createdAt).toISOString(),
        updatedAt: cert.updatedAt instanceof Date ? cert.updatedAt.toISOString() : new Date(cert.updatedAt).toISOString(),
      }))
    })
  } catch (error) {
    console.error('Error fetching issued certificates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch certificates' },
      { status: 500 }
    )
  }
}

