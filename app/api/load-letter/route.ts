import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  cleanupExpiredLetters,
  isValidTemporaryLetterId,
} from "@/lib/temporaryLetterStorage";
import type { LoadLetterResponse } from "@/lib/temporaryLetterStorageTypes";

export const runtime = "nodejs";

type LoadLetterRequestBody = {
  id?: unknown;
  token?: unknown;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "De brief kon niet worden opgehaald.";
}

export async function POST(request: NextRequest) {
  let body: LoadLetterRequestBody;

  try {
    body = (await request.json()) as LoadLetterRequestBody;
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const token = typeof body.token === "string" ? body.token.trim() : "";

  if (!id || !token) {
    return NextResponse.json({ error: "Het id en token zijn verplicht." }, { status: 400 });
  }

  if (!isValidTemporaryLetterId(id)) {
    return NextResponse.json({ error: "Het opgegeven id is ongeldig." }, { status: 400 });
  }

  try {
    try {
      await cleanupExpiredLetters();
    } catch (cleanupError) {
      console.error("Failed to clean up expired letters before load", cleanupError);
    }

    const supabaseAdmin = getSupabaseAdmin();
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .schema("public")
      .from("saved_letters")
      .select("content, expires_at")
      .eq("id", id)
      .eq("access_token", token)
      .gt("expires_at", now)
      .maybeSingle();

    if (error) {
      throw new Error("De brief kon niet worden opgehaald.");
    }

    const content = typeof data?.content === "string" ? data.content : "";
    const expiresAt = typeof data?.expires_at === "string" ? data.expires_at : "";

    if (!content || !expiresAt) {
      return NextResponse.json(
        { error: "Deze herstel-link is ongeldig of verlopen." },
        { status: 404 }
      );
    }

    const response: LoadLetterResponse = {
      content,
      expires_at: expiresAt,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to load letter", error);

    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
