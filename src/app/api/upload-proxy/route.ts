import { NextRequest, NextResponse } from 'next/server'
import { uploadFileToS3 } from '@/lib/s3-upload'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folder = formData.get('folder') as string | null
    const prefix = formData.get('prefix') as string | null

    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: 'No file provided or file is empty' },
        { status: 400 }
      )
    }

    // Upload file using shared utility
    const fileUrl = await uploadFileToS3({
      file,
      folder: folder || undefined,
      prefix: prefix || undefined
    })

    if (!fileUrl) {
      return NextResponse.json(
        { error: 'Failed to upload file to S3' },
        { status: 500 }
      )
    }

    // Extract fileName from URL
    const fileName = fileUrl.split('/').pop()?.split('?')[0] || ''

    return NextResponse.json({
      success: true,
      url: fileUrl,
      fileName: fileName
    })

  } catch (error) {
    console.error('Error in upload proxy:', error)
    return NextResponse.json(
      { error: 'Failed to process upload', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

