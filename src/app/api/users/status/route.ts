import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest) {
  try {
    const { id, status, rejectionReason } = await req.json()
    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status },
    })

    // Send email notification
    if (status === 'ACTIVE' || status === 'REJECTED' || status === 'SUSPENDED') {
      let emailType = ''
      let subject = ''
      
      if (status === 'ACTIVE') {
        if (user.status === 'SUSPENDED') {
          emailType = 'ACCOUNT_REACTIVATED'
          subject = 'Your Marinex Account has been Reactivated'
        } else {
          emailType = 'REGISTRATION_APPROVED'
          subject = 'Your Marinex Account has been Approved'
        }
      } else if (status === 'REJECTED') {
        emailType = 'REGISTRATION_REJECTED'
        subject = 'Action Required: Your Marinex Account Application'
      } else if (status === 'SUSPENDED') {
        emailType = 'ACCOUNT_SUSPENDED'
        subject = 'Your Marinex Account has been Suspended'
      }

      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: updatedUser.email,
          subject,
          message: rejectionReason || `Your account has been ${status.toLowerCase()}.`,
          emailType,
          userName: updatedUser.fullName || updatedUser.shipyardName || updatedUser.email,
          userType: updatedUser.role,
        }),
      });
    }

    return NextResponse.json({ user: updatedUser })
  } catch (e: unknown) {
    console.error('Update user status error', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
