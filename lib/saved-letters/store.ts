import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import postgres, { Sql } from "postgres";
import {
  CleanupSavedLettersResult,
  SaveLetterRecordInput,
  SaveLetterResult,
  SavedLetterRecord,
  SavedLetterStatus,
} from "@/lib/saved-letters/types";
import { generateRecoveryToken, hashRecoveryToken, hashesMatch } from "@/lib/saved-letters/token";

const STORAGE_TTL_DAYS = 30;
const DEV_STORE_PATH = path.join(process.cwd(), "tmp", "saved-letters.dev.json");
const EXPIRED_DELETE_GRACE_DAYS = 7;

let sqlClient: Sql | null | undefined;
let ensureTablePromise: Promise<void> | null = null;

function getConnectionString() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    null
  );
}

function getStorageMode(): CleanupSavedLettersResult["storageMode"] {
  if (getConnectionString()) {
    return "postgres";
  }

  return process.env.NODE_ENV === "production" ? "unavailable" : "file";
}

function getSqlClient() {
  if (sqlClient !== undefined) {
    return sqlClient;
  }

  const connectionString = getConnectionString();
  if (!connectionString) {
    sqlClient = null;
    return sqlClient;
  }

  sqlClient = postgres(connectionString, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  });

  return sqlClient;
}

