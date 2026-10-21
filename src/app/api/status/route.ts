import { NextResponse } from "next/server";
import { maintenancePayload } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

/**
 * The door check.
 *
 * The boot sequence, the in-game poll and the maintenance screen all read this
 * one endpoint, so "is the game open" has exactly one answer. Always uncached:
 * a cached maintenance flag is a sign that stays up after the doors reopen, or
 * worse, the other way around.
 */
export async function GET() {
  return NextResponse.json(maintenancePayload(), { headers: { "Cache-Control": "no-store, max-age=0" } });
}
