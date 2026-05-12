import { Flow, IntakeFormData, Product } from "@/types";

export const INTAKE_STORAGE_KEY = "briefkompas_intake";
export const PRODUCT_STORAGE_KEY = "briefkompas_product";
export const STORAGE_CONSENT_KEY = "briefkompas_storage_consent";

export type StorageConsent = "accepted" | "declined";
export type StoredIntakeData = Partial<IntakeFormData> & {
  flow: Flow;
  files?: IntakeFormData["files"];
};

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function readJson<T>(storage: Storage, key: string): T | null {
  const rawValue = storage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

function writeJson(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Browser storage can fail in private mode or when quota is full.
  }
}

export function readStorageConsent(): StorageConsent | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  const value = window.localStorage.getItem(STORAGE_CONSENT_KEY);
  return value === "accepted" || value === "declined" ? value : null;
}

export function hasPersistentStorageConsent(): boolean {
  return readStorageConsent() === "accepted";
}

export function setStorageConsent(consent: StorageConsent) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_CONSENT_KEY, consent);

  if (consent === "accepted") {
    const intake = window.sessionStorage.getItem(INTAKE_STORAGE_KEY);
    const product = window.sessionStorage.getItem(PRODUCT_STORAGE_KEY);
    if (intake) window.localStorage.setItem(INTAKE_STORAGE_KEY, intake);
    if (product) window.localStorage.setItem(PRODUCT_STORAGE_KEY, product);
  }
}

export function readStoredIntake(flow?: Flow): StoredIntakeData | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  const sessionData = readJson<StoredIntakeData>(window.sessionStorage, INTAKE_STORAGE_KEY);
  if (sessionData?.flow && (!flow || sessionData.flow === flow)) {
    return sessionData;
  }

  if (!hasPersistentStorageConsent()) {
    return null;
  }

  const localData = readJson<StoredIntakeData>(window.localStorage, INTAKE_STORAGE_KEY);
  if (localData?.flow && (!flow || localData.flow === flow)) {
    window.sessionStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(localData));
    return localData;
  }

  return null;
}

export function writeStoredIntake(data: StoredIntakeData) {
  if (!canUseBrowserStorage()) {
    return;
  }

  writeJson(window.sessionStorage, INTAKE_STORAGE_KEY, data);
  if (hasPersistentStorageConsent()) {
    writeJson(window.localStorage, INTAKE_STORAGE_KEY, data);
  }
}

export function readStoredProduct(): Product | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  const sessionProduct = window.sessionStorage.getItem(PRODUCT_STORAGE_KEY);
  if (sessionProduct === "basis" || sessionProduct === "uitgebreid") {
    return sessionProduct;
  }

  if (!hasPersistentStorageConsent()) {
    return null;
  }

  const localProduct = window.localStorage.getItem(PRODUCT_STORAGE_KEY);
  if (localProduct === "basis" || localProduct === "uitgebreid") {
    window.sessionStorage.setItem(PRODUCT_STORAGE_KEY, localProduct);
    return localProduct;
  }

  return null;
}

export function writeStoredProduct(product: Product) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.sessionStorage.setItem(PRODUCT_STORAGE_KEY, product);
  if (hasPersistentStorageConsent()) {
    window.localStorage.setItem(PRODUCT_STORAGE_KEY, product);
  }
}

export function clearStoredProduct() {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.sessionStorage.removeItem(PRODUCT_STORAGE_KEY);
  window.localStorage.removeItem(PRODUCT_STORAGE_KEY);
}

export function clearStoredIntake() {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.sessionStorage.removeItem(INTAKE_STORAGE_KEY);
  window.sessionStorage.removeItem(PRODUCT_STORAGE_KEY);
  window.localStorage.removeItem(INTAKE_STORAGE_KEY);
  window.localStorage.removeItem(PRODUCT_STORAGE_KEY);
}
