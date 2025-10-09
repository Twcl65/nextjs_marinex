'use client'

import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Image from 'next/image'
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

  // Fetch signed URL for S3 images
  React.useEffect(() => {
    if (user?.logoUrl) {
      console.log('ProfileDropdown - Processing logoUrl:', user.logoUrl)
      setImageError(false) // Reset error state when URL changes
      
      if (user.logoUrl.includes('s3.ap-southeast-2.amazonaws.com')) {
        console.log('ProfileDropdown - Fetching signed URL for S3 image')
        fetch(`/api/signed-url?url=${encodeURIComponent(user.logoUrl)}`)
          .then(res => res.json())
          .then(data => {
            console.log('ProfileDropdown - Signed URL response:', data)
            if (data.signedUrl) {
              setSignedLogoUrl(data.signedUrl)
              console.log('ProfileDropdown - Set signed URL:', data.signedUrl)
            }
          })
          .catch(err => {
            console.error('Error fetching signed URL:', err)
            // Fallback to original URL if signed URL fails
            setSignedLogoUrl(user.logoUrl || null)
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
          className="relative h-8 w-auto px-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
        >
          <div className="flex items-center space-x-2">
            {signedLogoUrl && !imageError ? (
              <Image 
                src={signedLogoUrl} 
                alt={getUserDisplayName()} 
                width={24}
                height={24}
                className="h-6 w-6 rounded-full object-cover border border-gray-200"
                onLoad={() => {
                  console.log('ProfileDropdown - Logo loaded successfully!')
                }}
                onError={() => {
                  console.error('ProfileDropdown - Logo failed to load:', signedLogoUrl)
                  setImageError(true)
                }}
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium border border-gray-200">
                {getInitials(getUserDisplayName())}
              </div>
            )}
            <MoreVertical className="h-4 w-4 text-gray-500" />
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
