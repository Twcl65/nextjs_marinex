import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Fetch all bids for this user
    const bids = await prisma.$queryRaw`
      SELECT drydockRequestId 
      FROM drydock_bids 
      WHERE shipyardUserId = ${userId}
    `

    // Create a map of drydock request IDs that have bids
    const bidStatuses: { [key: string]: boolean } = {}
    
    if (Array.isArray(bids)) {
      bids.forEach((bid: { drydockRequestId: string }) => {
        bidStatuses[bid.drydockRequestId] = true
      })
    }

    return NextResponse.json({ bidStatuses }, { status: 200 })
  } catch (error) {
    console.error('Error fetching bid statuses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bid statuses' },
      { status: 500 }
    )
  }
}
