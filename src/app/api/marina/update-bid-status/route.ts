import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { bidderId, status } = await req.json()

    if (!bidderId || !status) {
      return NextResponse.json({ error: 'Bidder ID and status are required' }, { status: 400 })
    }

    console.log('Updating bid status:', { bidderId, status })

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
