import { db } from "@/db";
import { maintenanceEnabled } from "@/lib/maintenance";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  if (maintenanceEnabled()) {
    return Response.json({ ok: false, maintenance: true }, { status: 503 });
  }
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
