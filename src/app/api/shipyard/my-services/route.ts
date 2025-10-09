import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    // Get userId from query params
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Fetch user services from user_services table
    const services = await prisma.userService.findMany({
      where: {
        userId: userId
      },
      select: {
        id: true,
        name: true,
        squareMeters: true,
        hours: true,
        workers: true,
        days: true,
        price: true
      }
    })

    console.log(`Found ${services.length} services for user ${userId}`)
    console.log('Services:', services)

    // Transform the data to match expected format
    const transformedServices = services.map((service) => ({
      service_name: service.name,
      square_meters: service.squareMeters,
      hours: service.hours,
      workers: service.workers,
      days: service.days,
      price: service.price
    }))

    return NextResponse.json({ services: transformedServices }, { status: 200 })
  } catch (error) {
    console.error('Error fetching user services:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user services' },
      { status: 500 }
    )
  }
}
