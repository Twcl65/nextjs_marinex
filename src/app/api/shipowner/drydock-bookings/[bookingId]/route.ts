import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DELETE method to cancel a booking
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      )
    }

    // Check if booking exists and get its current status
    const existingBooking = await prisma.$queryRaw`
      SELECT id, status FROM drydock_bookings 
      WHERE id = ${bookingId}
      LIMIT 1
    `

    if (!Array.isArray(existingBooking) || existingBooking.length === 0) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    const booking = existingBooking[0] as { id: string; status: string }

    // Check if booking can be cancelled (not completed or already cancelled)
    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot cancel a completed or already cancelled booking' },
        { status: 400 }
      )
    }

    // Update booking status to CANCELLED
    await prisma.$executeRaw`
      UPDATE drydock_bookings 
      SET status = 'CANCELLED', updatedAt = NOW()
      WHERE id = ${bookingId}
    `

    console.log('Drydock booking cancelled:', bookingId)

    return NextResponse.json({
      success: true,
      message: 'Booking cancelled successfully'
    })

  } catch (error) {
    console.error('Error cancelling drydock booking:', error)
    return NextResponse.json(
      { error: 'Failed to cancel booking' },
      { status: 500 }
    )
  }
}
