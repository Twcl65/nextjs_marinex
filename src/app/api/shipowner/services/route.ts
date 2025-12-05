import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const services = await prisma.userService.findMany({
      select: {
        name: true,
      },
    });

    const uniqueServiceNames = [...new Set(services.map(service => service.name))];

    return NextResponse.json({ services: uniqueServiceNames });
  } catch (error) {
    console.error('Error fetching unique services:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
