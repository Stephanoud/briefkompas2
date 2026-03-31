import { NextResponse } from "next/server";
import { cleanupExpiredSavedLetters } from "@/lib/saved-letters/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await cleanupExpiredSavedLetters();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to clean up saved letters", error);
    return NextResponse.json(
      { error: "Cleanup mislukt." },
      { status: 500 }
    );
  }
}
