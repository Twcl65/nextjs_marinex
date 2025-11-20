import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { nanoid } from 'nanoid'

const region = process.env.AWS_REGION as string
const bucket = process.env.AWS_S3_BUCKET as string

const s3 = new S3Client({ 
  region, 
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  }
})

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const prefix = formData.get('prefix') as string || 'uploads'
    
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }
    
    if (!region || !bucket) {
      return NextResponse.json({ error: 'S3 not configured' }, { status: 500 })
    }

    // Extract file extension from file name
    const fileName = file.name
    const parts = fileName.split('.')
    const fileExtension = parts.length > 1 ? '.' + parts[parts.length - 1] : ''
    
    // Generate unique key
    const key = `${prefix}/${Date.now()}-${nanoid(8)}${fileExtension}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to S3
    // Try with ACL first, fallback if ACLs are disabled
    let uploadSuccess = false
    let uploadError: Error | null = null
    
    try {
      const cmd = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
        ACL: 'public-read', // Try to make it public
      })
      await s3.send(cmd)
      uploadSuccess = true
      console.log('[Upload] File uploaded with public-read ACL')
    } catch (aclError: unknown) {
      console.warn('[Upload] ACL upload failed, trying without ACL:', aclError)
      uploadError = aclError instanceof Error ? aclError : new Error('ACL upload failed')
      
      // Retry without ACL (bucket policy might handle public access)
      try {
        const cmd = new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: file.type || 'application/octet-stream',
          // No ACL - rely on bucket policy
        })
        await s3.send(cmd)
        uploadSuccess = true
        console.log('[Upload] File uploaded without ACL (using bucket policy)')
      } catch (noAclError: unknown) {
        throw noAclError instanceof Error ? noAclError : new Error('Upload failed')
      }
    }
    
    if (!uploadSuccess) {
      throw uploadError || new Error('Upload failed')
    }
    
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`
    
    return NextResponse.json({ 
      success: true,
      url: publicUrl,
      key 
    })
  } catch (e: unknown) {
    console.error('Upload error', e)
    return NextResponse.json({ 
      error: e instanceof Error ? e.message : 'Failed to upload' 
    }, { status: 500 })
  }
}

