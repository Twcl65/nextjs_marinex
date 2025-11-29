import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, name, squareMeters, hours, workers, days, price } = body

    if (!userId || !name || !squareMeters || !hours || !workers || !days || !price) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Create new service
    const newService = await prisma.userService.create({
      data: {
        userId,
        name,
        squareMeters: parseInt(squareMeters),
        hours: parseInt(hours),
        workers: parseInt(workers),
        days: parseInt(days),
        price: String(price),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Service added successfully',
      service: newService
    })

  } catch (error) {
    console.error('Error adding service:', error)
    return NextResponse.json(
      { error: 'Failed to add service' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim()
    const isLookup = searchParams.get('mode') === 'lookup'

    console.log('Fetching services from user_services table', search ? `with search: ${search}` : '')

    const services = await prisma.userService.findMany({
      where: search
        ? {
            name: {
              contains: search,
            }
          }
        : undefined,
      select: {
        id: true,
        userId: true,
        name: true,
        squareMeters: true,
        hours: true,
        workers: true,
        days: true,
        price: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            shipyardName: true,
            fullName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: isLookup ? undefined : 20
    })

    console.log('Found services:', services.length)

    return NextResponse.json({ services })
  } catch (error) {
    console.error('Error fetching services:', error)
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    )
  }
}
