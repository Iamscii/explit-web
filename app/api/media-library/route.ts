import { promises as fs } from "node:fs"
import { NextResponse } from "next/server"

const LIBRARY_PATH = "config/media-library.json"

export async function GET() {
  try {
    const file = await fs.readFile(LIBRARY_PATH, "utf-8")
    const data = JSON.parse(file)

    if (!Array.isArray(data)) {
      return NextResponse.json({ assets: [] })
    }

    return NextResponse.json({ assets: data })
  } catch (error) {
    console.error("[MEDIA_LIBRARY]", error)
    return NextResponse.json({ assets: [] })
  }
}