async function ensureSavedLettersTable() {
  const sql = getSqlClient();
  if (!sql) {
    return;
  }

  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS saved_letters (
          id UUID PRIMARY KEY,
          recovery_token_hash TEXT NOT NULL UNIQUE,
          document_payload JSONB NOT NULL,
          generated_letter TEXT NOT NULL,
          research_payload JSONB,
          created_at TIMESTAMPTZ NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          consent_storage BOOLEAN NOT NULL DEFAULT TRUE,
          consent_research BOOLEAN NOT NULL DEFAULT FALSE,
          status TEXT NOT NULL DEFAULT 'active',
          CONSTRAINT saved_letters_status_check CHECK (status IN ('active', 'expired', 'deleted')),
          CONSTRAINT saved_letters_storage_check CHECK (consent_storage = TRUE)
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS saved_letters_status_expires_idx
        ON saved_letters (status, expires_at)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS saved_letters_created_at_idx
        ON saved_letters (created_at DESC)
      `;
    })();
  }

  await ensureTablePromise;
}

function addDays(baseDate: Date, days: number) {
  return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
}

function normalizeRecord(record: SavedLetterRecord): SavedLetterRecord {
  return {
    ...record,
    researchPayload: record.researchPayload ?? null,
    status: record.status,
  };
}

function parseJsonField<T>(value: unknown): T | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  return value as T;
}

function rowToRecord(row: Record<string, unknown>): SavedLetterRecord | null {
  const documentPayload = parseJsonField<SavedLetterRecord["documentPayload"]>(row.document_payload);
  if (!documentPayload) {
    return null;
  }

  return normalizeRecord({
    id: String(row.id),
    recoveryTokenHash: String(row.recovery_token_hash),
    documentPayload,
    generatedLetter: String(row.generated_letter ?? ""),
    researchPayload: parseJsonField(row.research_payload),
    createdAt: new Date(String(row.created_at)).toISOString(),
    expiresAt: new Date(String(row.expires_at)).toISOString(),
    consentStorage: Boolean(row.consent_storage),
    consentResearch: Boolean(row.consent_research),
    status: String(row.status) as SavedLetterStatus,
  });
}

async function readDevRecords() {
  try {
    const rawValue = await fs.readFile(DEV_STORE_PATH, "utf-8");
    return (JSON.parse(rawValue) as SavedLetterRecord[]).map(normalizeRecord);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeDevRecords(records: SavedLetterRecord[]) {
  await fs.mkdir(path.dirname(DEV_STORE_PATH), { recursive: true });
  await fs.writeFile(DEV_STORE_PATH, JSON.stringify(records, null, 2), "utf-8");
}

async function cleanupFileRecords(now = new Date()): Promise<CleanupSavedLettersResult> {
  const records = await readDevRecords();
  const expiryThreshold = addDays(now, -EXPIRED_DELETE_GRACE_DAYS);
  let expiredCount = 0;
  let deletedCount = 0;

  const nextRecords = records
    .map((record) => {
      const expiresAt = new Date(record.expiresAt);
      if (record.status === "active" && expiresAt <= now) {
        expiredCount += 1;
        return {
          ...record,
          status: "expired" as const,
        };
      }
      return record;
    })
    .filter((record) => {
      if (record.status === "expired" && new Date(record.expiresAt) <= expiryThreshold) {
        deletedCount += 1;
        return false;
      }
      return true;
    });

  await writeDevRecords(nextRecords);

  return {
    expiredCount,
    deletedCount,
    storageMode: "file",
  };
}

export function getSavedLetterExpiresAt(createdAt = new Date()) {
  return addDays(createdAt, STORAGE_TTL_DAYS);
}

export async function cleanupExpiredSavedLetters(now = new Date()): Promise<CleanupSavedLettersResult> {
  const storageMode = getStorageMode();

  if (storageMode === "file") {
    return cleanupFileRecords(now);
  }

  if (storageMode === "unavailable") {
    return {
      expiredCount: 0,
      deletedCount: 0,
      storageMode,
    };
  }

  const sql = getSqlClient();
  if (!sql) {
    return {
      expiredCount: 0,
      deletedCount: 0,
      storageMode: "unavailable",
    };
  }

  await ensureSavedLettersTable();

  const expiredRows = await sql`
    UPDATE saved_letters
    SET status = 'expired'
    WHERE status = 'active' AND expires_at <= ${now.toISOString()}
    RETURNING id
  `;

  const deleteThreshold = addDays(now, -EXPIRED_DELETE_GRACE_DAYS).toISOString();
  const deletedRows = await sql`
    DELETE FROM saved_letters
    WHERE status = 'expired' AND expires_at <= ${deleteThreshold}
    RETURNING id
  `;

  return {
    expiredCount: expiredRows.length,
    deletedCount: deletedRows.length,
    storageMode,
  };
}

export async function saveLetterRecord(input: SaveLetterRecordInput): Promise<SaveLetterResult> {
  await cleanupExpiredSavedLetters();

  const storageMode = getStorageMode();
  if (storageMode === "unavailable") {
    throw new Error("Tijdelijke opslag is op dit moment niet beschikbaar.");
  }

  const createdAt = new Date();
  const expiresAt = getSavedLetterExpiresAt(createdAt);
  const recoveryToken = generateRecoveryToken();
  const recoveryTokenHash = hashRecoveryToken(recoveryToken);
  const record: SavedLetterRecord = {
    id: randomUUID(),
    recoveryTokenHash,
    documentPayload: input.documentPayload,
    generatedLetter: input.generatedLetter,
    researchPayload: input.researchPayload,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    consentStorage: true,
    consentResearch: input.consentResearch,
    status: "active",
  };

  if (storageMode === "file") {
    const records = await readDevRecords();
    records.push(record);
    await writeDevRecords(records);

    return {
      id: record.id,
      recoveryToken,
      expiresAt: record.expiresAt,
    };
  }

  const sql = getSqlClient();
  if (!sql) {
    throw new Error("De opslagverbinding kon niet worden geopend.");
  }

  await ensureSavedLettersTable();

  await sql`
    INSERT INTO saved_letters (
      id,
      recovery_token_hash,
      document_payload,
      generated_letter,
      research_payload,
      created_at,
      expires_at,
      consent_storage,
      consent_research,
      status
    ) VALUES (
      ${record.id},
      ${record.recoveryTokenHash},
      ${JSON.stringify(record.documentPayload)}::jsonb,
      ${record.generatedLetter},
      ${record.researchPayload ? JSON.stringify(record.researchPayload) : null}::jsonb,
      ${record.createdAt},
      ${record.expiresAt},
      ${record.consentStorage},
      ${record.consentResearch},
      ${record.status}
    )
  `;

  return {
    id: record.id,
    recoveryToken,
    expiresAt: record.expiresAt,
  };
}

export async function findLetterRecordByToken(token: string): Promise<SavedLetterRecord | null> {
  await cleanupExpiredSavedLetters();

  const storageMode = getStorageMode();
  if (storageMode === "unavailable") {
    return null;
  }

  const recoveryTokenHash = hashRecoveryToken(token);

  if (storageMode === "file") {
    const records = await readDevRecords();
    const match = records.find((record) => hashesMatch(record.recoveryTokenHash, recoveryTokenHash));
    if (!match || match.status !== "active" || new Date(match.expiresAt) <= new Date()) {
      return null;
    }

    return match;
  }

  const sql = getSqlClient();
  if (!sql) {
    return null;
  }

  await ensureSavedLettersTable();

  const rows = await sql`
    SELECT
      id,
      recovery_token_hash,
      document_payload,
      generated_letter,
      research_payload,
      created_at,
      expires_at,
      consent_storage,
      consent_research,
      status
    FROM saved_letters
    WHERE recovery_token_hash = ${recoveryTokenHash}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return null;
  }

  const record = rowToRecord(rows[0]);
  if (!record || record.status !== "active" || new Date(record.expiresAt) <= new Date()) {
    return null;
  }

  return record;
}
