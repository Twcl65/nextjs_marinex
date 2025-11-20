import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key')

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
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
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Check if account is active
    if (user.status !== 'ACTIVE') {
      let errorMessage = 'Account is not active. Please contact administrator.'
      
      if (user.status === 'SUSPENDED') {
        errorMessage = 'Your account has been suspended. Please contact Marine Industry Authority (MARINA) for assistance.'
      } else if (user.status === 'REJECTED') {
        errorMessage = 'Your account application was rejected. Please contact Marine Industry Authority (MARINA) for more information.'
      } else if (user.status === 'INACTIVE') {
        errorMessage = 'Your account is pending approval. Please wait for Marine Industry Authority (MARINA) for approval.'
      }
      
      return NextResponse.json({ 
        error: errorMessage 
      }, { status: 403 })
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Create JWT token
    const token = await new SignJWT({ 
      userId: user.id, 
      email: user.email, 
      role: user.role 
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(JWT_SECRET)

    // Return user data without password hash
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...userWithoutPassword } = user

    return NextResponse.json({
      user: userWithoutPassword,
      token
    }, { status: 200 })

  } catch (error) {
    console.error('Login error:', error)
    
    // Provide more specific error messages
    if (error instanceof Error) {
      const errorMessage = error.message
      const errorName = error.name
      
      // Log detailed error for debugging in Vercel
      console.error('Error details:', {
        name: errorName,
        message: errorMessage,
        stack: error.stack,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 20) + '...',
      })
      
      // Check if it's a Prisma initialization error
      if (errorName === 'PrismaClientInitializationError' || errorMessage.includes('PrismaClient') || errorMessage.includes('P1001')) {
        console.error('Prisma client initialization failed. Check DATABASE_URL environment variable.')
        return NextResponse.json({ 
          error: 'Database connection error. Please try again later.',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        }, { status: 500 })
      }
      
      // Check if it's a database connection error
      if (errorMessage.includes('Can\'t reach database server') || 
          errorMessage.includes('P1001') ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('ETIMEDOUT') ||
          errorMessage.includes('ENOTFOUND')) {
        return NextResponse.json({ 
          error: 'Database server is unreachable. Please check your database configuration.',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        }, { status: 500 })
      }
      
      // Check for SSL/TLS errors
      if (errorMessage.includes('SSL') || errorMessage.includes('TLS') || errorMessage.includes('certificate')) {
        return NextResponse.json({ 
          error: 'Database SSL connection error. Please check your DATABASE_URL includes SSL parameters.',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        }, { status: 500 })
      }
    }
    
    return NextResponse.json({ 
      error: 'Internal Server Error',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
    }, { status: 500 })
  }
}
