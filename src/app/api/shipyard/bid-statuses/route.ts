import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Fetch all bids for this user with their status using Prisma
    const bids = await prisma.drydockBid.findMany({
      where: {
        shipyardUserId: userId
      },
      select: {
        id: true,
        drydockRequestId: true,
        status: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    // Create a map of drydock request IDs that have bids and their status
    const bidStatuses: { [key: string]: boolean } = {}
    const bidRecommendations: { [key: string]: boolean } = {}
    
    bids.forEach((bid) => {
      // Ensure requestId is a string for consistent mapping
      const requestId = String(bid.drydockRequestId)
      bidStatuses[requestId] = true
      
      // Check if status is RECOMMENDED (handle both enum and string)
      const statusValue = String(bid.status).toUpperCase()
      const isRecommended = statusValue === 'RECOMMENDED'
      
      // If we haven't set this requestId yet, or if this bid is recommended, update it
      // This handles the case where there might be multiple bids, we want to show recommended if any are recommended
      if (!(requestId in bidRecommendations) || isRecommended) {
        bidRecommendations[requestId] = isRecommended
      }
    })

    console.log('Bid statuses fetched for user:', userId, { 
      totalBids: bids.length,
      bids: bids.map(b => ({ 
        id: b.id, 
        drydockRequestId: b.drydockRequestId, 
        status: b.status,
        statusType: typeof b.status
      })),
      bidStatuses, 
      bidRecommendations 
    })

    return NextResponse.json({ bidStatuses, bidRecommendations }, { status: 200 })
  } catch (error) {
    console.error('Error fetching bid statuses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bid statuses' },
      { status: 500 }
    )
  }
}
