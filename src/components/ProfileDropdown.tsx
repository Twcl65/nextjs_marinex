'use client'

import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, User, LogOut } from 'lucide-react'

export function ProfileDropdown() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [signedLogoUrl, setSignedLogoUrl] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)
  const [loadingSignedUrl, setLoadingSignedUrl] = useState(false)

  // Fetch signed URL for S3 images (since objects are not public)
  React.useEffect(() => {
    if (user?.logoUrl && user.logoUrl !== 'null' && user.logoUrl.trim() !== '') {
      console.log('ProfileDropdown - Processing logoUrl:', user.logoUrl)
      setImageError(false) // Reset error state when URL changes
      
      // Check if it's an S3 URL (with or without region)
      if (user.logoUrl.includes('s3') && user.logoUrl.includes('amazonaws.com')) {
        // Fetch signed URL for S3 images since they're not public
        console.log('ProfileDropdown - Fetching signed URL for S3 image')
        setLoadingSignedUrl(true)
        fetch(`/api/signed-url?url=${encodeURIComponent(user.logoUrl)}`)
          .then(async res => {
            const data = await res.json()
            if (!res.ok) {
              console.error('ProfileDropdown - Signed URL API error response:', res.status, data)
              throw new Error(data.error || `HTTP error! status: ${res.status}`)
            }
            return data
          })
          .then(data => {
            console.log('ProfileDropdown - Signed URL response:', data)
            console.log('ProfileDropdown - Response keys:', Object.keys(data))
            if (data.signedUrl) {
              console.log('ProfileDropdown - Received signedUrl, length:', data.signedUrl.length)
              console.log('ProfileDropdown - SignedUrl preview:', data.signedUrl.substring(0, 150))
              // Verify it's actually a signed URL (should have query parameters)
              if (data.signedUrl.includes('?X-Amz-')) {
                console.log('ProfileDropdown - Valid signed URL detected (has query params)')
                setSignedLogoUrl(data.signedUrl)
                console.log('ProfileDropdown - Set signed URL successfully')
              } else {
                console.error('ProfileDropdown - WARNING: Response is NOT a signed URL (no query params)!')
                console.error('ProfileDropdown - This means the API returned the original URL instead of signing it')
                console.error('ProfileDropdown - Check server logs for signed-url API errors')
                // Still try to use it, but it will likely fail
                setSignedLogoUrl(data.signedUrl)
              }
            } else if (data.error) {
              console.error('ProfileDropdown - Signed URL API error:', data.error)
              // Don't set URL if signed URL generation fails - show initials instead
              setSignedLogoUrl(null)
            } else {
              // No signedUrl in response
              console.warn('ProfileDropdown - No signedUrl in response:', data)
              setSignedLogoUrl(null)
            }
          })
          .catch(err => {
            console.error('ProfileDropdown - Error fetching signed URL:', err)
            console.error('ProfileDropdown - Error details:', err.message, err.stack)
            // Don't fallback to direct URL - show initials instead
            setSignedLogoUrl(null)
          })
          .finally(() => {
            setLoadingSignedUrl(false)
          })
      } else {
        // For non-S3 URLs, use directly
        console.log('ProfileDropdown - Using direct URL:', user.logoUrl)
        setSignedLogoUrl(user.logoUrl || null)
      }
    } else {
      console.log('ProfileDropdown - No logoUrl found')
      setSignedLogoUrl(null)
      setImageError(false)
    }
  }, [user?.logoUrl])

  if (!user) return null

  // Debug: Log user data to see what's available
  console.log('ProfileDropdown - User logoUrl:', user.logoUrl)
  console.log('ProfileDropdown - Signed URL:', signedLogoUrl)

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getUserDisplayName = () => {
    if (user.fullName) return user.fullName
    if (user.shipyardName) return user.shipyardName
    return user.email
  }

  const handleProfile = () => {
    router.push('/pages/profile')
    setIsOpen(false)
  }

  const handleLogout = () => {
    logout()
    setIsOpen(false)
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-8 w-auto px-2 hover:bg-blue-800 focus:bg-[#134686] focus:outline-none"
        >
          <div className="flex items-center space-x-2">
            {signedLogoUrl && !imageError && !loadingSignedUrl ? (
              // Use regular img tag for signed URLs since they have query parameters
              <img 
                src={signedLogoUrl} 
                alt={getUserDisplayName()} 
                width={24}
                height={24}
                className="h-6 w-6 rounded-full object-cover border border-gray-200"
                onLoad={() => {
                  console.log('ProfileDropdown - Logo loaded successfully!')
                  console.log('ProfileDropdown - Full signed URL length:', signedLogoUrl.length)
                  setImageError(false)
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  console.error('ProfileDropdown - Logo failed to load')
                  console.error('ProfileDropdown - Original logoUrl:', user.logoUrl)
                  console.error('ProfileDropdown - Signed URL (first 200 chars):', signedLogoUrl?.substring(0, 200))
                  console.error('ProfileDropdown - Signed URL length:', signedLogoUrl?.length)
                  console.error('ProfileDropdown - Image naturalWidth:', target?.naturalWidth, 'naturalHeight:', target?.naturalHeight)
                  
                  // Try to get more error details
                  if (target) {
                    console.error('ProfileDropdown - Image complete:', target.complete)
                    console.error('ProfileDropdown - Image currentSrc:', target.currentSrc)
                  }
                  
                  // Check Network tab for CORS or 403 errors
                  console.error('ProfileDropdown - Check Network tab for the failed image request to see CORS/403 errors')
                  setImageError(true)
                }}
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium border border-gray-200">
                {getInitials(getUserDisplayName())}
              </div>
            )}
            <MoreVertical className="h-4 w-4 text-white" />
          </div>
        </Button>
      </DropdownMenuTrigger>
          <DropdownMenuContent className="w-40 bg-white border border-gray-200 shadow-lg" align="end" forceMount>
            <DropdownMenuItem onClick={handleProfile}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
    </DropdownMenu>
  )
}
