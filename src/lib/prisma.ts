import { PrismaClient } from '@prisma/client'
// Updated Prisma client with User and UserService models

declare global {
  var prisma: PrismaClient | undefined
}

export const prisma = global.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prisma = prisma


