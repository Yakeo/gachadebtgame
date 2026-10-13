import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { saves } from "@/db/schema";
import { createGuest, currentUser, publicPlayer, validateOrigin } from "@/lib/auth";
import { applyGameAction, regenerateEnergy } from "@/lib/game-engine";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ player: null, state: null });
    const [save] = await db.select().from(saves).where(eq(saves.userId, user.id)).limit(1);
    return NextResponse.json({ player: publicPlayer(user), state: save ? regenerateEnergy(save.data) : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { console.error("Load game:", error); return NextResponse.json({ error: "Your save could not be loaded. Please try again." }, { status: 503 }); }
}
export async function POST(request: Request) {
  try {
    validateOrigin(request);
    const input = await request.json() as Record<string, unknown>;
    let user = await currentUser();
    if (!user && input.action === "init") user = await createGuest();
    if (!user) return NextResponse.json({ error: "Your session expired. Please sign in again." }, { status: 401 });
    const userId = user.id;
    const result = await db.transaction(async tx => {
      const [save] = await tx.select().from(saves).where(eq(saves.userId, userId)).for("update");
      if (!save) throw new Error("Your save is missing. Please sign in again.");
      const output = applyGameAction(save.data, input, () => randomInt(0, 1000000) / 1000000);
      await tx.update(saves).set({ data: output.state, updatedAt: new Date() }).where(eq(saves.userId, userId));
      return output;
    });
    return NextResponse.json({ ...result, player: publicPlayer(user) });
  } catch (error) {
    if (error instanceof Error && !error.message.includes("query:") && !error.message.includes("connect")) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Game action:", error);
    return NextResponse.json({ error: "Connection interrupted. Your last saved progress is safe." }, { status: 503 });
  }
}
