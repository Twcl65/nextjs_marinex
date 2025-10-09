'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: string[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        // User not logged in, redirect to login
        router.push('/auth/login')
        return
      }

      if (allowedRoles && !allowedRoles.includes(user.role)) {
        // User doesn't have required role, redirect to appropriate page
        const redirectPath = getRedirectPath(user.role)
        router.push(redirectPath)
        return
      }
    }
  }, [user, isLoading, router, allowedRoles])

  const getRedirectPath = (role: string) => {
    switch (role) {
      case 'SHIPOWNER':
        return '/pages/shipowner'
      case 'SHIPYARD':
        return '/pages/shipyard'
      case 'MARINA':
        return '/pages/marina'
      default:
        return '/auth/login'
    }
  }

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#134686] mx-auto"></div>
          <p className="mt-2 text-[#134686]">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render children if user is not authenticated or doesn't have required role
  if (!user || (allowedRoles && !allowedRoles.includes(user.role))) {
    return null
  }

  return <>{children}</>
}
