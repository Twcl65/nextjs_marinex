import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { bookingId, arrivalDate, departureDate } = body as {
      bookingId?: string
      arrivalDate?: string
      departureDate?: string
    }

    if (!bookingId) {
      return NextResponse.json(
        { error: 'bookingId is required' },
        { status: 400 }
      )
    }

    let arrival: Date | null = null
    let departure: Date | null = null

    if (arrivalDate) {
      const d = new Date(arrivalDate)
      if (!isNaN(d.getTime())) {
        arrival = d
      }
    }

    if (departureDate) {
      const d = new Date(departureDate)
      if (!isNaN(d.getTime())) {
        departure = d
      }
    }

    const updated = await prisma.drydockBooking.update({
      where: { id: bookingId },
      data: {
        arrivalDate: arrival,
        departureDate: departure,
      },
    })

    return NextResponse.json({
      success: true,
      booking: updated,
    })
  } catch (error) {
    console.error('Error updating booking dates:', error)
    return NextResponse.json(
      { error: 'Failed to update booking dates' },
      { status: 500 }
    )
  }
}

