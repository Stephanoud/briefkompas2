import { NextResponse } from "next/server";

import { cleanupExpiredLetters } from "@/lib/temporaryLetterStorage";

export const runtime = "nodejs";

export async function GET() {
  try {
    await cleanupExpiredLetters();

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error("Failed to clean up saved letters", error);

    return NextResponse.json(
      { error: "Cleanup mislukt." },
      { status: 500 }
    );
  }
}
