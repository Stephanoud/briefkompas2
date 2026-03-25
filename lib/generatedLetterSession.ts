import { Flow, GeneratedLetter } from "@/types";

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
    if (
      parsed?.flow === flow &&
      parsed.letter &&
      typeof parsed.letter.letterText === "string" &&
      parsed.letter.letterText.trim().length > 0
    ) {
      return parsed.letter;
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
      letter,
    } satisfies StoredGeneratedLetterSession)
  );
}

export function clearStoredGeneratedLetter() {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(GENERATED_LETTER_SESSION_KEY);
}
