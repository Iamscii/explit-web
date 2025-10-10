import { randomUUID } from "node:crypto"

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { NextResponse } from "next/server"

const region = process.env.AWS_REGION ?? ""
const bucketName = process.env.AWS_BUCKET_NAME ?? ""
const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? ""
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? ""

const s3Client = new S3Client({
  region,
  credentials:
    accessKeyId && secretAccessKey
      ? {
          accessKeyId,
          secretAccessKey,
        }
      : undefined,
})

export async function POST(request: Request) {
  if (!bucketName || !region || !accessKeyId || !secretAccessKey) {
    return NextResponse.json(
      { error: "AWS credentials are not configured correctly" },
      { status: 500 },
    )
  }

  try {
    const { fileName, fileType }: { fileName: string; fileType: string } = await request.json()
    const objectKey = `uploads/${randomUUID()}-${fileName}`

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      ContentType: fileType,
    })

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 60,
    })

    return NextResponse.json({
      uploadUrl: signedUrl,
      key: objectKey,
    })
  } catch (error) {
    console.error("[S3_UPLOAD_ERROR]", error)
    return NextResponse.json(
      {
        error: "Failed to generate upload URL",
      },
      { status: 500 },
    )
  }
}
