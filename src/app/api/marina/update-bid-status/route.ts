import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BidStatus } from '@prisma/client'
import crypto from 'crypto'
import { logUserActivity, ActivityType } from '@/lib/activity-logger'
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

async function getMarinaUserId(request: NextRequest): Promise<string | null> {
  const authUser = await getAuthenticatedUser(request)
  if (authUser && authUser.role === 'MARINA') {
    return authUser.userId
  }
  
  // Fallback: get first marina user
  const marinaUser = await prisma.user.findFirst({
    where: { role: 'MARINA' },
    select: { id: true }
  })
  return marinaUser?.id || null
}

export async function POST(req: NextRequest) {
  try {
    const { bidderId, status } = await req.json()

    if (!bidderId || !status) {
      return NextResponse.json({ error: 'Bidder ID and status are required' }, { status: 400 })
    }

    console.log('Updating bid status:', { bidderId, status })

    // Validate status value first
    const validStatuses = Object.values(BidStatus)
    const statusValue = status.trim().toUpperCase()
    if (!validStatuses.includes(statusValue as BidStatus)) {
      return NextResponse.json({ error: `Invalid status "${status}". Must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
    }

    // Get the bid with drydock request information using raw SQL to avoid enum validation issues
    const bidResult = await prisma.$queryRaw<Array<{
      id: string;
      drydockRequestId: string;
      shipyardUserId: string;
      shipyardName: string;
      status: string;
    }>>`
      SELECT 
        id,
        drydockRequestId,
        shipyardUserId,
        shipyardName,
        status
      FROM drydock_bids
      WHERE id = ${bidderId}
      LIMIT 1
    `

    if (!bidResult || bidResult.length === 0) {
      return NextResponse.json({ error: 'Bid not found' }, { status: 404 })
    }

    const bid = bidResult[0]

    // Get drydock request information separately
    const drydockRequestResult = await prisma.$queryRaw<Array<{
      id: string;
      userId: string;
      vesselId: string;
      vesselName: string;
    }>>`
      SELECT 
        dr.id,
        dr.userId,
        dr.vesselId,
        dr.vesselName
      FROM drydock_requests dr
      WHERE dr.id = ${bid.drydockRequestId}
      LIMIT 1
    `

    if (!drydockRequestResult || drydockRequestResult.length === 0) {
      return NextResponse.json({ error: 'Drydock request not found' }, { status: 404 })
    }

    const drydockRequest = drydockRequestResult[0]

    // Get vessel information
    const vesselResult = await prisma.$queryRaw<Array<{
      id: string;
      vesselName: string;
    }>>`
      SELECT 
        id,
        vesselName
      FROM ship_vessels
      WHERE id = ${drydockRequest.vesselId}
      LIMIT 1
    `

    const vessel = vesselResult && vesselResult.length > 0 ? vesselResult[0] : null

    // Get user information
    const userResult = await prisma.$queryRaw<Array<{
      id: string;
      fullName: string;
    }>>`
      SELECT 
        id,
        fullName
      FROM users
      WHERE id = ${drydockRequest.userId}
      LIMIT 1
    `

    const shipowner = userResult && userResult.length > 0 ? userResult[0] : null

    // Update the bid status using raw SQL to avoid Prisma trying to access non-existent columns
    try {
      // Use Prisma.sql for proper enum handling
      await prisma.$executeRawUnsafe(
        `UPDATE drydock_bids SET status = ? WHERE id = ?`,
        statusValue,
        bidderId
      )
      console.log('Bid status updated successfully using raw SQL:', { bidderId, status: statusValue })
    } catch (updateError) {
      console.error('Failed to update bid status:', updateError)
      throw new Error(`Database update failed: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`)
    }

    // Fetch the updated bid using raw SQL to avoid enum validation issues
    const updatedBidResult = await prisma.$queryRaw<Array<{
      id: string;
      status: string;
      updatedAt: Date;
    }>>`
      SELECT 
        id,
        status,
        updatedAt
      FROM drydock_bids
      WHERE id = ${bidderId}
      LIMIT 1
    `

    const updatedBid = updatedBidResult && updatedBidResult.length > 0 ? updatedBidResult[0] : null

    // Create notifications if status is RECOMMENDED
    if (statusValue === 'RECOMMENDED' && drydockRequest) {
      try {
        const shipyardName = bid.shipyardName || 'Shipyard'

        // Get shipyard user info for the notification
        const shipyardUser = await prisma.user.findUnique({
          where: { id: bid.shipyardUserId }
        })

        const finalShipyardName = shipyardUser?.shipyardName || shipyardName
        const vesselName = vessel?.vesselName || drydockRequest.vesselName || 'your vessel'
        const companyName = shipowner?.fullName || 'Valued Customer'

        // Create notification for SHIPOWNER
        const shipownerMessage = `Dear **${companyName}**,

We would like to inform you that **${finalShipyardName}** has bid on your vessel, **${vesselName}**.

The shipyard's bid has been reviewed and approved by the Maritime Industry Authority. You can now proceed with the booking process if you wish to proceed with this shipyard.

If you have any questions or need assistance, please feel free to contact us.

Thank you for using our services.

Best regards,
**Maritime Industry Authority**`

        const shipownerNotificationId = crypto.randomUUID()
        
        await prisma.$executeRaw`
          INSERT INTO drydock_mc_notifications (
            id, userId, vesselId, drydockReport, drydockCertificate, 
            safetyCertificate, vesselPlans, title, type, message, 
            isRead, createdAt, updatedAt
          ) VALUES (
            ${shipownerNotificationId}, ${drydockRequest.userId}, ${drydockRequest.vesselId}, 
            0, 0, 0, 0,
            'Shipyard Bid Received', 'Bidding Approval',
            ${shipownerMessage}, 0, NOW(), NOW()
          )
        `

        console.log('Shipowner notification created successfully:', shipownerNotificationId)

        // Create notification for SHIPYARD
        const shipyardMessage = `Dear **${finalShipyardName}**,

We are pleased to inform you that your bid on **${companyName}'s** vessel, **${vesselName}**, has been approved by the Maritime Industry Authority.

Your bid has been reviewed and recommended. The shipowner will be notified and may proceed with the booking process.

If you have any questions or need assistance, please feel free to contact us.

Thank you for your participation.

Best regards,
**Maritime Industry Authority**`

        const shipyardNotificationId = crypto.randomUUID()
        
        await prisma.$executeRaw`
          INSERT INTO drydock_mc_notifications (
            id, userId, vesselId, drydockReport, drydockCertificate, 
            safetyCertificate, vesselPlans, title, type, message, 
            isRead, createdAt, updatedAt
          ) VALUES (
            ${shipyardNotificationId}, ${bid.shipyardUserId}, ${drydockRequest.vesselId}, 
            0, 0, 0, 0,
            'Bid Approved by Marina', 'Bidding Approval',
            ${shipyardMessage}, 0, NOW(), NOW()
          )
        `

        console.log('Shipyard notification created successfully:', shipyardNotificationId)
      } catch (notificationError) {
        // Log error but don't fail the request
        console.error('Error creating notifications:', notificationError)
      }

      // Log activity for marina user
      if (statusValue === 'RECOMMENDED') {
        const marinaUserId = await getMarinaUserId(req)
        if (marinaUserId) {
          const vesselName = vessel?.vesselName || drydockRequest.vesselName || 'vessel'
          const shipyardName = bid.shipyardName || 'Shipyard'
          await logUserActivity(
            marinaUserId,
            ActivityType.SHIPYARD_RECOMMENDED,
            `Shipyard ${shipyardName} recommended for ${vesselName}`,
            'ThumbsUp',
            {
              bidId: bidderId,
              drydockRequestId: bid.drydockRequestId,
              vesselId: drydockRequest.vesselId,
              vesselName: vesselName,
              shipyardName: shipyardName
            }
          )
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Bid status updated successfully',
      bidId: updatedBid?.id,
      status: updatedBid?.status
    }, { status: 200 })
  } catch (error) {
    console.error('Error updating bid status:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { 
        error: errorMessage || 'Failed to update bid status. Please check the server logs for details.',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}
