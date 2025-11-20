import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Received request body:', body)
    
    const { drydockBidId, drydockBookingId, serviceName, startDate, endDate, progress = 0 } = body

    // Validate required fields
    if (!drydockBidId || !drydockBookingId || !serviceName || !startDate || !endDate) {
      console.log('Missing required fields:', { drydockBidId, drydockBookingId, serviceName, startDate, endDate })
      return NextResponse.json(
        { error: 'Missing required fields: drydockBidId, drydockBookingId, serviceName, startDate, endDate' },
        { status: 400 }
      )
    }

    console.log('Creating drydock service with data:', {
      drydockBidId,
      drydockBookingId,
      serviceName,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      progress: parseInt(progress.toString())
    })

    // Create the drydock service record with serviceName
    const drydockService = await prisma.drydockService.create({
      data: {
        drydockBidId,
        drydockBookingId,
        serviceName,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        progress: parseInt(progress.toString())
      }
    })

    console.log('Successfully created drydock service:', drydockService)

    return NextResponse.json({
      success: true,
      data: drydockService,
      message: 'Drydock service schedule saved successfully'
    })

  } catch (error) {
    console.error('Error creating drydock service:', error)
    return NextResponse.json(
      { 
        error: 'Failed to save drydock service schedule',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const drydockBookingId = searchParams.get('drydockBookingId')

    if (!drydockBookingId) {
      return NextResponse.json(
        { error: 'drydockBookingId is required' },
        { status: 400 }
      )
    }

    const drydockServices = await prisma.drydockService.findMany({
      where: {
        drydockBookingId
      },
      include: {
        drydockBid: true,
        drydockBooking: true
      }
    })

    return NextResponse.json({
      success: true,
      data: drydockServices
    })

  } catch (error) {
    console.error('Error fetching drydock services:', error)
    return NextResponse.json(
      { error: 'Failed to fetch drydock services' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, progress, startDate, endDate } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Service ID is required' },
        { status: 400 }
      )
    }

    const updateData: {
      progress?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
    if (progress !== undefined) updateData.progress = parseInt(progress.toString())
    if (startDate) updateData.startDate = new Date(startDate)
    if (endDate) updateData.endDate = new Date(endDate)

    const drydockService = await prisma.drydockService.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      data: drydockService,
      message: 'Drydock service updated successfully'
    })

  } catch (error) {
    console.error('Error updating drydock service:', error)
    return NextResponse.json(
      { error: 'Failed to update drydock service' },
      { status: 500 }
    )
  }
}
