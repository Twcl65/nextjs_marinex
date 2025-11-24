import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const bucket = process.env.AWS_S3_BUCKET

export interface UploadFileOptions {
  file: File | Buffer
  folder?: string
  prefix?: string
  fileName?: string
  contentType?: string
}

export async function uploadFileToS3(options: UploadFileOptions): Promise<string | null> {
  const { file, folder, prefix, fileName: customFileName, contentType: customContentType } = options

  if (!bucket) {
    console.error('AWS_S3_BUCKET environment variable is not set')
    return null
  }

  // Convert file to buffer if it's a File
  let buffer: Buffer
  let originalFileName: string
  let fileType: string

  if (file instanceof File) {
    buffer = Buffer.from(await file.arrayBuffer())
    originalFileName = file.name
    fileType = file.type
  } else {
    buffer = file
    originalFileName = customFileName || 'file'
    fileType = customContentType || 'application/octet-stream'
  }

  // Generate file name
  const fileExtension = originalFileName.split('.').pop() || 'bin'
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 15)
  const fileName = customFileName || (folder
    ? `${folder}/${prefix || 'file'}-${timestamp}-${randomString}.${fileExtension}`
    : `${prefix || 'file'}-${timestamp}-${randomString}.${fileExtension}`)

  // Determine content type
  let contentType = customContentType || fileType || 'application/octet-stream'
  if (!contentType || contentType === 'application/octet-stream') {
    if (fileExtension === 'pdf') contentType = 'application/pdf'
    else if (fileExtension === 'doc') contentType = 'application/msword'
    else if (fileExtension === 'docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    else if (fileExtension === 'jpg' || fileExtension === 'jpeg') contentType = 'image/jpeg'
    else if (fileExtension === 'png') contentType = 'image/png'
  }

  // Try with ACL first, fallback if ACLs are disabled
  try {
    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
    })
    await s3Client.send(cmd)
    console.log(`[S3 Upload] File uploaded with public-read ACL: ${fileName}`)
  } catch (aclError: unknown) {
    console.warn(`[S3 Upload] ACL upload failed, trying without ACL:`, aclError)
    
    // Retry without ACL (bucket policy might handle public access)
    try {
      const cmd = new PutObjectCommand({
        Bucket: bucket,
        Key: fileName,
        Body: buffer,
        ContentType: contentType,
        // No ACL - rely on bucket policy
      })
      await s3Client.send(cmd)
      console.log(`[S3 Upload] File uploaded without ACL (using bucket policy): ${fileName}`)
    } catch (noAclError: unknown) {
      console.error(`[S3 Upload] Failed to upload file:`, noAclError)
      return null
    }
  }

  return `https://${bucket}.s3.${process.env.AWS_REGION || 'ap-southeast-2'}.amazonaws.com/${fileName}`
}

