import { NextResponse } from "next/server"

import type { SyncRequestPayload, SyncResponsePayload } from "@/lib/sync/types"

const emptyResponse = (payload: SyncRequestPayload): SyncResponsePayload => ({
  appliedOperationIds: payload.operations.map((operation) => operation.id),
  collections: {
    cards: [],
    progresses: [],
    decks: [],
    templates: [],
    styles: [],
  },
  cursors: payload.cursors,
  deviceId: payload.deviceId,
  timestamp: new Date().toISOString(),
})

export async function POST(request: Request) {
  const payload = (await request.json()) as SyncRequestPayload

  // TODO: replace with real sync logic against MongoDB once API contracts are finalized.
  const response = emptyResponse(payload)

  return NextResponse.json(response)
}
