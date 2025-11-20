import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bookingId = searchParams.get('bookingId')

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      )
    }

    // Fetch all certificates for this booking
    const certificates = await prisma.drydockIssuedCertificate.findMany({
      where: {
        drydockBookingId: bookingId
      },
      orderBy: {
        issuedDate: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: certificates.map(cert => ({
        ...cert,
        issuedDate: cert.issuedDate.toISOString(),
        createdAt: cert.createdAt.toISOString(),
        updatedAt: cert.updatedAt.toISOString(),
      }))
    })
  } catch (error) {
    console.error('Error fetching booking certificates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch certificates' },
      { status: 500 }
    )
  }
}

