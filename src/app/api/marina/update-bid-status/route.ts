import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { bidderId, status } = await req.json()

    if (!bidderId || !status) {
      return NextResponse.json({ error: 'Bidder ID and status are required' }, { status: 400 })
    }

    console.log('Updating bid status:', { bidderId, status })

    // Get the bid with drydock request information before updating
    const bid = await prisma.drydockBid.findUnique({
      where: { id: bidderId },
      include: {
        drydockRequest: {
          include: {
            vessel: true,
            user: true
          }
        }
      }
    })

    if (!bid) {
      return NextResponse.json({ error: 'Bid not found' }, { status: 404 })
    }

    // Update the bid status in the database using Prisma's update method
    const updatedBid = await prisma.drydockBid.update({
      where: {
        id: bidderId
      },
      data: {
        status: status as 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'RECOMMENDED'
      }
    })

    console.log('Bid status updated successfully:', updatedBid)

    // Create notifications if status is RECOMMENDED
    if (status === 'RECOMMENDED' && bid.drydockRequest) {
      try {
        const drydockRequest = bid.drydockRequest
        const vessel = drydockRequest.vessel
        const shipowner = drydockRequest.user
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
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Bid status updated successfully',
      updatedBid 
    }, { status: 200 })
  } catch (error) {
    console.error('Error updating bid status:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { 
        error: 'Failed to update bid status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
