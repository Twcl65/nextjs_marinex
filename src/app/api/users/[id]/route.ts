import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get user profile data with services
    const user = await prisma.user.findUnique({
      where: { id: id },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        fullName: true,
        shipyardName: true,
        contactNumber: true,
        officeAddress: true,
        businessRegNumber: true,
        logoUrl: true,
        certificateBuilder: true,
        certificateRepair: true,
        certificateOther: true,
        shipyardDryDock: true,
        contactPerson: true,
        shipownerVesselInfo: true,
        shipyardServices: true,
        createdAt: true,
        updatedAt: true,
        services: {
          select: {
            id: true,
            name: true,
            squareMeters: true,
            hours: true,
            workers: true,
            days: true,
            price: true,
            createdAt: true,
            updatedAt: true,
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      user: user
    })

  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Update user profile data
    const updatedUser = await prisma.user.update({
      where: { id: id },
      data: {
        fullName: body.fullName,
        shipyardName: body.shipyardName,
        contactNumber: body.contactNumber,
        officeAddress: body.officeAddress,
        businessRegNumber: body.businessRegNumber,
        contactPerson: body.contactPerson,
        shipyardDryDock: body.shipyardDryDock,
        certificateBuilder: body.certificateBuilder,
        certificateRepair: body.certificateRepair,
        certificateOther: body.certificateOther,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    })

  } catch (error) {
    console.error('Error updating user profile:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Delete user from database
    const deletedUser = await prisma.user.delete({
      where: { id: id },
    })

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
      user: deletedUser
    })

  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
