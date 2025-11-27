import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logUserActivity, ActivityType } from '@/lib/activity-logger'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key')

async function getAuthenticatedUser(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as { userId: string; email: string; role: string }
  } catch (error) {
    return null
  }
}

async function getMarinaUserId(request: NextRequest): Promise<string | null> {
  const authUser = await getAuthenticatedUser(request)
  if (authUser && authUser.role === 'MARINA') {
    return authUser.userId
  }
  
  // Fallback: get first marina user
  const marinaUser = await prisma.user.findFirst({
    where: { role: 'MARINA' },
    select: { id: true }
  })
  return marinaUser?.id || null
}

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

    // Log activity for marina user when suspending
    if (status === 'SUSPENDED') {
      const marinaUserId = await getMarinaUserId(request)
      if (marinaUserId) {
        const userName = updatedUser.fullName || updatedUser.shipyardName || updatedUser.email || 'User'
        await logUserActivity(
          marinaUserId,
          ActivityType.USER_SUSPENDED,
          `User ${userName} has been suspended`,
          'UserX',
          {
            suspendedUserId: userId,
            suspendedUserName: userName,
            userRole: updatedUser.role
          }
        )
      }
    }

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
