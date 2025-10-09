import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: NextRequest) {
  try {
    const { userId, status } = await request.json()

    if (!userId || !status) {
      return NextResponse.json(
        { error: 'User ID and status are required' },
        { status: 400 }
      )
    }

    // Update user status in database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { status: status },
    })

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: `User status updated to ${status}`
    })

  } catch (error) {
    console.error('Error updating user status:', error)
    return NextResponse.json(
      { error: 'Failed to update user status' },
      { status: 500 }
    )
  }
}
