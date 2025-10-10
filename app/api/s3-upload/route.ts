import { randomUUID } from "node:crypto"

import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { NextResponse } from "next/server"

import { getS3Bucket, getS3Client } from "@/lib/storage/s3"

export async function POST(request: Request) {
  try {
    const bucketName = getS3Bucket()
    const s3Client = getS3Client()
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
