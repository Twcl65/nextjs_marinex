import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Build the where clause for filtering
    const whereClause = status && status !== 'all' 
      ? { status: status as 'REQUESTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'ISSUED' | 'EXPIRED' }
      : {}

    // Fetch all drydock authority requests for Marina review using Prisma
    const authorityRequests = await prisma.drydockAuthorityRequest.findMany({
      where: whereClause,
      include: {
        drydockRequest: {
          select: {
            id: true,
            status: true,
            vesselName: true,
            imoNumber: true,
            companyName: true,
            flag: true,
            shipType: true,
            priorityLevel: true,
            createdAt: true
          }
        },
        drydockBooking: {
          select: {
            id: true,
            status: true,
            bookingDate: true
          }
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            contactNumber: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform the data to match the expected format
    const transformedRequests = authorityRequests.map(request => ({
      id: request.id,
      status: request.status,
      requestDate: request.requestDate,
      finalScopeOfWorkUrl: request.finalScopeOfWorkUrl,
      authorityCertificate: request.authorityCertificate || null,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      drydockRequestId: request.drydockRequest.id,
      requestStatus: request.drydockRequest.status,
      vesselName: request.drydockRequest.vesselName,
      imoNumber: request.drydockRequest.imoNumber,
      companyName: request.drydockRequest.companyName,
      flag: request.drydockRequest.flag,
      shipType: request.drydockRequest.shipType,
      priorityLevel: request.drydockRequest.priorityLevel,
      requestCreatedAt: request.drydockRequest.createdAt,
      drydockBookingId: request.drydockBooking.id,
      bookingStatus: request.drydockBooking.status,
      bookingDate: request.drydockBooking.bookingDate,
      userId: request.user.id,
      fullName: request.user.fullName,
      email: request.user.email,
      contactNumber: request.user.contactNumber
    }))

    return NextResponse.json({
      authorityRequests: transformedRequests
    })

  } catch (error) {
    console.error('Error fetching authority requests for Marina:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { requestId, status, generateCertificate } = body

    if (!requestId || !status) {
      return NextResponse.json(
        { error: 'Request ID and status are required' },
        { status: 400 }
      )
    }

    // Get the authority request with related data
    const authorityRequest = await prisma.drydockAuthorityRequest.findUnique({
      where: { id: requestId },
      include: {
        drydockRequest: {
          select: {
            vesselName: true,
            imoNumber: true,
            companyName: true,
            shipType: true,
            flag: true
          }
        },
        user: {
          select: {
            fullName: true,
            email: true,
            contactNumber: true
          }
        }
      }
    })

    if (!authorityRequest) {
      return NextResponse.json(
        { error: 'Authority request not found' },
        { status: 404 }
      )
    }

    let certificateUrl = null

    // Generate certificate if requested and status is APPROVED
    if (generateCertificate && status === 'APPROVED') {
      try {
        // Generate certificate data
        const certificateData = {
          vesselName: authorityRequest.drydockRequest.vesselName,
          imoNumber: authorityRequest.drydockRequest.imoNumber,
          companyName: authorityRequest.drydockRequest.companyName,
          shipType: authorityRequest.drydockRequest.shipType,
          flag: authorityRequest.drydockRequest.flag,
          requestDate: authorityRequest.requestDate,
          approvedDate: new Date(),
          certificateNumber: `AUTH-${Date.now()}`,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        }

        console.log('Generating certificate for authority request:', requestId)
        
        // Call the certificate generation API
        // Use absolute URL for server-side fetch
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
        
        const certificateResponse = await fetch(`${baseUrl}/api/generate-authority-certificate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            authorityRequestId: requestId,
            certificateData: certificateData
          })
        })

        if (certificateResponse.ok) {
          const certificateResult = await certificateResponse.json()
          certificateUrl = certificateResult.certificateUrl
          console.log('Certificate generated successfully, URL:', certificateUrl)
        } else {
          const errorText = await certificateResponse.text().catch(() => 'Unknown error')
          console.error('Failed to generate certificate:', certificateResponse.status, errorText)
          throw new Error(`Certificate generation failed: ${errorText}`)
        }
      } catch (error) {
        console.error('Error generating certificate:', error)
        // Don't throw - allow status update even if certificate generation fails
        // The user can retry certificate generation later
      }
    }

    // Update authority request status using Prisma
    console.log('Updating database with status:', status, 'and certificate URL:', certificateUrl)
    const updateData: {
      status: 'APPROVED';
      updatedAt: Date;
      authorityCertificate?: string;
    } = {
      status: 'APPROVED',
      updatedAt: new Date()
    }
    
    // Only add certificate URL if it was generated successfully
    if (certificateUrl) {
      updateData.authorityCertificate = certificateUrl
      console.log('Adding certificate URL to database update:', certificateUrl)
    } else {
      console.warn('No certificate URL to save - certificate generation may have failed')
    }
    
    const updatedRequest = await prisma.drydockAuthorityRequest.update({
      where: {
        id: requestId
      },
      data: updateData,
      include: {
        drydockRequest: {
          select: {
            vesselName: true,
            imoNumber: true
          }
        },
        user: {
          select: {
            fullName: true,
            email: true
          }
        }
      }
    })
    
    console.log('Database updated successfully. Certificate URL saved:', updatedRequest.authorityCertificate)

    return NextResponse.json({
      success: true,
      authorityRequest: updatedRequest
    })

  } catch (error) {
    console.error('Error updating authority request status:', error)
    return NextResponse.json(
      { error: 'Failed to update authority request status' },
      { status: 500 }
    )
  }
}
