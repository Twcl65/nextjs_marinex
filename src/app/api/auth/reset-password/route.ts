import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

interface DecodedToken {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json(
        { message: 'Token and password are required.' },
        { status: 400 }
      );
    }

    let decodedToken: DecodedToken;
    try {
      decodedToken = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as DecodedToken;
    } catch (error) {
      return NextResponse.json(
        { message: 'Invalid or expired token.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: decodedToken.userId,
      },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found.' }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash,
      },
    });

    return NextResponse.json({
      message: 'Password has been reset successfully.',
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: 'Something went wrong.' },
      { status: 500 }
    );
  }
}