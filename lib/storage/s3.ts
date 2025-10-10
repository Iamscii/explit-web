import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import type { ObjectCannedACL } from "@aws-sdk/client-s3"

let client: S3Client | null = null

export function getS3Client(): S3Client {
  if (client) {
    return client
  }

  const region = process.env.AWS_REGION
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("AWS credentials are not configured")
  }

  client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

  return client
}

export function getS3Bucket(): string {
  const bucketName = process.env.AWS_BUCKET_NAME

  if (!bucketName) {
    throw new Error("AWS_BUCKET_NAME is not configured")
  }

  return bucketName
}

interface UploadOptions {
  key: string
  body: Buffer | Uint8Array | string
  contentType?: string
  cacheControl?: string
  acl?: ObjectCannedACL
}

export async function uploadToS3(options: UploadOptions) {
  const bucket = getS3Bucket()
  const s3Client = getS3Client()

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: options.key,
    Body: options.body,
    ContentType: options.contentType,
    CacheControl: options.cacheControl,
    ACL: options.acl,
  })

  await s3Client.send(command)

  return {
    bucket,
    key: options.key,
    url: `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${options.key}`,
  }
}
