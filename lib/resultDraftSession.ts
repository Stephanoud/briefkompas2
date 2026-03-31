import { Flow } from "@/types";

const RESULT_DRAFT_SESSION_KEY = "briefkompas_result_draft";

interface StoredResultDraftSession {
  flow: Flow;
  manualReferences: string;
}

export function readStoredResultDraft(flow: Flow): string {
  if (typeof window === "undefined") {
    return "";
  }

  const rawValue = sessionStorage.getItem(RESULT_DRAFT_SESSION_KEY);
  if (!rawValue) {
    return "";
  }

  try {
    const parsed = JSON.parse(rawValue) as StoredResultDraftSession;
    if (parsed?.flow === flow && typeof parsed.manualReferences === "string") {
      return parsed.manualReferences;
    }
  } catch {
    return "";
  }

  return "";
}

export function writeStoredResultDraft(flow: Flow, manualReferences: string) {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(
    RESULT_DRAFT_SESSION_KEY,
    JSON.stringify({
      flow,
      manualReferences,
    } satisfies StoredResultDraftSession)
  );
}

export function clearStoredResultDraft() {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(RESULT_DRAFT_SESSION_KEY);
}
