import { Flow, GeneratedLetter } from "@/types";
import { cleanLetterTextForDelivery } from "@/lib/letter-format";

const GENERATED_LETTER_SESSION_KEY = "briefkompas_generated_letter";

interface StoredGeneratedLetterSession {
  flow: Flow;
  letter: GeneratedLetter;
}

export function readStoredGeneratedLetter(flow: Flow): GeneratedLetter | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = sessionStorage.getItem(GENERATED_LETTER_SESSION_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as StoredGeneratedLetterSession;
    const cleanedLetter =
      parsed?.letter && typeof parsed.letter.letterText === "string"
        ? {
            ...parsed.letter,
            letterText: cleanLetterTextForDelivery(parsed.letter.letterText),
          }
        : null;

    if (
      parsed?.flow === flow &&
      cleanedLetter &&
      cleanedLetter.letterText.trim().length > 0
    ) {
      return cleanedLetter;
    }
  } catch {
    return null;
  }

  return null;
}

export function writeStoredGeneratedLetter(flow: Flow, letter: GeneratedLetter) {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(
    GENERATED_LETTER_SESSION_KEY,
    JSON.stringify({
      flow,
      letter: {
        ...letter,
        letterText: cleanLetterTextForDelivery(letter.letterText),
      },
    } satisfies StoredGeneratedLetterSession)
  );
}

export function clearStoredGeneratedLetter() {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(GENERATED_LETTER_SESSION_KEY);
}
